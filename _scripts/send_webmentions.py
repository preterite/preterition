#!/usr/bin/env python3
"""
_scripts/send_webmentions.py -- tell the pages a new entry links that the
entry exists.

When an entry is published, each site it links can be told so: the entry
is the source, the linked page is the target, and the target's own
endpoint decides what to do with the notice -- show it, queue it for its
owner, or ignore it. This script sends those notices for the entries a
push added, after the deploy has put them on the live site, because a
receiver fetches the source to confirm the link before accepting anything.

WHICH ENTRIES. By default, only the entries a push added under
weblog/_posts/, read from the push's own range of commits (--range
BEFORE..AFTER). An entry edited and released again sends nothing a second
time unless it is named by hand with --post. Never the whole weblog: twenty
years of links would notify sites about entries they were never told of
when those entries were new.

WHICH LINKS. The links inside the entry itself -- the element carrying
data-pagefind-body on the live page -- and not those in the header, the
sidebar or the comments. Links to this site are skipped. Each address is
sent to once per entry, without its #fragment.

HOW. For each target, its webmention endpoint is discovered the way the
W3C Webmention recommendation describes: an HTTP Link header first, then
the first <link> or <a> in the document whose rel includes "webmention".
Failing that, a pingback server is looked for (an X-Pingback header, then
<link rel="pingback">), which is how WordPress sites listen, and the
notice goes as a pingback. A target with neither is reported and skipped.

WHAT IT WILL NOT DO. It never fails the build: every failure is reported
and the script exits 0. It writes nothing to the repository and keeps no
record of what it sent; the push range is its memory. It sends nothing for
an entry the live site does not yet serve, and nothing to an endpoint on a
private or loopback address.

    python3 _scripts/send_webmentions.py --range BEFORE..AFTER
    python3 _scripts/send_webmentions.py --post weblog/_posts/2026-09-30-x.md

--target URL ... limits a run to the targets named, which is how a refused
notice is retried. Notices to one host are spaced HOST_SPACING seconds
apart. --dry-run discovers and reports without sending. --discover URL ... reports
endpoint discovery for the pages named and sends nothing, which is how the
discovery rules are tested. Standard library only, so the job that runs it
installs nothing.
"""

from __future__ import annotations

import argparse
import ipaddress
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xmlrpc.client
from html.parser import HTMLParser
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
# One reader of an entry's front matter: the fetcher's, which already
# derives every address an entry answers to.
from fetch_webmentions import HOSTS, POST_NAME, default_permalink, entry_addresses  # noqa: E402

SITE = "https://preterite.net"
USER_AGENT = "preterite.net send_webmentions (+https://preterite.net/)"
TIMEOUT = 20
MAX_BYTES = 2_000_000
MAX_TARGETS = 60
LIVE_ATTEMPTS = 6
LIVE_WAIT = 20
PAUSE = 0.5
HOST_SPACING = 30
POSTS_DIR = "weblog/_posts/"
ROOT = Path(__file__).resolve().parent.parent

LINK_ITEM = re.compile(r"<([^>]*)>([^<]*)")
REL_PARAM = re.compile(r';\s*rel\s*=\s*(?:"([^"]*)"|([^\s;,]+))', re.I)
PINGBACK_FAULTS = {
    16: "source not found", 17: "source does not link the target",
    32: "target not found", 33: "target accepts no pingbacks",
    48: "already registered", 49: "refused", 50: "upstream error",
}


def note(message):
    print(f"send_webmentions: {message}", file=sys.stderr)


def as_uri(url):
    """An address as it may be requested: a link written with characters
    outside ASCII in its path or query is percent-encoded, and anything
    already encoded is left as it is."""
    parts = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit(parts._replace(
        path=urllib.parse.quote(parts.path, safe="/%:@!$&'()*+,;=~"),
        query=urllib.parse.quote(parts.query, safe="/%:@!$&'()*+,;=~?")))


def get(url):
    request = urllib.request.Request(as_uri(url), headers={
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
    })
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return response.geturl(), response.headers, response.read(MAX_BYTES)


def decoded(headers, body):
    charset = headers.get_content_charset() or "utf-8"
    try:
        return body.decode(charset, errors="replace")
    except LookupError:
        return body.decode("utf-8", errors="replace")


def is_html(headers):
    return headers.get_content_type() in ("text/html", "application/xhtml+xml")


def has_rel(value, token):
    return token in (value or "").lower().split()


def public(url):
    """Whether an address is somewhere a notice may be sent: http or https,
    and not a loopback, private or otherwise non-global host."""
    parts = urllib.parse.urlsplit(url)
    host = (parts.hostname or "").lower()
    if parts.scheme not in ("http", "https") or not host:
        return False
    if host == "localhost" or host.endswith(".localhost"):
        return False
    try:
        return ipaddress.ip_address(host).is_global
    except ValueError:
        return True


