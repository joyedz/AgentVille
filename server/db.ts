import { DatabaseSync } from 'node:sqlite';

/** Open (and initialise) the AgentVille persistence database. */
export function openDatabase(source: string | DatabaseSync = 'agentville.db'): DatabaseSync {
  const database = typeof source === 'string' ? new DatabaseSync(source) : source;
  database.exec(`
    CREATE TABLE IF NOT EXISTS commands (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      body TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      body TEXT NOT NULL
    );
  `);
  const columns = database.prepare('PRAGMA table_info(commands)').all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'error')) {
    database.exec('ALTER TABLE commands ADD COLUMN error TEXT');
  }
  return database;
}
