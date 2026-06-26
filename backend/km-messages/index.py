"""
Сообщения.
GET  /:chat_id          — история (с пагинацией)
POST /:chat_id          — отправить сообщение
PUT  /:chat_id/:msg_id  — редактировать
POST /:chat_id/:msg_id/read   — отметить прочитанным
POST /:chat_id/:msg_id/remove — удалить (soft)
"""
import json, os, psycopg2

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

def get_user(cur, token):
    cur.execute(
        "SELECT u.id, u.name, u.initials, u.avatar_url "
        "FROM km_users u JOIN km_sessions s ON s.user_id=u.id "
        "WHERE s.token=%s AND s.expires_at>NOW()", (token,)
    )
    return cur.fetchone()

def msg_to_dict(row, cols):
    d = dict(zip(cols, row))
    d['created_at'] = str(d['created_at'])
    if d.get('edited_at'):
        d['edited_at'] = str(d['edited_at'])
    return d

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
        user = get_user(cur, get_token(event))
        if not user:
            return cors({'ok': False, 'error': 'Не авторизован'}, 401)
        uid = user[0]

        parts  = [p for p in path.split('/') if p]
        chat_id = int(parts[0]) if parts and parts[0].isdigit() else None
        msg_id  = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else None
        sub     = parts[2] if len(parts) > 2 else None

        if chat_id is None:
            return cors({'ok': False, 'error': 'Не авторизован'}, 401)

        # Проверяем членство
        cur.execute("SELECT 1 FROM km_chat_members WHERE chat_id=%s AND user_id=%s", (chat_id, uid))
        if not cur.fetchone():
            return cors({'ok': False, 'error': 'Нет доступа'}, 403)

        # ── GET /:chat_id — история ──────────────────────────────────────────
        if method == 'GET' and msg_id is None:
            limit  = min(int(qs.get('limit', 50)), 100)
            before = qs.get('before')

            sql = """
                SELECT m.id, m.chat_id, m.sender_id, m.text,
                       m.media_type, m.media_url, m.media_name,
                       m.reply_to_id, m.removed, m.edited_at, m.created_at,
                       u.name AS sender_name, u.initials AS sender_initials, u.avatar_url AS sender_avatar,
                       (SELECT COUNT(*) FROM km_message_reads r WHERE r.message_id=m.id) AS reads
                FROM km_messages m
                JOIN km_users u ON u.id=m.sender_id
                WHERE m.chat_id=%s
            """
            params = [chat_id]
            if before:
                sql += " AND m.created_at < %s"
                params.append(before)
            sql += " ORDER BY m.created_at DESC LIMIT %s"
            params.append(limit)

            cur.execute(sql, params)
            cols = [d[0] for d in cur.description]
            msgs = [msg_to_dict(r, cols) for r in cur.fetchall()]
            msgs.reverse()

            # Отметить как прочитанные все входящие
            cur.execute("""
                INSERT INTO km_message_reads (message_id, user_id)
                SELECT m.id, %s FROM km_messages m
                WHERE m.chat_id=%s AND m.sender_id<>%s AND m.removed=FALSE
                  AND NOT EXISTS (SELECT 1 FROM km_message_reads r WHERE r.message_id=m.id AND r.user_id=%s)
                ON CONFLICT DO NOTHING
            """, (uid, chat_id, uid, uid))
            conn.commit()

            return cors({'ok': True, 'messages': msgs})

        # ── POST /:chat_id — отправить ───────────────────────────────────────
        if method == 'POST' and msg_id is None:
            text        = (body.get('text') or '').strip()
            media_type  = body.get('media_type')
            media_url   = body.get('media_url')
            media_name  = body.get('media_name')
            reply_to_id = body.get('reply_to_id')

            if not text and not media_url:
                return cors({'ok': False, 'error': 'text или media_url обязателен'}, 400)

            cur.execute(
                "INSERT INTO km_messages (chat_id, sender_id, text, media_type, media_url, media_name, reply_to_id) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id, created_at",
                (chat_id, uid, text, media_type, media_url, media_name, reply_to_id)
            )
            row = cur.fetchone()
            # Авто-прочтение для отправителя
            cur.execute(
                "INSERT INTO km_message_reads (message_id, user_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",
                (row[0], uid)
            )
            conn.commit()
            return cors({'ok': True, 'id': row[0], 'created_at': str(row[1])})

        if msg_id is None:
            return cors({'ok': False, 'error': 'msg_id обязателен'}, 400)

        # ── POST /:chat_id/:msg_id/read ──────────────────────────────────────
        if sub == 'read' and method == 'POST':
            cur.execute(
                "INSERT INTO km_message_reads (message_id, user_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",
                (msg_id, uid)
            )
            conn.commit()
            return cors({'ok': True})

        # ── POST /:chat_id/:msg_id/remove ────────────────────────────────────
        if sub == 'remove' and method == 'POST':
            cur.execute("SELECT sender_id FROM km_messages WHERE id=%s AND chat_id=%s", (msg_id, chat_id))
            msg = cur.fetchone()
            if not msg:
                return cors({'ok': False, 'error': 'Сообщение не найдено'}, 404)
            if msg[0] != uid:
                return cors({'ok': False, 'error': 'Нельзя удалить чужое сообщение'}, 403)
            cur.execute("UPDATE km_messages SET removed=TRUE, text='' WHERE id=%s", (msg_id,))
            conn.commit()
            return cors({'ok': True})

        # ── PUT /:chat_id/:msg_id — редактировать ────────────────────────────
        if method == 'PUT':
            cur.execute("SELECT sender_id FROM km_messages WHERE id=%s AND chat_id=%s", (msg_id, chat_id))
            msg = cur.fetchone()
            if not msg:
                return cors({'ok': False, 'error': 'Сообщение не найдено'}, 404)
            if msg[0] != uid:
                return cors({'ok': False, 'error': 'Нельзя редактировать чужое сообщение'}, 403)
            new_text = (body.get('text') or '').strip()
            cur.execute(
                "UPDATE km_messages SET text=%s, edited_at=NOW() WHERE id=%s",
                (new_text, msg_id)
            )
            conn.commit()
            return cors({'ok': True})

        return cors({'ok': False, 'error': 'Not found'}, 404)

    finally:
        cur.close()
        conn.close()