CREATE TABLE IF NOT EXISTS km_chats (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(200),
  is_group    BOOLEAN DEFAULT FALSE,
  avatar      VARCHAR(10),
  description TEXT,
  created_by  BIGINT REFERENCES km_users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS km_chat_members (
  chat_id   BIGINT NOT NULL REFERENCES km_chats(id),
  user_id   BIGINT NOT NULL REFERENCES km_users(id),
  is_admin  BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  archived  BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (chat_id, user_id)
);
