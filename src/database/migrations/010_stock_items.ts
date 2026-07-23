import { DatabaseMigration } from './types';

export const stockItemsMigration: DatabaseMigration = {
  id: '010_stock_items',
  async up(database) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS stock_items (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        minimum_quantity REAL NOT NULL,
        purchase_price REAL,
        is_active INTEGER NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL,
        version INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_stock_items_type
      ON stock_items(type);

      CREATE INDEX IF NOT EXISTS idx_stock_items_is_active
      ON stock_items(is_active);
    `);
  },
};
