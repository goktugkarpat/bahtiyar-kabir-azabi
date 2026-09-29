#!/usr/bin/env python3
"""Serve only this game on the local network; no dependencies or file uploads."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
from functools import partial

parser = argparse.ArgumentParser(description='Kabir Azabı yerel oyun sunucusu')
parser.add_argument('--port', type=int, default=8787)
parser.add_argument('--host', default='0.0.0.0')
args = parser.parse_args()
root = str(Path(__file__).resolve().parent)
server = ThreadingHTTPServer((args.host, args.port), partial(SimpleHTTPRequestHandler, directory=root))
print(f'Kabir Azabı: http://localhost:{args.port}', flush=True)
print('Durdurmak için Ctrl+C. Aynı Wi-Fi üzerindeki tablet, bu bilgisayarın yerel IP adresiyle bağlanabilir.', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    server.server_close()
