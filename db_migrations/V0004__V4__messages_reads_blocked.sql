CREATE TABLE IF NOT EXISTS km_messages (
  id          BIGSERIAL PRIMARY KEY,
  chat_id     BIGINT NOT NULL REFERENCES km_chats(id),
  sender_id   BIGINT NOT NULL REFERENCES km_users(id),
  text        TEXT DEFAULT '',
  media_type  VARCHAR(20),
  media_url   TEXT,
  media_name  TEXT,
  reply_to_id BIGINT REFERENCES km_messages(id),
  removed     BOOLEAN DEFAULT FALSE,
  edited_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS km_message_reads (
  message_id BIGINT NOT NULL REFERENCES km_messages(id),
  user_id    BIGINT NOT NULL REFERENCES km_users(id),
  read_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS km_blocked_users (
  blocker_id BIGINT NOT NULL REFERENCES km_users(id),
  blocked_id BIGINT NOT NULL REFERENCES km_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_km_messages_chat  ON km_messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_km_members_user   ON km_chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_km_sessions_token ON km_sessions(token);
CREATE INDEX IF NOT EXISTS idx_km_sms_phone      ON km_sms_codes(phone, created_at DESC);
