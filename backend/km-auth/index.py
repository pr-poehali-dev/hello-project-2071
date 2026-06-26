"""
Аутентификация: отправка SMS-кода, верификация, получение профиля.
POST /send-code  { phone }
POST /verify     { phone, code }
GET  /me         (X-Auth-Token: token)
PUT  /me         { name, role, status, avatar_url }
"""
import json, os, secrets, psycopg2, urllib.request, urllib.parse
from datetime import datetime

DSN = os.environ['DATABASE_URL']

def cors(body, status=200):
    return {
        'statusCode': status,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
            'Content-Type': 'application/json',
        },
        'body': json.dumps(body, ensure_ascii=False, default=str),
    }

def get_token(event):
    h = event.get('headers') or {}
    return h.get('X-Auth-Token') or h.get('x-auth-token') or h.get('X-Authorization', '').replace('Bearer ', '')

def get_user_by_token(cur, token):
    cur.execute(
        "SELECT u.* FROM km_users u JOIN km_sessions s ON s.user_id = u.id "
        "WHERE s.token = %s AND s.expires_at > NOW()", (token,)
    )
    return cur.fetchone()

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return cors('')

    method = event.get('httpMethod', 'GET')
    path   = event.get('path', '/')
    raw    = event.get('body') or '{}'
    body   = json.loads(raw) if isinstance(raw, str) else (raw or {})
    if isinstance(body, str):
        body = json.loads(body)

    conn = psycopg2.connect(DSN)
    cur  = conn.cursor()

    try:
        # ── POST /send-code ──────────────────────────────────────────────────
        if method == 'POST' and path.endswith('/send-code'):
            phone = (body.get('phone') or '').strip()
            digits = ''.join(c for c in phone if c.isdigit())
            if len(digits) < 11:
                return cors({'ok': False, 'error': 'Некорректный номер'}, 400)

            code = str(10000 + int(secrets.token_hex(2), 16))[-4:]
            cur.execute(
                "INSERT INTO km_sms_codes (phone, code) VALUES (%s, %s)",
                (digits, code)
            )
            conn.commit()

            api_key = os.environ.get('SMSRU_API_KEY', '')
            demo = not api_key
            if api_key:
                params = urllib.parse.urlencode({
                    'api_id': api_key, 'to': digits,
                    'msg': f'КорпМессенджер: ваш код — {code}', 'json': 1,
                })
                try:
                    with urllib.request.urlopen(f'https://sms.ru/sms/send?{params}', timeout=8) as r:
                        result = json.loads(r.read())
                    sms_ok = result.get('sms', {}).get(digits, {}).get('status_code') == 100
                    if not sms_ok:
                        demo = True
                except Exception:
                    demo = True

            resp = {'ok': True, 'demo': demo}
            if demo:
                resp['code'] = code
            return cors(resp)

        # ── POST /verify ─────────────────────────────────────────────────────
        if method == 'POST' and path.endswith('/verify'):
            phone = ''.join(c for c in (body.get('phone') or '') if c.isdigit())
            code  = (body.get('code') or '').strip()
            name  = (body.get('name') or '').strip()
            role  = (body.get('role') or 'Сотрудник').strip()

            if not phone or not code:
                return cors({'ok': False, 'error': 'phone и code обязательны'}, 400)

            cur.execute(
                "SELECT id FROM km_sms_codes WHERE phone=%s AND code=%s "
                "AND used=FALSE AND expires_at>NOW() ORDER BY id DESC LIMIT 1",
                (phone, code)
            )
            row = cur.fetchone()
            if not row:
                return cors({'ok': False, 'error': 'Неверный или устаревший код'}, 401)

            cur.execute("UPDATE km_sms_codes SET used=TRUE WHERE id=%s", (row[0],))

            # Найти или создать пользователя
            cur.execute("SELECT id, name, role, initials, avatar_url, status FROM km_users WHERE phone=%s", (phone,))
            user = cur.fetchone()
            if not user:
                if not name:
                    conn.commit()
                    return cors({'ok': False, 'need_name': True}, 200)
                initials = ''.join(w[0].upper() for w in name.split()[:2])
                cur.execute(
                    "INSERT INTO km_users (phone, name, role, initials) VALUES (%s,%s,%s,%s) RETURNING id, name, role, initials, avatar_url, status",
                    (phone, name, role, initials)
                )
                user = cur.fetchone()

            user_id = user[0]
            token = secrets.token_hex(32)
            cur.execute(
                "INSERT INTO km_sessions (user_id, token) VALUES (%s, %s)",
                (user_id, token)
            )
            conn.commit()
            return cors({
                'ok': True, 'token': token,
                'user': {'id': user[0], 'name': user[1], 'role': user[2],
                         'initials': user[3], 'avatar_url': user[4], 'status': user[5], 'phone': phone}
            })

        # ── GET /me ───────────────────────────────────────────────────────────
        if method == 'GET' and path.endswith('/me'):
            user = get_user_by_token(cur, get_token(event))
            if not user:
                return cors({'ok': False, 'error': 'Не авторизован'}, 401)
            cols = ['id','phone','name','role','initials','avatar_url','status','created_at','last_seen']
            return cors({'ok': True, 'user': dict(zip(cols, user))})

        # ── PUT /me ───────────────────────────────────────────────────────────
        if method == 'PUT' and path.endswith('/me'):
            user = get_user_by_token(cur, get_token(event))
            if not user:
                return cors({'ok': False, 'error': 'Не авторизован'}, 401)
            name       = body.get('name', user[2])
            role       = body.get('role', user[3])
            status     = body.get('status', user[6])
            avatar_url = body.get('avatar_url', user[5])
            initials   = ''.join(w[0].upper() for w in (name or '').split()[:2]) or user[4]
            cur.execute(
                "UPDATE km_users SET name=%s, role=%s, status=%s, avatar_url=%s, initials=%s WHERE id=%s",
                (name, role, status, avatar_url, initials, user[0])
            )
            conn.commit()
            return cors({'ok': True})

        return cors({'ok': False, 'error': 'Not found'}, 404)

    finally:
        cur.close()
        conn.close()
