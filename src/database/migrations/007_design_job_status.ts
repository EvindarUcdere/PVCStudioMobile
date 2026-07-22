import { DatabaseMigration } from './types';

export const designJobStatusMigration: DatabaseMigration = {
  id: '007_design_job_status',
  async up(database) {
    await database.execAsync(`
      ALTER TABLE design_projects
      ADD COLUMN job_status TEXT NOT NULL DEFAULT 'draft';

      CREATE INDEX IF NOT EXISTS idx_design_projects_job_status
      ON design_projects(job_status);
    `);
  },
};
