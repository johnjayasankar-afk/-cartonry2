#!/usr/bin/env python3
"""Local preview server.

Plain `http.server` lets the browser cache ES modules aggressively, so an edit
to src/*.js can silently not appear. This serves everything no-store, and sets
the same security headers the production _headers file applies, so what is
tested locally behaves like what ships.
"""
import functools
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))   # serve this folder, wherever it is run from

CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
       "img-src 'self' data:; connect-src 'self' https://api.lemonsqueezy.com "
       "https://api.polar.sh; form-action 'none'; base-uri 'none'; object-src 'none'")

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header('Content-Security-Policy', CSP)
        super().end_headers()

    def log_message(self, fmt, *args):      # keep the console quiet
        pass

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8931
    print(f'Cartonry dev server on http://localhost:{port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
