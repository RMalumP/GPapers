# Google Drive y acceso de Google simulados para las pruebas (prueba_sync.py y prueba_proyectos.py)
import json, time, urllib.parse
import hashlib, itertools
STORE = {'otra': {'name': 'supc1-sync.json', 'content': '{}', 'parents': ['appDataFolder'], 'mt': '2026-01-01T00:00:00.000Z'}}   # Drive simulado: id -> archivo (uno de otra web del mismo proyecto)
CALLS = []; UPS = {}; SEQ = itertools.count(1)
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type, x-upload-content-type', 'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE', 'access-control-expose-headers': 'Location'}
now = lambda: time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())
meta = lambda i: {'id': i, 'name': STORE[i]['name'], 'md5Checksum': hashlib.md5(STORE[i]['content'].encode()).hexdigest(), 'modifiedTime': STORE[i]['mt'], 'size': str(len(STORE[i]['content'].encode()))}
def drive(route, req):
    u = urllib.parse.urlparse(req.url); m = req.method; p = u.path; q = urllib.parse.parse_qs(u.query)
    ok = lambda j, h={}: route.fulfill(status=200, headers={**CORS, 'content-type': 'application/json', **h}, body=json.dumps(j))
    if m == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    if m == 'PUT' and 'upload_id' in q:   # segunda mitad de la subida reanudable (la dirección ya va autorizada)
        up = UPS.pop(q['upload_id'][0]); i = up['id'] or 'f%d' % next(SEQ)
        if not up['id']: STORE[i] = {'name': up['name'], 'parents': up['parents']}
        STORE[i].update(content=req.post_data, mt=now()); CALLS.append(('PUT-reanudable', STORE[i]['name'])); return ok(meta(i))
    if req.headers.get('authorization') != 'Bearer tok': return route.fulfill(status=401, headers=CORS, body='{}')
    CALLS.append((m, p, q.get('uploadType', [''])[0], q.get('alt', [''])[0]))
    if m == 'GET' and p == '/drive/v3/files':
        sub = q['q'][0].split("'")[1] if 'q' in q else ''
        return ok({'files': [meta(i) for i in STORE if sub in STORE[i]['name']]})
    if m == 'GET' and p == '/drive/v3/about': return ok({'user': {'emailAddress': 'yo@example.com'}})
    if m == 'GET' and p.startswith('/drive/v3/files/'): return route.fulfill(status=200, headers={**CORS, 'content-type': 'application/json'}, body=STORE[p.split('/')[-1]]['content'])
    if q.get('uploadType') == ['resumable']:
        i = p.split('/')[-1] if m == 'PATCH' else None; md = json.loads(req.post_data or '{}'); k = str(next(SEQ))
        UPS[k] = {'id': i, 'name': md.get('name'), 'parents': md.get('parents')}
        return ok({}, {'location': 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=' + k})
    if m == 'PATCH' and p.startswith('/upload/drive/v3/files/'): i = p.split('/')[-1]; STORE[i].update(content=req.post_data, mt=now()); return ok(meta(i))
    if m == 'POST' and p == '/upload/drive/v3/files':
        bnd = req.headers['content-type'].split('boundary=')[1]
        parts = [x.split('\r\n\r\n', 1)[1] for x in req.post_data.split('--' + bnd) if '\r\n\r\n' in x]
        md = json.loads(parts[0].strip()); i = 'f%d' % next(SEQ); STORE[i] = {'name': md['name'], 'content': parts[1][:-2] if parts[1].endswith('\r\n') else parts[1], 'parents': md['parents'], 'mt': now()}; return ok(meta(i))
    if m == 'DELETE' and p.startswith('/drive/v3/files/'): STORE.pop(p.split('/')[-1], None); return route.fulfill(status=204, headers=CORS)
    return route.fulfill(status=404, headers=CORS, body='{}')
GOOGLE = """window.google = {accounts: {oauth2: {initTokenClient: c => ({requestAccessToken: o => { window.__tok = (window.__tok || 0) + 1; window.__cid = c.client_id;
  setTimeout(() => window.__deny ? c.error_callback({type: 'popup_failed_to_open'}) : c.callback({access_token: 'tok', expires_in: 3600}), 5); }}), revoke: (t, cb) => cb && cb()}}};"""
names = lambda pre='gpapers-': sorted(f['name'] for f in STORE.values() if f['name'].startswith(pre))
deltas = lambda: [f for f in STORE.values() if f['name'].startswith('gpapers-d-')]
PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
