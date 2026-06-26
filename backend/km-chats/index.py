"""
Чаты и участники.
GET  /          — список чатов пользователя
POST /          — создать чат (личный или групповой)
GET  /:id       — информация о чате
PUT  /:id       — обновить название/описание группы
POST /:id/members       — добавить участника
DELETE /:id/members/:uid — удалить участника (используем POST с action=remove)
POST /:id/archive       — архивировать
POST /:id/unarchive     — разархивировать
POST /:id/leave         — покинуть группу
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
        "SELECT u.id, u.name, u.role, u.initials, u.avatar_url, u.status, u.phone "
        "FROM km_users u JOIN km_sessions s ON s.user_id=u.id "
        "WHERE s.token=%s AND s.expires_at>NOW()", (token,)
    )
    return cur.fetchone()

def chat_row_to_dict(row):
    return {
        'id': row[0], 'name': row[1], 'is_group': row[2], 'avatar': row[3],
        'description': row[4], 'created_at': str(row[5]),
        'last_message': row[6], 'last_time': str(row[7]) if row[7] else None,
        'unread': row[8], 'archived': row[9],
        'members': [],
    }

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return cors('')

    method = event.get('httpMethod', 'GET')
    path   = (event.get('path') or '/').rstrip('/')
    raw    = event.get('body') or '{}'
    body   = json.loads(raw) if isinstance(raw, str) else (raw or {})
    if isinstance(body, str):
        body = json.loads(body)

    conn = psycopg2.connect(DSN)
    cur  = conn.cursor()

    try:
        user = get_user(cur, get_token(event))
        if not user:
            return cors({'ok': False, 'error': 'Не авторизован'}, 401)
        uid = user[0]

        # Парсим path: /  или  /123  или  /123/members  или  /123/archive
        parts = [p for p in path.split('/') if p]
        chat_id   = int(parts[0]) if parts and parts[0].isdigit() else None
        sub       = parts[1] if len(parts) > 1 else None

        # ── GET / — список чатов ─────────────────────────────────────────────
        if method == 'GET' and chat_id is None:
            cur.execute("""
                SELECT c.id, c.name, c.is_group, c.avatar, c.description, c.created_at,
                       m.text AS last_msg,
                       m.created_at AS last_time,
                       (SELECT COUNT(*) FROM km_messages m2
                        WHERE m2.chat_id=c.id AND m2.sender_id<>%s
                          AND m2.removed=FALSE
                          AND NOT EXISTS (SELECT 1 FROM km_message_reads r WHERE r.message_id=m2.id AND r.user_id=%s)
                       ) AS unread,
                       cm.archived
                FROM km_chats c
                JOIN km_chat_members cm ON cm.chat_id=c.id AND cm.user_id=%s
                LEFT JOIN LATERAL (
                    SELECT text, created_at FROM km_messages
                    WHERE chat_id=c.id AND removed=FALSE
                    ORDER BY created_at DESC LIMIT 1
                ) m ON TRUE
                ORDER BY COALESCE(m.created_at, c.created_at) DESC
            """, (uid, uid, uid))
            rows = cur.fetchall()
            chats = []
            for row in rows:
                chat = chat_row_to_dict(row)
                # Участники
                cur.execute(
                    "SELECT u.id, u.name, u.role, u.initials, u.avatar_url, u.phone, u.status, cm2.is_admin "
                    "FROM km_users u JOIN km_chat_members cm2 ON cm2.user_id=u.id "
                    "WHERE cm2.chat_id=%s", (chat['id'],)
                )
                chat['members'] = [
                    {'id': r[0], 'name': r[1], 'role': r[2], 'initials': r[3],
                     'avatar_url': r[4], 'phone': r[5], 'status': r[6], 'is_admin': r[7]}
                    for r in cur.fetchall()
                ]
                chats.append(chat)
            return cors({'ok': True, 'chats': chats})

        # ── POST / — создать чат ─────────────────────────────────────────────
        if method == 'POST' and chat_id is None:
            is_group   = bool(body.get('is_group', False))
            name       = (body.get('name') or '').strip()
            description = (body.get('description') or '').strip()
            member_ids  = [int(i) for i in (body.get('member_ids') or [])]

            if not is_group:
                # Личный чат: ищем существующий
                if not member_ids:
                    return cors({'ok': False, 'error': 'member_ids обязателен'}, 400)
                other = member_ids[0]
                cur.execute("""
                    SELECT c.id FROM km_chats c
                    JOIN km_chat_members cm1 ON cm1.chat_id=c.id AND cm1.user_id=%s
                    JOIN km_chat_members cm2 ON cm2.chat_id=c.id AND cm2.user_id=%s
                    WHERE c.is_group=FALSE LIMIT 1
                """, (uid, other))
                existing = cur.fetchone()
                if existing:
                    return cors({'ok': True, 'chat_id': existing[0], 'existing': True})
                # Имя = имя собеседника
                cur.execute("SELECT name, initials FROM km_users WHERE id=%s", (other,))
                u2 = cur.fetchone()
                name = u2[0] if u2 else 'Чат'
                avatar = u2[1] if u2 else '?'
                cur.execute(
                    "INSERT INTO km_chats (name, is_group, avatar, created_by) VALUES (%s,FALSE,%s,%s) RETURNING id",
                    (name, avatar, uid)
                )
                new_id = cur.fetchone()[0]
                for mid in [uid, other]:
                    cur.execute("INSERT INTO km_chat_members (chat_id, user_id, is_admin) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING", (new_id, mid, mid == uid))
            else:
                if not name:
                    return cors({'ok': False, 'error': 'name обязателен для группы'}, 400)
                avatar = ''.join(w[0].upper() for w in name.split()[:2])
                cur.execute(
                    "INSERT INTO km_chats (name, is_group, avatar, description, created_by) VALUES (%s,TRUE,%s,%s,%s) RETURNING id",
                    (name, avatar, description or None, uid)
                )
                new_id = cur.fetchone()[0]
                all_members = list(set([uid] + member_ids))
                for mid in all_members:
                    cur.execute("INSERT INTO km_chat_members (chat_id, user_id, is_admin) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING", (new_id, mid, mid == uid))

            conn.commit()
            return cors({'ok': True, 'chat_id': new_id})

        # ── Действия над конкретным чатом ────────────────────────────────────
        if chat_id is None:
            return cors({'ok': False, 'error': 'Not found'}, 404)

        # Проверяем членство
        cur.execute("SELECT is_admin FROM km_chat_members WHERE chat_id=%s AND user_id=%s", (chat_id, uid))
        membership = cur.fetchone()
        if not membership:
            return cors({'ok': False, 'error': 'Нет доступа'}, 403)

        if sub == 'archive' and method == 'POST':
            cur.execute("UPDATE km_chat_members SET archived=TRUE WHERE chat_id=%s AND user_id=%s", (chat_id, uid))
            conn.commit()
            return cors({'ok': True})

        if sub == 'unarchive' and method == 'POST':
            cur.execute("UPDATE km_chat_members SET archived=FALSE WHERE chat_id=%s AND user_id=%s", (chat_id, uid))
            conn.commit()
            return cors({'ok': True})

        if sub == 'members' and method == 'POST':
            add_id = int(body.get('user_id', 0))
            if not add_id:
                return cors({'ok': False, 'error': 'user_id обязателен'}, 400)
            cur.execute("INSERT INTO km_chat_members (chat_id, user_id) VALUES (%s,%s) ON CONFLICT DO NOTHING", (chat_id, add_id))
            conn.commit()
            return cors({'ok': True})

        if sub == 'members' and method == 'PUT':
            # action=remove
            remove_id = int(body.get('user_id', 0))
            if not remove_id:
                return cors({'ok': False, 'error': 'user_id обязателен'}, 400)
            if remove_id != uid and not membership[0]:
                return cors({'ok': False, 'error': 'Только администратор может удалять'}, 403)
            cur.execute("UPDATE km_chat_members SET archived=TRUE WHERE chat_id=%s AND user_id=%s", (chat_id, remove_id))
            conn.commit()
            return cors({'ok': True})

        if sub == 'leave' and method == 'POST':
            cur.execute("UPDATE km_chat_members SET archived=TRUE WHERE chat_id=%s AND user_id=%s", (chat_id, uid))
            conn.commit()
            return cors({'ok': True})

        if method == 'PUT' and sub is None:
            name = body.get('name')
            desc = body.get('description')
            if name:
                cur.execute("UPDATE km_chats SET name=%s WHERE id=%s", (name, chat_id))
            if desc is not None:
                cur.execute("UPDATE km_chats SET description=%s WHERE id=%s", (desc, chat_id))
            conn.commit()
            return cors({'ok': True})

        return cors({'ok': False, 'error': 'Not found'}, 404)

    finally:
        cur.close()
        conn.close()