class RelFinder(HTMLParser):
    """The href of the first <link> or <a> whose rel includes a token. An
    empty href is an endpoint all the same: the page itself."""

    def __init__(self, token):
        super().__init__(convert_charrefs=True)
        self.token, self.href = token, None

    def handle_starttag(self, tag, attrs):
        if self.href is None and tag in ("link", "a"):
            attrs = dict(attrs)
            if "href" in attrs and has_rel(attrs.get("rel"), self.token):
                self.href = attrs["href"] or ""

    handle_startendtag = handle_starttag


def header_endpoint(headers, base, token):
    for value in headers.get_all("Link") or []:
        for item in LINK_ITEM.finditer(value):
            for rel in REL_PARAM.finditer(item.group(2)):
                if has_rel(rel.group(1) or rel.group(2), token):
                    return urllib.parse.urljoin(base, item.group(1))
    return None


def document_endpoint(headers, body, base, token):
    if not is_html(headers):
        return None
    finder = RelFinder(token)
    finder.feed(decoded(headers, body))
    finder.close()
    return None if finder.href is None else urllib.parse.urljoin(base, finder.href)


def discover(target):
    """("webmention", endpoint), ("pingback", server) or (None, reason).
    Relative addresses resolve against the page as finally served, after
    any redirects."""
    final, headers, body = get(target)
    endpoint = header_endpoint(headers, final, "webmention") \
        or document_endpoint(headers, body, final, "webmention")
    if endpoint is not None:
        return "webmention", endpoint
    server = headers.get("X-Pingback")
    server = urllib.parse.urljoin(final, server.strip()) if server \
        else document_endpoint(headers, body, final, "pingback")
    if server:
        return "pingback", server
    return None, "no endpoint"


def send_webmention(endpoint, source, target):
    data = urllib.parse.urlencode({"source": source, "target": target}).encode("ascii")
    request = urllib.request.Request(endpoint, data=data, headers={
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
    })
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return f"accepted ({response.status})"


class _Transport(xmlrpc.client.Transport):
    user_agent = USER_AGENT


class _SafeTransport(xmlrpc.client.SafeTransport):
    user_agent = USER_AGENT


def send_pingback(server, source, target):
    # The script's own user agent, not the library's: some hosts' firewalls
    # refuse Python's default XML-RPC agent with a 412 before WordPress sees
    # the call.
    transport = _SafeTransport() if server.lower().startswith("https:") else _Transport()
    try:
        xmlrpc.client.ServerProxy(server, transport=transport).pingback.ping(source, target)
        return "accepted"
    except xmlrpc.client.Fault as fault:
        if fault.faultCode == 48:
            return "already registered"
        reason = PINGBACK_FAULTS.get(fault.faultCode, fault.faultString)
        raise RuntimeError(f"pingback fault {fault.faultCode}: {reason}") from None


