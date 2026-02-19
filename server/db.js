import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, 'chain-tracker.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS watchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watcher_id INTEGER NOT NULL REFERENCES watchers(id),
    slot_start TEXT NOT NULL,
    UNIQUE(watcher_id, slot_start)
  );

  CREATE INDEX IF NOT EXISTS idx_signups_slot ON signups(slot_start);

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    torn_id INTEGER NOT NULL UNIQUE,
    username TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE,
    session_token TEXT NOT NULL UNIQUE,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Migrations for existing databases
const migrations = [
  'ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN faction_id INTEGER',
];
for (const sql of migrations) {
  try { db.exec(sql); } catch { /* column already exists */ }
}

// Prepared statements
const stmts = {
  listWatchers: db.prepare('SELECT id, name FROM watchers ORDER BY name'),

  createWatcher: db.prepare('INSERT INTO watchers (name) VALUES (?)'),

  addSignup: db.prepare(
    'INSERT OR IGNORE INTO signups (watcher_id, slot_start) VALUES (?, ?)'
  ),

  removeSignup: db.prepare(
    'DELETE FROM signups WHERE watcher_id = ? AND slot_start = ?'
  ),

  getSchedule: db.prepare(`
    SELECT s.slot_start, w.id AS watcher_id, w.name AS watcher_name
    FROM signups s
    JOIN watchers w ON w.id = s.watcher_id
    WHERE s.slot_start >= ? AND s.slot_start < ?
    ORDER BY s.slot_start, w.name
  `),

  createUser: db.prepare(
    'INSERT INTO users (torn_id, username, api_key, session_token, faction_id) VALUES (?, ?, ?, ?, ?)'
  ),

  getUserByApiKey: db.prepare('SELECT * FROM users WHERE api_key = ?'),

  getUserBySession: db.prepare('SELECT id, torn_id, username, is_admin, faction_id FROM users WHERE session_token = ?'),

  getApiKeyBySession: db.prepare('SELECT api_key FROM users WHERE session_token = ?'),

  countUsers: db.prepare('SELECT COUNT(*) AS count FROM users'),

  getUserByTornId: db.prepare('SELECT * FROM users WHERE torn_id = ?'),

  updateUserApiKey: db.prepare(
    'UPDATE users SET api_key = ?, username = ?, session_token = ?, faction_id = ? WHERE torn_id = ? RETURNING *'
  ),
};

export function listWatchers() {
  return stmts.listWatchers.all();
}

export function createWatcher(name) {
  const info = stmts.createWatcher.run(name);
  return { id: info.lastInsertRowid, name };
}

export function addSignups(watcherId, slots) {
  const tx = db.transaction((slots) => {
    for (const slot of slots) {
      stmts.addSignup.run(watcherId, slot);
    }
  });
  tx(slots);
}

export function removeSignups(watcherId, slots) {
  const tx = db.transaction((slots) => {
    for (const slot of slots) {
      stmts.removeSignup.run(watcherId, slot);
    }
  });
  tx(slots);
}

export function createUser(tornId, username, apiKey, sessionToken, factionId) {
  const info = stmts.createUser.run(tornId, username, apiKey, sessionToken, factionId);
  return { id: info.lastInsertRowid, tornId, username };
}

export function getUserByApiKey(apiKey) {
  return stmts.getUserByApiKey.get(apiKey);
}

export function getUserByTornId(tornId) {
  return stmts.getUserByTornId.get(tornId);
}

export function updateUserApiKey(tornId, username, apiKey, sessionToken, factionId) {
  return stmts.updateUserApiKey.get(apiKey, username, sessionToken, factionId, tornId);
}

export function getUserBySession(sessionToken) {
  return stmts.getUserBySession.get(sessionToken);
}

export function getApiKeyBySession(sessionToken) {
  const row = stmts.getApiKeyBySession.get(sessionToken);
  return row?.api_key ?? null;
}

export function countUsers() {
  return stmts.countUsers.get().count;
}

export function getSchedule(from, to) {
  const rows = stmts.getSchedule.all(from, to);
  const slots = {};
  for (const row of rows) {
    if (!slots[row.slot_start]) {
      slots[row.slot_start] = [];
    }
    slots[row.slot_start].push({
      id: row.watcher_id,
      name: row.watcher_name,
    });
  }
  return slots;
}

export default db;
