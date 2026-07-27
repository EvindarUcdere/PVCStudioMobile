import { DatabaseMigration } from './types';

export const activityLogsMigration: DatabaseMigration = {
  id: '014_activity_logs',
  async up(database) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        entity_type TEXT,
        entity_id TEXT,
        customer_name TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
      ON activity_logs(created_at);

      CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
      ON activity_logs(entity_type, entity_id);
    `);
  },
};
