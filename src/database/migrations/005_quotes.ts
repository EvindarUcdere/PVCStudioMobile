import { DatabaseMigration } from './types';

export const quotesMigration: DatabaseMigration = {
  id: '005_quotes',
  async up(database) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS quotes (
        id TEXT PRIMARY KEY NOT NULL,
        design_id TEXT NOT NULL,
        design_name TEXT NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        note TEXT,
        status TEXT NOT NULL,
        width REAL NOT NULL,
        height REAL NOT NULL,
        quantity INTEGER NOT NULL,
        profile_system_name TEXT NOT NULL,
        color_name TEXT NOT NULL,
        glass_type_name TEXT NOT NULL,
        unit_total REAL NOT NULL,
        total REAL NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_quotes_updated_at
      ON quotes(updated_at);

      CREATE INDEX IF NOT EXISTS idx_quotes_design_id
      ON quotes(design_id);

      CREATE INDEX IF NOT EXISTS idx_quotes_status
      ON quotes(status);
    `);
  },
};
