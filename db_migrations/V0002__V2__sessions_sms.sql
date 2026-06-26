CREATE TABLE IF NOT EXISTS km_sessions (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES km_users(id),
  token      VARCHAR(64) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

CREATE TABLE IF NOT EXISTS km_sms_codes (
  id         BIGSERIAL PRIMARY KEY,
  phone      VARCHAR(20) NOT NULL,
  code       VARCHAR(4) NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',
  used       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
