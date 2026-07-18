import { DatabaseMigration } from './types';

export const initialMetadataMigration: DatabaseMigration = {
  id: '001_initial_metadata',
  async up(database) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT,
        updated_at TEXT NOT NULL
      );
    `);
  },
};
