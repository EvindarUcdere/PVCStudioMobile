import { DatabaseMigration } from './types';

export const designJobNameMigration: DatabaseMigration = {
  id: '008_design_job_name',
  async up(database) {
    await database.execAsync(`
      ALTER TABLE design_projects
      ADD COLUMN job_name TEXT;

      CREATE INDEX IF NOT EXISTS idx_design_projects_job_name
      ON design_projects(job_name);
    `);
  },
};