class EntryLinks(HTMLParser):
    """Every href inside the first element carrying data-pagefind-body. The
    region closes when its own tag closes, counted by that tag alone, so an
    unclosed <p> or <li> inside it cannot carry the region on into the
    sidebar."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tag, self.depth, self.found, self.hrefs = None, 0, False, []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if self.depth:
            if tag == self.tag:
                self.depth += 1
            if tag == "a" and attrs.get("href"):
                self.hrefs.append(attrs["href"])
        elif not self.found and "data-pagefind-body" in attrs:
            self.tag, self.depth, self.found = tag, 1, True

    def handle_endtag(self, tag):
        if self.depth and tag == self.tag:
            self.depth -= 1


def entry_url(root, name):
    path = Path(name)
    if not path.is_absolute():
        path = root / (name if "/" in name else POSTS_DIR + name)
    match = POST_NAME.match(path.name)
    if not match or not path.is_file():
        return None
    permalink, date, _ = entry_addresses(path.read_text(encoding="utf-8"))
    return SITE + (permalink or default_permalink(date, match))


def live_links(url, wait):
    """The hrefs of the entry as the live site serves it, or None. A 404 is
    retried, since the deploy may not have reached the edge yet."""
    for attempt in range(LIVE_ATTEMPTS if wait else 1):
        try:
            _, headers, body = get(url)
            parser = EntryLinks()
            parser.feed(decoded(headers, body))
            parser.close()
            if parser.found:
                return parser.hrefs
            note(f"{url}: served, but no entry text found in it; nothing sent")
            return None
        except urllib.error.HTTPError as error:
            if error.code != 404:
                note(f"{url}: {error.code}; nothing sent")
                return None
        except (urllib.error.URLError, OSError) as error:
            note(f"{url}: {error}; retrying")
        if wait and attempt + 1 < LIVE_ATTEMPTS:
            time.sleep(LIVE_WAIT)
    note(f"{url}: not served; nothing sent")
    return None


def targets(source, hrefs):
    seen, found = set(), []
    for href in hrefs:
        parts = urllib.parse.urlsplit(urllib.parse.urljoin(source, href.strip()))
        if parts.scheme not in ("http", "https") or not parts.hostname:
            continue
        if parts.hostname.lower() in HOSTS:
            continue
        url = urllib.parse.urlunsplit(parts._replace(fragment=""))
        if url not in seen:
            seen.add(url)
            found.append(url)
    return found


def added_entries(root, span):
    """The entries a push added, from its range of commits. A range whose
    first commit is all zeros (a new branch) or absent here (a force push)
    names nothing, and nothing is sent."""
    before, _, after = span.partition("..")
    if not before or not after or set(before) == {"0"}:
        note(f"range {span!r} names no earlier commit; nothing sent")
        return []
    for rev in (before, after):
        probe = subprocess.run(["git", "-C", str(root), "cat-file", "-e", f"{rev}^{{commit}}"],
                               capture_output=True)
        if probe.returncode:
            note(f"commit {rev} is not in this checkout; nothing sent")
            return []
    listing = subprocess.run(
        ["git", "-C", str(root), "diff", "--name-only", "--diff-filter=A",
         before, after, "--", POSTS_DIR],
        capture_output=True, text=True, check=True).stdout.split()
    return [p for p in listing if POST_NAME.match(Path(p).name)]


def run(args):
    socket.setdefaulttimeout(TIMEOUT)
    root = Path(args.root).resolve()
    if args.discover:
        for url in args.discover:
            try:
                kind, where = discover(url)
                print(f"{url}\t{kind or '-'}\t{where}")
            except Exception as error:
                print(f"{url}\terror\t{error.__class__.__name__}: {error}")
        return
    entries = added_entries(root, args.range) if args.range else []
    entries = list(dict.fromkeys(entries + (args.post or [])))
    if not entries:
        note("no entries to send for")
        return
    tally = dict.fromkeys(("sent", "found", "none", "failed", "capped"), 0)
    last_sent = {}
    for name in entries:
        source = entry_url(root, name)
        if source is None:
            note(f"{name}: not an entry in this checkout; skipped")
            continue
        hrefs = live_links(source, wait=not args.dry_run)
        if hrefs is None:
            continue
        found = targets(source, hrefs)
        if len(found) > MAX_TARGETS:
            tally["capped"] += len(found) - MAX_TARGETS
            note(f"{source}: {len(found)} links, the first {MAX_TARGETS} taken")
            found = found[:MAX_TARGETS]
        note(f"{source}: {len(found)} external link(s)")
        for target in found:
            if args.target and target not in args.target:
                continue
            try:
                kind, where = discover(target)
                if kind is None:
                    tally["none"] += 1
                    note(f"  {target}: no endpoint")
                elif not public(where):
                    tally["failed"] += 1
                    note(f"  {target}: {kind} endpoint {where} is not public; not sent")
                elif args.dry_run:
                    tally["found"] += 1
                    note(f"  {target}: {kind} at {where} (not sent)")
                else:
                    # One notice per host per HOST_SPACING seconds: a
                    # WordPress site counts pingbacks as comments and
                    # refuses a second inside its flood interval.
                    host = urllib.parse.urlsplit(where).hostname
                    wait = HOST_SPACING - (time.monotonic() - last_sent.get(host, -HOST_SPACING))
                    if wait > 0:
                        time.sleep(wait)
                    send = send_webmention if kind == "webmention" else send_pingback
                    try:
                        result = send(where, source, target)
                    finally:
                        last_sent[host] = time.monotonic()
                    tally["sent"] += 1
                    note(f"  {target}: {kind} {result}")
            except Exception as error:
                tally["failed"] += 1
                note(f"  {target}: {error.__class__.__name__}: {error}")
            time.sleep(PAUSE)
    if args.dry_run:
        note(f"dry run: {tally['found']} target(s) with an endpoint, {tally['none']} without, "
             f"{tally['failed']} failed, {tally['capped']} over the cap; nothing sent")
    else:
        note(f"sent {tally['sent']}; {tally['none']} target(s) without an endpoint, "
             f"{tally['failed']} failed, {tally['capped']} over the cap")


def main():
    parser = argparse.ArgumentParser(
        description="Send webmentions (or pingbacks) for new weblog entries.")
    parser.add_argument("--root", default=str(ROOT), help="repository root")
    parser.add_argument("--range", metavar="BEFORE..AFTER",
                        help="send for the entries added between two commits")
    parser.add_argument("--post", nargs="+", metavar="ENTRY",
                        help="send for these entries, by path or file name")
    parser.add_argument("--target", nargs="+", metavar="URL",
                        help="send only to these targets, as linked without #fragment")
    parser.add_argument("--dry-run", action="store_true",
                        help="discover and report, send nothing")
    parser.add_argument("--discover", nargs="+", metavar="URL",
                        help="report endpoint discovery for these pages and send nothing")
    args = parser.parse_args()
    try:
        run(args)
    except Exception as error:  # the deploy has happened; nothing here may fail the run
        note(f"stopped: {error.__class__.__name__}: {error}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
