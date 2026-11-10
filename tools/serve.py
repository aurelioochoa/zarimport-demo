"""Servidor local para probar el prototipo sin caché: python tools/serve.py [puerto]"""
import sys, http.server, functools, os
os.chdir(os.path.join(os.path.dirname(__file__), '..'))
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
