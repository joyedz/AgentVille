import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../db.js';

describe('openDatabase', () => {
  let database: ReturnType<typeof openDatabase> | undefined;

  afterEach(() => {
    database?.close();
    database = undefined;
  });

  it('creates the persistence tables in an in-memory database', () => {
    database = openDatabase(':memory:');
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual(['agents', 'commands', 'tasks']);
  });

  it('adds the command error column when opening an older database', () => {
    database = new DatabaseSync(':memory:');
    database.exec(`CREATE TABLE commands (id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, type TEXT NOT NULL, payload TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL);`);
    openDatabase(database);
    const columns = database.prepare('PRAGMA table_info(commands)').all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toContain('error');
  });
});
