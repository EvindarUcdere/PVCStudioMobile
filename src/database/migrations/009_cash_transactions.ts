import { DatabaseMigration } from './types';

export const cashTransactionsMigration: DatabaseMigration = {
  id: '009_cash_transactions',
  async up(database) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS cash_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        transaction_date TEXT NOT NULL,
        customer_id TEXT,
        design_id TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL,
        version INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cash_transactions_date
      ON cash_transactions(transaction_date);

      CREATE INDEX IF NOT EXISTS idx_cash_transactions_customer_id
      ON cash_transactions(customer_id);

      CREATE INDEX IF NOT EXISTS idx_cash_transactions_design_id
      ON cash_transactions(design_id);
    `);
  },
};
