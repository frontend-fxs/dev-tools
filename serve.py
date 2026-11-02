"""Sirve la carpeta del proyecto en local y abre el navegador."""

from __future__ import annotations

import http.server
import socketserver
import sys
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **getattr(http.server.SimpleHTTPRequestHandler, "extensions_map", {}),
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json",
        ".svg": "image/svg+xml",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)


def main() -> None:
    open_browser = "--no-open" not in sys.argv
    socketserver.TCPServer.allow_reuse_address = True
    for port in range(8765, 8775):
        try:
            server = socketserver.TCPServer((HOST, port), Handler)
        except OSError:
            continue
        url = f"http://{HOST}:{port}/"
        print(url)
        print("Ctrl+C para parar")
        if open_browser:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nparado")
        finally:
            server.server_close()
        return
    raise SystemExit("No hay un puerto libre entre 8765 y 8774.")


if __name__ == "__main__":
    main()
