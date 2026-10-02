import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path
const dbPath = path.resolve(__dirname, '..', 'gitnaut.db');

export const db = new DatabaseSync(dbPath);

// Initialize tables with foreign keys and WAL mode
export function initDatabase() {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  // Users table: id (uuid), email (UNIQUE, NOT NULL), password_hash, created_at
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Progress table: id, user_id (FK to users), mission_id, mastery, streak, updated_at
  db.exec(`
    CREATE TABLE IF NOT EXISTS progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mission_id TEXT NOT NULL,
      mastery INTEGER DEFAULT 0,
      streak INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, mission_id)
    );
  `);

  // Index for fast user queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_progress_user_id ON progress (user_id);
  `);
}
