import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
const DB_PATH = path.resolve(DATA_DIR, 'instasend.db');

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  salt: string;
  avatar: string | null;
  role: 'admin' | 'user';
  plan: 'free' | 'pro';
  total_uploads: number;
  total_bytes_sent: number;
  total_bytes_received: number;
  created_at: number;
  updated_at: number;
}

export interface SessionRow {
  token: string;
  user_id: string;
  device_name: string | null;
  created_at: number;
  last_active_at: number;
}

export interface SanitizedUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'user';
  plan: 'free' | 'pro';
  totalUploads: number;
  totalBytesSent: number;
  totalBytesReceived: number;
  createdAt: number;
  deviceToken?: string;
}

class SQLiteAuthService {
  private db: DatabaseSync;
  private isInitialized = false;

  constructor() {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    this.db = new DatabaseSync(DB_PATH);
    this.initTables();
    this.seedAdminUser();
    this.seedDemoUser();
    this.isInitialized = true;
  }

  private initTables() {
    // Enable WAL mode for high performance concurrent reads
    this.db.exec(`
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
    `);

    // Migration helper: ensure role column exists if table was created previously without it
    try {
      this.db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';`);
    } catch {
      // Column already exists
    }
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.scryptSync(password, salt, 64).toString('hex');
  }

