import { DatabaseMigration } from './types';

export const paymentPlansMigration: DatabaseMigration = {
  id: '013_payment_plans',
  async up(database) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS payment_plans (
        id TEXT PRIMARY KEY NOT NULL,
        quote_id TEXT NOT NULL,
        design_id TEXT NOT NULL,
        customer_name TEXT,
        total_amount REAL NOT NULL,
        paid_now_amount REAL NOT NULL,
        remaining_amount REAL NOT NULL,
        installment_count INTEGER NOT NULL,
        first_due_date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_plans_quote_id
      ON payment_plans(quote_id);

      CREATE TABLE IF NOT EXISTS payment_installments (
        id TEXT PRIMARY KEY NOT NULL,
        plan_id TEXT NOT NULL,
        quote_id TEXT NOT NULL,
        design_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        amount REAL NOT NULL,
        due_date TEXT NOT NULL,
        paid_at TEXT,
        status TEXT NOT NULL,
        customer_name TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_payment_installments_due_date
      ON payment_installments(due_date);

      CREATE INDEX IF NOT EXISTS idx_payment_installments_status
      ON payment_installments(status);
    `);
  },
};
