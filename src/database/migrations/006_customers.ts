import { DatabaseMigration } from './types';

export const customersMigration: DatabaseMigration = {
  id: '006_customers',
  async up(database) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        sync_status TEXT NOT NULL,
        version INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_customers_updated_at
      ON customers(updated_at);

      CREATE INDEX IF NOT EXISTS idx_customers_deleted_at
      ON customers(deleted_at);

      CREATE INDEX IF NOT EXISTS idx_customers_phone
      ON customers(phone);
    `);
  },
};
