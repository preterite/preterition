#!/usr/bin/env python3
"""
_scripts/fetch_webmentions.py -- the webmentions this site has received,
kept as files in the repository.

The site's pages name a hosted receiver, webmention.io, as their
webmention endpoint (_includes/head.html). The receiver accepts mentions
as they arrive and holds them; this script copies the new ones into
_data/webmentions/<slug>/, one JSON file per mention, and the entry's
comment thread renders them beside its comments (_includes/comments.html).
The repository is the record. The receiver is where a mention waits
between arriving and being copied, and replacing it changes the endpoint
line and the API address below, nothing a reader sees.

WHAT IT WILL NOT DO. It never deletes a file and never rewrites one: a
mention already on disk stays as it was copied. It never fails the build:
a missing token, an unreachable API or a malformed reply is reported and
the script exits 0, leaving the tree as it stands. It never copies a
private webmention, and it skips mentions this site sent to itself.

WHERE A MENTION IS FILED. Under the slug of the entry it names. A mention
sent to an address the entry used to have -- the weblog's old /blog/
addresses -- is filed under the same slug, because the address table is
built from each entry's permalink and redirect_from. A mention of a page
that is not an entry (the home page, the About page) is kept under
_data/webmentions/_unmatched/, which nothing renders, so nothing received
is missing from the record.

WHAT IS COPIED. The mention's id, date, author name and site, its kind,
the address of the page that sent it, and its text. Not the author's
photo: the site shows no avatars. Text is stored as received and escaped
where it renders.

Run it with the token in WEBMENTION_IO_TOKEN:
    python3 _scripts/fetch_webmentions.py
--dry-run reports without writing. --example URL reads webmention.io's
example feed for that URL instead and needs no token, which is how the
render can be tested before any mention arrives. Standard library only,
so the job that runs it installs nothing.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://webmention.io/api/mentions.jf2"
EXAMPLE_API = "https://webmention.io/api/example/mentions.jf2"
DOMAIN = "preterite.net"
HOSTS = {"preterite.net", "www.preterite.net"}
PER_PAGE = 100
MAX_PAGES = 50
TIMEOUT = 30
UNMATCHED = "_unmatched"
ROOT = Path(__file__).resolve().parent.parent

POST_NAME = re.compile(r"(\d{4})-(\d{2})-(\d{2})-(.+)\.md$")
DATED = re.compile(r"^/(?:weblog|blog)/\d{4}/\d{2}/\d{2}/([^/]+?)(?:\.html|/)?$")
ISO_DATE = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$")
FILE_NAME = re.compile(r"^wm_(\d+)\.json$")


def note(message):
    print(f"fetch_webmentions: {message}", file=sys.stderr)


def normalize_path(path):
    path = urllib.parse.unquote(path.split("#", 1)[0].split("?", 1)[0]).strip()
    if not path.startswith("/"):
        path = "/" + path
    if path.endswith("/index.html"):
        path = path[: -len("index.html")]
    return path


def scalar(value):
    return value.strip().strip("\"'")


def entry_addresses(text):
    """(permalink, date, redirect_from list) from an entry's front matter.
    Only these three keys are read, in the forms the weblog writes them,
    so no YAML library is needed."""
    if not text.startswith("---\n"):
        return None, None, []
    end = text.find("\n---", 4)
    if end == -1:
        return None, None, []
    permalink, date, redirects, in_list = None, None, [], False
    for line in text[4:end].splitlines():
        if line.startswith("permalink:"):
            permalink, in_list = scalar(line[len("permalink:"):]), False
        elif line.startswith("date:"):
            date, in_list = scalar(line[len("date:"):]), False
        elif line.startswith("redirect_from:"):
            rest = scalar(line[len("redirect_from:"):])
            if rest:
                redirects.append(rest)
            in_list = not rest
        elif in_list and line.lstrip().startswith("- "):
            redirects.append(scalar(line.lstrip()[2:]))
        elif line and not line[0].isspace():
            in_list = False
    return permalink, date, redirects


def default_permalink(date, name):
    """The address _config.yml's posts default gives an entry that sets no
    permalink of its own: /weblog/:year/:month/:day/:title.html, with the
    day as the entry's date is written. An entry whose written offset puts
    it on another day in the site's time zone is still found by its slug
    (see resolve)."""
    year, month, day, slug = name.groups()
    written = re.match(r"(\d{4})-(\d{2})-(\d{2})", date or "")
    if written:
        year, month, day = written.groups()
    return f"/weblog/{year}/{month}/{day}/{slug}.html"


def address_table(root):
    """Every address an entry answers to, mapped to the entry's slug; and
    the slugs that name exactly one entry."""
    table, counts = {}, {}
    for path in sorted((root / "weblog" / "_posts").glob("*.md")):
        name = POST_NAME.match(path.name)
        if not name:
            continue
        slug = name.group(4)
        counts[slug] = counts.get(slug, 0) + 1
        permalink, date, redirects = entry_addresses(path.read_text(encoding="utf-8"))
        for address in [permalink or default_permalink(date, name), *redirects]:
            table[normalize_path(address)] = slug
    unique = {slug for slug, n in counts.items() if n == 1}
    return table, unique


def resolve(target, table, unique):
    """The slug of the entry a mention's target names, or None."""
    parts = urllib.parse.urlsplit(target if isinstance(target, str) else "")
    if parts.hostname not in HOSTS:
        return None
    path = normalize_path(parts.path)
    for candidate in (path, path.rstrip("/") + "/", path.rstrip("/")):
        if candidate in table:
            return table[candidate]
    dated = DATED.match(path)
    if dated and dated.group(1) in unique:
        return dated.group(1)
    return None