  private verifyPassword(password: string, salt: string, expectedHash: string): boolean {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(expectedHash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  private sanitize(user: UserRow, token?: string): SanitizedUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user.email)}`,
      role: user.role || 'user',
      plan: user.plan || 'free',
      totalUploads: user.total_uploads,
      totalBytesSent: user.total_bytes_sent,
      totalBytesReceived: user.total_bytes_received,
      createdAt: user.created_at,
      deviceToken: token
    };
  }

  private seedAdminUser() {
    const adminEmail = 'admin';
    const stmt = this.db.prepare('SELECT id FROM users WHERE email = ? OR email = ?');
    const existing = stmt.get(adminEmail, 'admin@instasend.io');

    if (!existing) {
      const salt = 'a1b2c3d4e5f67890123456789abcdef0';
      const hash = this.hashPassword('1@3$5^7*9', salt);
      const userId = 'usr_admin_system';
      const now = Date.now() - 30 * 24 * 60 * 60 * 1000;

      const insert = this.db.prepare(`
        INSERT INTO users (
          id, email, name, password_hash, salt, avatar, role, plan,
          total_uploads, total_bytes_sent, total_bytes_received, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insert.run(
        userId,
        'admin',
        'System Administrator',
        hash,
        salt,
        'https://api.dicebear.com/7.x/identicon/svg?seed=Admin',
        'admin',
        'pro',
        142,
        1024 * 1024 * 5420,
        1024 * 1024 * 3120,
        now,
        Date.now()
      );
    }
  }

  private seedDemoUser() {
    const demoEmail = 'alex.rivera@instasend.io';
    const stmt = this.db.prepare('SELECT id FROM users WHERE email = ?');
    const existing = stmt.get(demoEmail);

    if (!existing) {
      const salt = 'c3d4e5f6a1b27890123456789abcdef2';
      const hash = this.hashPassword('InstaSend2026!', salt);
      const userId = 'usr_alex_rivera_demo';
      const now = Date.now() - 14 * 24 * 60 * 60 * 1000;

      const insert = this.db.prepare(`
        INSERT INTO users (
          id, email, name, password_hash, salt, avatar, role, plan,
          total_uploads, total_bytes_sent, total_bytes_received, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insert.run(
        userId,
        demoEmail,
        'Alex Rivera',
        hash,
        salt,
        'https://api.dicebear.com/7.x/identicon/svg?seed=Alex',
        'user',
        'pro',
        28,
        1024 * 1024 * 840,
        1024 * 1024 * 410,
        now,
        Date.now()
      );
    }
  }

  public registerUser(
    name: string,
    email: string,
    password: string,
    role: 'admin' | 'user' = 'user',
    plan: 'free' | 'pro' = 'free'
  ): { user: SanitizedUser; token: string } {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanEmail || !cleanName || !password) {
      throw new Error('Name, email, and password are all required.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const checkStmt = this.db.prepare('SELECT id FROM users WHERE email = ?');
    if (checkStmt.get(cleanEmail)) {
      throw new Error('An account with this email address already exists.');
    }

    const id = 'usr_' + crypto.randomBytes(8).toString('hex');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = this.hashPassword(password, salt);
    const now = Date.now();
    const avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(cleanName)}`;

    const insert = this.db.prepare(`
      INSERT INTO users (
        id, email, name, password_hash, salt, avatar, role, plan,
        total_uploads, total_bytes_sent, total_bytes_received, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(id, cleanEmail, cleanName, hash, salt, avatar, role, plan, 0, 0, 0, now, now);

    const userRow: UserRow = {
      id,
      email: cleanEmail,
      name: cleanName,
      password_hash: hash,
      salt,
      avatar,
      role,
      plan,
      total_uploads: 0,
      total_bytes_sent: 0,
      total_bytes_received: 0,
      created_at: now,
      updated_at: now
    };

    const token = this.createSession(id);
    return { user: this.sanitize(userRow, token), token };
  }

  public loginUser(emailOrUsername: string, password: string, deviceName?: string): { user: SanitizedUser; token: string } {
    const input = emailOrUsername.trim().toLowerCase();
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ? OR (email = ? AND ? = ?)');
    
    // Support login with 'admin' or full email
    let user = (stmt.get(input, 'admin', input, 'admin') as unknown) as UserRow | undefined;
    if (!user) {
      user = (this.db.prepare('SELECT * FROM users WHERE email = ?').get(input) as unknown) as UserRow | undefined;
    }

    if (!user) {
      throw new Error('No user account found with this username or email.');
    }

    const isValid = this.verifyPassword(password, user.salt, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid username/email or password.');
    }

    const token = this.createSession(user.id, deviceName);
    return { user: this.sanitize(user, token), token };
  }

  public createSession(userId: string, deviceName?: string): string {
    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO sessions (token, user_id, device_name, created_at, last_active_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(token, userId, deviceName || 'Web Browser', now, now);
    return token;
  }

  public getUserByToken(token: string): SanitizedUser | null {
    if (!token) return null;

    const sessionStmt = this.db.prepare(`
      SELECT s.token as session_token, s.device_name, u.*
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ?
    `);
    const result = (sessionStmt.get(token) as unknown) as (UserRow & SessionRow) | undefined;

    if (!result) return null;

    // Touch last_active_at
    const updateStmt = this.db.prepare('UPDATE sessions SET last_active_at = ? WHERE token = ?');
    updateStmt.run(Date.now(), token);

    return this.sanitize(result, token);
  }

  public revokeSession(token: string): boolean {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE token = ?');
    stmt.run(token);
    return true;
  }

  public updateUserStats(
    userId: string,
    delta: { uploads?: number; bytesSent?: number; bytesReceived?: number }
  ): SanitizedUser | null {
    const current = (this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown) as UserRow | undefined;
    if (!current) return null;

    const newUploads = current.total_uploads + (delta.uploads || 0);
    const newBytesSent = current.total_bytes_sent + (delta.bytesSent || 0);
    const newBytesReceived = current.total_bytes_received + (delta.bytesReceived || 0);
    const now = Date.now();

    const stmt = this.db.prepare(`
      UPDATE users 
      SET total_uploads = ?, total_bytes_sent = ?, total_bytes_received = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(newUploads, newBytesSent, newBytesReceived, now, userId);

    const updated = (this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown) as UserRow;
    return this.sanitize(updated);
  }

  public getAllUsers(): SanitizedUser[] {
    const rows = (this.db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as unknown) as UserRow[];
    return rows.map(u => this.sanitize(u));
  }

  public deleteUser(userId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
    stmt.run(userId);
    return true;
  }

  public getDbStatus() {
    const userCount = (this.db.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count || 0;
    const sessionCount = (this.db.prepare('SELECT COUNT(*) as count FROM sessions').get() as any)?.count || 0;
    let fileSize = 0;
    try {
      fileSize = fs.statSync(DB_PATH).size;
    } catch {
      fileSize = 0;
    }

    return {
      status: 'operational',
      engine: 'SQLite3 (node:sqlite)',
      databaseFile: DB_PATH,
      fileSizeBytes: fileSize,
      fileSizeFormatted: `${(fileSize / 1024).toFixed(1)} KB`,
      isInitialized: this.isInitialized,
      userCount,
      activeSessionCount: sessionCount,
      timestamp: new Date().toISOString()
    };
  }
}

// Singleton SQLite Auth Service
export const sqliteAuth = new SQLiteAuthService();
