-- ==============================================================================
-- InstaSend Database Seed File
-- Pre-encrypted User Accounts & Admin Setup for SQLite3 (node:sqlite)
-- 
-- Password Hashing Standard:
-- Algorithm: scrypt (crypto.scryptSync)
-- Key Length: 64 bytes (128 hex chars)
-- Salt: 16 random bytes (32 hex chars)
-- Verification: Constant-time comparison via crypto.timingSafeEqual
-- ==============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. Create Tables
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

-- 2. Insert Admin Account
-- Username / Email: admin (or admin@instasend.io)
-- Raw Password:     1@3$5^7*9
-- Salt:             a1b2c3d4e5f67890123456789abcdef0
-- Hash (scrypt):    df015cc16b5cfa9c64f9fc6ea9d722621108155140d6d4cae423a436a84190ff841c5572c00fa3636f6f366314d78d840fbe29ae2206f11223fe08d390b879b5
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

-- 3. Insert Demo Account (Pro)
-- Username / Email: alex.rivera@instasend.io
-- Raw Password:     InstaSend2026!
-- Salt:             c3d4e5f6a1b27890123456789abcdef2
-- Hash (scrypt):    78a717a1aa60a54c025a5364aeebd4153e300a91cdceebd7d514a01f36d8c850cfca6238c02e117a734451a958468d647ea0187f68889e6eb70e374ebae005c4
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

-- 4. Insert Test Accounts for Pre-deployment Verification
-- Account A: Sarah Chen (Pro User)
-- Password:   TestPass2026!
-- Salt:       b2c3d4e5f6a17890123456789abcdef1
-- Hash:       6b02671e7d8cfe0db8c7ce50f3a103a7e57ae781bb3c64a3be44017183d793d8b08700d74e6c72cc4781bb20f7c2335b31468c62bc601c0769e0b090d663f8f7
INSERT OR REPLACE INTO users (
  id, email, name, password_hash, salt, avatar, role, plan,
  total_uploads, total_bytes_sent, total_bytes_received, created_at, updated_at
) VALUES (
  'usr_test_sarah_chen',
  'sarah.chen@techcorp.local',
  'Sarah Chen',
  '6b02671e7d8cfe0db8c7ce50f3a103a7e57ae781bb3c64a3be44017183d793d8b08700d74e6c72cc4781bb20f7c2335b31468c62bc601c0769e0b090d663f8f7',
  'b2c3d4e5f6a17890123456789abcdef1',
  'https://api.dicebear.com/7.x/identicon/svg?seed=Sarah',
  'user',
  'pro',
  15,
  450000000,
  120000000,
  1769000000000,
  1769300000000
);

-- Account B: David Lan (Free User)
-- Password:   TestPass2026!
INSERT OR REPLACE INTO users (
  id, email, name, password_hash, salt, avatar, role, plan,
  total_uploads, total_bytes_sent, total_bytes_received, created_at, updated_at
) VALUES (
  'usr_test_david_lan',
  'david.lan@home.net',
  'David Lan',
  '6b02671e7d8cfe0db8c7ce50f3a103a7e57ae781bb3c64a3be44017183d793d8b08700d74e6c72cc4781bb20f7c2335b31468c62bc601c0769e0b090d663f8f7',
  'b2c3d4e5f6a17890123456789abcdef1',
  'https://api.dicebear.com/7.x/identicon/svg?seed=David',
  'user',
  'free',
  3,
  45000000,
  82000000,
  1769100000000,
  1769300000000
);

-- Account C: QA Tester (Secondary Admin)
-- Password:   TestPass2026!
INSERT OR REPLACE INTO users (
  id, email, name, password_hash, salt, avatar, role, plan,
  total_uploads, total_bytes_sent, total_bytes_received, created_at, updated_at
) VALUES (
  'usr_test_qa_admin',
  'qa.tester@instasend.io',
  'QA Test Manager',
  '6b02671e7d8cfe0db8c7ce50f3a103a7e57ae781bb3c64a3be44017183d793d8b08700d74e6c72cc4781bb20f7c2335b31468c62bc601c0769e0b090d663f8f7',
  'b2c3d4e5f6a17890123456789abcdef1',
  'https://api.dicebear.com/7.x/identicon/svg?seed=QA',
  'admin',
  'pro',
  50,
  2100000000,
  1500000000,
  1768800000000,
  1769300000000
);
