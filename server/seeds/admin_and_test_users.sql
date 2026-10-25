-- ==============================================================================
-- InstaSend Database Seed File (Server Seeds Copy)
-- ==============================================================================
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE COLLATE NOCASE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  avatar TEXT,
  role TEXT DEFAULT 'user',
  plan TEXT DEFAULT 'free',
  total_uploads INTEGER DEFAULT 0,
  total_bytes_sent INTEGER DEFAULT 0,
  total_bytes_received INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Insert Admin Account (admin / 1@3$5^7*9)
INSERT OR REPLACE INTO users (
  id, email, name, password_hash, salt, avatar, role, plan,
  total_uploads, total_bytes_sent, total_bytes_received, created_at, updated_at
) VALUES (
  'usr_admin_system',
  'admin',
  'System Administrator',
  'df015cc16b5cfa9c64f9fc6ea9d722621108155140d6d4cae423a436a84190ff841c5572c00fa3636f6f366314d78d840fbe29ae2206f11223fe08d390b879b5',
  'a1b2c3d4e5f67890123456789abcdef0',
  'https://api.dicebear.com/7.x/identicon/svg?seed=Admin',
  'admin',
  'pro',
  142,
  5683281920,
  3271557120,
  1768400000000,
  1769300000000
);

-- Insert Demo Account (alex.rivera@instasend.io / InstaSend2026!)
INSERT OR REPLACE INTO users (
  id, email, name, password_hash, salt, avatar, role, plan,
  total_uploads, total_bytes_sent, total_bytes_received, created_at, updated_at
) VALUES (
  'usr_alex_rivera_demo',
  'alex.rivera@instasend.io',
  'Alex Rivera',
  '78a717a1aa60a54c025a5364aeebd4153e300a91cdceebd7d514a01f36d8c850cfca6238c02e117a734451a958468d647ea0187f68889e6eb70e374ebae005c4',
  'c3d4e5f6a1b27890123456789abcdef2',
  'https://api.dicebear.com/7.x/identicon/svg?seed=Alex',
  'user',
  'pro',
  28,
  880803840,
  429916160,
  1768900000000,
  1769300000000
);
