"""Serve only the Berlin game and its public assets for a local device check."""

import argparse
import mimetypes
import shutil
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FILES = {
    "berlin-runner.html",
    "icons/icon-192.png",
    "assets/models/berlin-coffee-sign-v1.mesh.js",
    "assets/models/berlin-runner-hero-v13.glb",
    "assets/models/berlin-runner-hero-v13.inline.js",
    "assets/models/berlin-runner-hero-v14.glb",
    "assets/models/berlin-runner-hero-v14.inline.js",
    "assets/models/berlin-runner-hero-v12.glb",
    "assets/models/berlin-runner-hero-v12.inline.js",
    "assets/img/berlin-art.inline.js",
    "assets/img/berlin-street-art-atlas-v1-1024.png",
    "assets/img/berlin-skyline-strip.png",
    "assets/img/berlin-summer-sky-v1.png",
    "assets/img/berlin-sunset-sky-v2.png",
    "data/berlin-runner-decks.js",
}


def public_path(request_path):
    name = unquote(urlsplit(request_path).path).lstrip("/") or "berlin-runner.html"
    parts = name.split("/")
    if "\\" in name or any(part in (".", "..", "") for part in parts):
        return None
    if name not in PUBLIC_FILES and not (name.startswith("data/") and name.endswith(".json")):
        return None
    candidate = (ROOT / name).resolve()
    if not candidate.is_relative_to(ROOT) or not candidate.is_file():
        return None
    return candidate


class PreviewHandler(BaseHTTPRequestHandler):
    def serve(self, body):
        path = public_path(self.path)
        if path is None:
            self.send_error(404)
            return
        with path.open("rb") as source:
            self.send_response(200)
            self.send_header("Content-Type", mimetypes.guess_type(path)[0] or "application/octet-stream")
            self.send_header("Content-Length", str(path.stat().st_size))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            if body:
                try:
                    shutil.copyfileobj(source, self.wfile)
                except (BrokenPipeError, ConnectionResetError):
                    pass

    def do_GET(self):
        self.serve(True)

    def do_HEAD(self):
        self.serve(False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", default=8766, type=int)
    args = parser.parse_args()
    with ThreadingHTTPServer((args.bind, args.port), PreviewHandler) as server:
        print(f"Berlin preview: http://{args.bind}:{args.port}/berlin-runner.html?profile=1", flush=True)
        server.serve_forever()
