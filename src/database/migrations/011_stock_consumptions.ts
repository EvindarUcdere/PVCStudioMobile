import { DatabaseMigration } from './types';

export const stockConsumptionsMigration: DatabaseMigration = {
  id: '011_stock_consumptions',
  async up(database) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS stock_consumptions (
        design_id TEXT PRIMARY KEY NOT NULL,
        consumed_at TEXT NOT NULL,
        items_json TEXT NOT NULL
      );
    `);
  },
};
