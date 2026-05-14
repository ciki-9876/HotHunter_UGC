"""
serve.py — HotHunter UGC 画布产品前端服务
  - 静态服务 dist/ (React SPA)
  - /api/* 反向代理到 Flask 后端 (port 8068)
  - SPA fallback: 所有非 /api/* 的路径返回 index.html
端口: 8099
"""
import os
import threading
from flask import Flask, send_from_directory, request, Response
import requests

DIST_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')
FLASK_API = 'http://127.0.0.1:8068'

app = Flask(__name__, static_folder=DIST_DIR, static_url_path='')


@app.after_request
def _cors(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


# ── /api/* 反向代理到 Flask 后端 ────────────────────────────────────
@app.route('/api/<path:path>', methods=['GET','POST','PUT','PATCH','DELETE','OPTIONS'])
def proxy_api(path):
    if request.method == 'OPTIONS':
        return '', 204
    url = f'{FLASK_API}/api/{path}'
    headers = {k: v for k, v in request.headers if k.lower() not in ('host', 'content-length')}
    try:
        resp = requests.request(
            method=request.method, url=url, headers=headers,
            params=request.args, data=request.get_data(),
            stream=True, timeout=300
        )
        # 过滤 hop-by-hop headers
        skip = {'transfer-encoding', 'content-encoding', 'connection'}
        out_headers = [(k, v) for k, v in resp.headers.items() if k.lower() not in skip]
        return Response(resp.iter_content(chunk_size=8192),
                        status=resp.status_code, headers=out_headers)
    except Exception as e:
        return {'ok': False, 'error': str(e)}, 502


# ── SPA fallback ───────────────────────────────────────────────────
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def spa(path):
    # 先尝试静态文件
    file_path = os.path.join(DIST_DIR, path)
    if path and os.path.isfile(file_path):
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, 'index.html')


if __name__ == '__main__':
    print(f'[serve] dist: {DIST_DIR}')
    print(f'[serve] api proxy -> {FLASK_API}')
    print('[serve] listening on 0.0.0.0:8099')
    app.run(host='0.0.0.0', port=8099, debug=False, threaded=True)