def web_url(value):
    value = value.strip() if isinstance(value, str) else ""
    return value if urllib.parse.urlsplit(value).scheme in ("http", "https") else ""


def text_of(mention):
    content = mention.get("content")
    if isinstance(content, dict):
        text = content.get("text") or content.get("value") or ""
    elif isinstance(content, str):
        text = content
    else:
        text = ""
    if not text and mention.get("wm-property") in (None, "in-reply-to", "mention-of"):
        summary = mention.get("summary")
        if isinstance(summary, dict):
            text = summary.get("value") or ""
    return text.strip() if isinstance(text, str) else ""


def record(mention, wid, keep_target):
    """The file's contents: the shape a comment file has, so the thread's
    one render loop takes both, with the mention's own fields beside it."""
    source = web_url(mention.get("wm-source"))
    published = mention.get("published")
    date = published if isinstance(published, str) and ISO_DATE.match(published) \
        else mention.get("wm-received")
    if not source or not isinstance(date, str):
        return None
    author = mention.get("author") if isinstance(mention.get("author"), dict) else {}
    name = author.get("name").strip() if isinstance(author.get("name"), str) else ""
    kind = mention.get("wm-property")
    rec = {
        "id": f"wm_{wid}",
        "date": date,
        "author": {
            "name": name or urllib.parse.urlsplit(source).hostname,
            "website": web_url(author.get("url")) or source,
        },
        "replying_to": None,
        "message": text_of(mention),
        "type": "pingback" if mention.get("wm-protocol") == "pingback" else "webmention",
        "property": kind if isinstance(kind, str) and kind else "mention-of",
        "source": source,
    }
    if kind == "rsvp" and isinstance(mention.get("rsvp"), str):
        rec["rsvp"] = mention["rsvp"]
    if keep_target:
        rec["target"] = mention.get("wm-target")
    return rec


def fetch(url, token):
    request = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "User-Agent": "preterite.net fetch_webmentions",
    })
    if token:
        # A header rather than a query parameter keeps the token out of
        # every URL, and so out of logs and error messages.
        request.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return json.load(response)


def children(feed):
    items = feed.get("children") if isinstance(feed, dict) else None
    if not isinstance(items, list):
        raise ValueError("the reply carries no list of mentions")
    return items


def mentions(token, since_id, example):
    """New mentions, oldest first, a page at a time: the API's since_id
    polling, which stays stable while mentions arrive."""
    if example:
        query = urllib.parse.urlencode({"target": example, "per-page": PER_PAGE})
        yield from children(fetch(f"{EXAMPLE_API}?{query}", None))
        return
    for _ in range(MAX_PAGES):
        query = urllib.parse.urlencode({
            "domain": DOMAIN, "since_id": since_id,
            "sort-dir": "up", "per-page": PER_PAGE,
        })
        batch = children(fetch(f"{API}?{query}", token))
        yield from batch
        ids = [int(m["wm-id"]) for m in batch
               if isinstance(m, dict) and str(m.get("wm-id", "")).isdigit()]
        if len(batch) < PER_PAGE or not ids:
            return
        since_id = max(ids)
    note(f"stopped after {MAX_PAGES} pages; the next run continues")


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n",
                         encoding="utf-8")
    os.replace(temporary, path)


def run(args):
    root = Path(args.root).resolve()
    store = root / "_data" / "webmentions"
    token = os.environ.get("WEBMENTION_IO_TOKEN", "").strip()
    if not token and not args.example:
        note("WEBMENTION_IO_TOKEN is not set; nothing fetched")
        return
    held = {}
    for path in store.glob("*/wm_*.json"):
        found = FILE_NAME.match(path.name)
        if found:
            held[int(found.group(1))] = path
    table, unique = address_table(root)
    tally = dict.fromkeys(
        ("written", "unmatched", "held", "private", "self", "unusable"), 0)
    for mention in mentions(token, max(held, default=0), args.example):
        if not isinstance(mention, dict) or not str(mention.get("wm-id", "")).isdigit():
            tally["unusable"] += 1
            continue
        wid = int(mention["wm-id"])
        if wid in held:
            tally["held"] += 1
            continue
        if mention.get("wm-private"):
            tally["private"] += 1
            continue
        source = mention.get("wm-source") if isinstance(mention.get("wm-source"), str) else ""
        if urllib.parse.urlsplit(source).hostname in HOSTS:
            tally["self"] += 1
            continue
        slug = resolve(mention.get("wm-target"), table, unique)
        rec = record(mention, wid, keep_target=slug is None)
        if rec is None:
            tally["unusable"] += 1
            continue
        path = store / (slug or UNMATCHED) / f"wm_{wid}.json"
        if path.exists():
            tally["held"] += 1
            continue
        if not args.dry_run:
            write_json(path, rec)
        held[wid] = path
        tally["written"] += 1
        if slug is None:
            tally["unmatched"] += 1
    verb = "would write" if args.dry_run else "wrote"
    note(f"{verb} {tally['written']}, {tally['unmatched']} of them naming no entry; "
         f"skipped {tally['held']} already held, {tally['private']} private, "
         f"{tally['self']} from this site, {tally['unusable']} unusable")


def main():
    parser = argparse.ArgumentParser(
        description="Copy new webmentions from webmention.io into _data/webmentions/.")
    parser.add_argument("--root", default=str(ROOT), help="repository root")
    parser.add_argument("--dry-run", action="store_true", help="report, write nothing")
    parser.add_argument("--example", metavar="URL",
                        help="read webmention.io's example feed for URL; no token needed")
    args = parser.parse_args()
    try:
        run(args)
    except Exception as error:  # the build proceeds whatever happens here
        note(f"stopped: {error.__class__.__name__}: {error}; "
             "the tree is left as it stands")
    return 0


if __name__ == "__main__":
    sys.exit(main())
