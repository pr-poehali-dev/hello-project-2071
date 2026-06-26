"""
Пользователи/контакты.
GET /        — список всех пользователей (справочник)
GET /search  — поиск по имени/телефону
POST /block  — заблокировать/разблокировать
GET /blocked — список заблокированных
"""
import json, os, psycopg2

DSN = os.environ['DATABASE_URL']

def cors(body, status=200):
    return {
        'statusCode': status,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
            'Content-Type': 'application/json',
        },
        'body': json.dumps(body, ensure_ascii=False, default=str),
    }

def get_token(event):
    h = event.get('headers') or {}
    return h.get('X-Auth-Token') or h.get('x-auth-token') or h.get('X-Authorization', '').replace('Bearer ', '')

def get_uid(cur, token):
    cur.execute(
        "SELECT u.id FROM km_users u JOIN km_sessions s ON s.user_id=u.id "
        "WHERE s.token=%s AND s.expires_at>NOW()", (token,)
    )
    r = cur.fetchone()
    return r[0] if r else None

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return cors('')

    method = event.get('httpMethod', 'GET')
    path   = (event.get('path') or '/').rstrip('/')
    raw    = event.get('body') or '{}'
    body   = json.loads(raw) if isinstance(raw, str) else (raw or {})
    if isinstance(body, str):
        body = json.loads(body)
    qs = event.get('queryStringParameters') or {}

    conn = psycopg2.connect(DSN)
    cur  = conn.cursor()

    try:
        uid = get_uid(cur, get_token(event))
        if not uid:
            return cors({'ok': False, 'error': 'Не авторизован'}, 401)

        parts = [p for p in path.split('/') if p]
        sub   = parts[0] if parts else None

        # ── GET /search ───────────────────────────────────────────────────────
        if sub == 'search' and method == 'GET':
            q = (qs.get('q') or '').strip()
            if not q:
                return cors({'ok': True, 'users': []})
            like = f'%{q}%'
            cur.execute(
                "SELECT id, name, role, initials, avatar_url, phone, status "
                "FROM km_users WHERE id<>%s AND (name ILIKE %s OR phone ILIKE %s) LIMIT 20",
                (uid, like, like)
            )
            cols = ['id', 'name', 'role', 'initials', 'avatar_url', 'phone', 'status']
            return cors({'ok': True, 'users': [dict(zip(cols, r)) for r in cur.fetchall()]})

        # ── GET /blocked ──────────────────────────────────────────────────────
        if sub == 'blocked' and method == 'GET':
            cur.execute(
                "SELECT u.id, u.name, u.role, u.initials, u.avatar_url, u.phone "
                "FROM km_blocked_users b JOIN km_users u ON u.id=b.blocked_id WHERE b.blocker_id=%s", (uid,)
            )
            cols = ['id', 'name', 'role', 'initials', 'avatar_url', 'phone']
            return cors({'ok': True, 'users': [dict(zip(cols, r)) for r in cur.fetchall()]})

        # ── POST /block ───────────────────────────────────────────────────────
        if sub == 'block' and method == 'POST':
            target = int(body.get('user_id', 0))
            action = body.get('action', 'block')
            if not target:
                return cors({'ok': False, 'error': 'user_id обязателен'}, 400)
            if action == 'unblock':
                cur.execute("UPDATE km_blocked_users SET blocker_id=%s WHERE blocker_id=%s AND blocked_id=%s",
                            (uid, uid, target))
                # soft: просто помечаем через SELECT + условие
                cur.execute(
                    "DELETE FROM km_blocked_users WHERE blocker_id=%s AND blocked_id=%s",
                    (uid, target)
                )
            else:
                cur.execute(
                    "INSERT INTO km_blocked_users (blocker_id, blocked_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",
                    (uid, target)
                )
            conn.commit()
            return cors({'ok': True})

        # ── GET / — все пользователи ──────────────────────────────────────────
        if method == 'GET':
            cur.execute(
                "SELECT id, name, role, initials, avatar_url, phone, status "
                "FROM km_users WHERE id<>%s ORDER BY name LIMIT 200", (uid,)
            )
            cols = ['id', 'name', 'role', 'initials', 'avatar_url', 'phone', 'status']
            return cors({'ok': True, 'users': [dict(zip(cols, r)) for r in cur.fetchall()]})

        return cors({'ok': False, 'error': 'Not found'}, 404)

    finally:
        cur.close()
        conn.close()
