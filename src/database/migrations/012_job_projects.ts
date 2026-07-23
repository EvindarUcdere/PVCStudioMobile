import { DatabaseMigration } from './types';

export const jobProjectsMigration: DatabaseMigration = {
  id: '012_job_projects',
  async up(database) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS job_projects (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        customer_id TEXT,
        status TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        sync_status TEXT NOT NULL,
        version INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_job_projects_customer_id
      ON job_projects(customer_id);

      CREATE INDEX IF NOT EXISTS idx_job_projects_status
      ON job_projects(status);

      CREATE INDEX IF NOT EXISTS idx_job_projects_deleted_at
      ON job_projects(deleted_at);
    `);

    try {
      await database.execAsync('ALTER TABLE design_projects ADD COLUMN job_id TEXT;');
    } catch {
      // Older local databases may already have the column after a failed/retried migration.
    }

    await database.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_design_projects_job_id
      ON design_projects(job_id);
    `);
  },
};
