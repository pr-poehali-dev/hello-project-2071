CREATE TABLE IF NOT EXISTS km_users (
  id         BIGSERIAL PRIMARY KEY,
  phone      VARCHAR(20) UNIQUE NOT NULL,
  name       VARCHAR(100) NOT NULL,
  role       VARCHAR(100) DEFAULT 'Сотрудник',
  initials   VARCHAR(4) NOT NULL,
  avatar_url TEXT,
  status     VARCHAR(100) DEFAULT 'В сети',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen  TIMESTAMPTZ DEFAULT NOW()
);
