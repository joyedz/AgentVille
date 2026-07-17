import { afterEach, describe, expect, it } from 'vitest';
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
});
