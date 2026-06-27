#!/usr/bin/env python3
"""Dev server for the Artikel Runner web export.

Plain `python -m http.server` lets the browser cache the large .wasm/.pck
files, so a freshly re-exported build keeps showing the old version. This
server sends `Cache-Control: no-store` on every response so each reload
always fetches the current files.

Usage:  python godot-runner/serve.py [port]   (default port 8000)
Then open http://localhost:<port>/
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    os.chdir(ROOT)
    with http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"Serving {ROOT} at http://localhost:{PORT}/ (no-cache)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")
