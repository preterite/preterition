#!/usr/bin/env python3
"""print-with-pagedjs.py -- print a paged.js document to PDF, deterministically.

Why this exists. Chrome's --print-to-pdf fires when the page finishes loading
and cannot be told to wait for anything else, and --virtual-time-budget does
not help: it fast-forwards timers, so paged.js's asynchronous layout has not
run when the print happens. The result is a one-page blank.

So we drive Chrome through the DevTools protocol instead: open the page, poll
until paged.js has actually finished laying out, and only then ask for the PDF.
Chrome also has to be given --allow-file-access-from-files, because paged.js
reads the stylesheet over XHR and a file:// origin blocks that by default.

The WebSocket client below is hand-rolled to keep this dependency-free.
Usage: print-with-pagedjs.py <input.html> <output.pdf>
"""
import base64, json, os, re, socket, struct, subprocess, sys, tempfile, time
from urllib.parse import urlparse

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SETTLE_POLLS = 3          # consecutive polls with an unchanged page count
POLL_SECONDS = 0.4
TIMEOUT_SECONDS = 180


class WS:
    """The smallest WebSocket client that can talk to DevTools."""

    def __init__(self, url):
        u = urlparse(url)
        self.sock = socket.create_connection((u.hostname, u.port), timeout=30)
        key = base64.b64encode(os.urandom(16)).decode()
        path = u.path + ("?" + u.query if u.query else "")
        self.sock.sendall((
            "GET %s HTTP/1.1\r\nHost: %s:%d\r\nUpgrade: websocket\r\n"
            "Connection: Upgrade\r\nSec-WebSocket-Key: %s\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
            % (path, u.hostname, u.port, key)).encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.sock.recv(4096)
        if b"101" not in buf.split(b"\r\n")[0]:
            raise RuntimeError("websocket upgrade refused: %r" % buf[:120])
        self.rest = buf.split(b"\r\n\r\n", 1)[1]
        self.msg_id = 0

    def _recv(self, n):
        while len(self.rest) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise RuntimeError("socket closed")
            self.rest += chunk
        out, self.rest = self.rest[:n], self.rest[n:]
        return out

    def send(self, method, params=None):
        self.msg_id += 1
        payload = json.dumps({"id": self.msg_id, "method": method,
                              "params": params or {}}).encode()
        mask = os.urandom(4)
        n = len(payload)
        header = b"\x81"
        if n < 126:
            header += bytes([0x80 | n])
        elif n < 65536:
            header += bytes([0x80 | 126]) + struct.pack(">H", n)
        else:
            header += bytes([0x80 | 127]) + struct.pack(">Q", n)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self.sock.sendall(header + mask + masked)
        return self.msg_id

    def _frame(self):
        b0, b1 = self._recv(2)
        fin, opcode = b0 & 0x80, b0 & 0x0F
        n = b1 & 0x7F
        if n == 126:
            n = struct.unpack(">H", self._recv(2))[0]
        elif n == 127:
            n = struct.unpack(">Q", self._recv(8))[0]
        return fin, opcode, self._recv(n)

    def recv(self):
        fin, opcode, data = self._frame()
        while not fin:
            fin, _, more = self._frame()
            data += more
        if opcode == 0x8:
            raise RuntimeError("server closed the connection")
        return json.loads(data.decode())

    def call(self, method, params=None, timeout=120):
        want = self.send(method, params)
        end = time.time() + timeout
        while time.time() < end:
            msg = self.recv()
            if msg.get("id") == want:
                if "error" in msg:
                    raise RuntimeError("%s: %s" % (method, msg["error"]))
                return msg.get("result", {})
        raise TimeoutError(method)


def evaluate(ws, expression):
    r = ws.call("Runtime.evaluate", {"expression": expression, "returnByValue": True})
    return r.get("result", {}).get("value")


def main(src_html, out_pdf):
    profile = tempfile.mkdtemp(prefix="cvprint-")
    proc = subprocess.Popen(
        [CHROME, "--headless=new", "--disable-gpu", "--no-first-run",
         "--allow-file-access-from-files", "--remote-debugging-port=0",
         "--user-data-dir=" + profile, "about:blank"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    ws_url = None
    deadline = time.time() + 30
    while time.time() < deadline:
        line = proc.stderr.readline().decode("utf-8", "replace")
        m = re.search(r"(ws://\S+)", line)
        if m:
            ws_url = m.group(1)
            break
    if not ws_url:
        proc.kill()
        raise RuntimeError("Chrome never announced a DevTools endpoint")

    try:
        browser = WS(ws_url)
        target = browser.call("Target.createTarget", {"url": "about:blank"})["targetId"]
        info = browser.call("Target.attachToTarget", {"targetId": target, "flatten": True})
        session = info["sessionId"]

        def call(method, params=None, timeout=120):
            browser.msg_id += 1
            mid = browser.msg_id
            payload = json.dumps({"id": mid, "method": method,
                                  "params": params or {}, "sessionId": session}).encode()
            mask = os.urandom(4)
            n = len(payload)
            header = b"\x81"
            if n < 126:
                header += bytes([0x80 | n])
            elif n < 65536:
                header += bytes([0x80 | 126]) + struct.pack(">H", n)
            else:
                header += bytes([0x80 | 127]) + struct.pack(">Q", n)
            browser.sock.sendall(header + mask +
                                 bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))
            end = time.time() + timeout
            while time.time() < end:
                msg = browser.recv()
                if msg.get("id") == mid:
                    if "error" in msg:
                        raise RuntimeError("%s: %s" % (method, msg["error"]))
                    return msg.get("result", {})
            raise TimeoutError(method)

        def ev(expr):
            r = call("Runtime.evaluate", {"expression": expr, "returnByValue": True})
            return r.get("result", {}).get("value")

        call("Page.enable")
        call("Runtime.enable")
        call("Page.navigate", {"url": "file://" + os.path.abspath(src_html)})

        stable, last, end = 0, -1, time.time() + TIMEOUT_SECONDS
        while time.time() < end:
            time.sleep(POLL_SECONDS)
            try:
                count = ev("document.querySelectorAll('.pagedjs_page').length") or 0
            except Exception:
                count = 0
            if count and count == last:
                stable += 1
                if stable >= SETTLE_POLLS:
                    break
            else:
                stable = 0
            last = count
        else:
            raise TimeoutError("paged.js never settled; last page count %s" % last)

        heads = ev("document.querySelectorAll('.cv-runhead').length") or 0
        print("paged.js settled: %d pages, %d running heads" % (last, heads))

        result = call("Page.printToPDF", {
            "printBackground": False,
            "preferCSSPageSize": True,
            "marginTop": 0, "marginBottom": 0, "marginLeft": 0, "marginRight": 0,
        }, timeout=180)
        data = base64.b64decode(result["data"])
        with open(out_pdf, "wb") as f:
            f.write(data)
        print("wrote %s (%d bytes)" % (out_pdf, len(data)))
    finally:
        proc.kill()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: print-with-pagedjs.py <input.html> <output.pdf>")
    main(sys.argv[1], sys.argv[2])
