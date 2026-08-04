import { DatabaseMigration } from './types';

export const productionProfileSystemsMigration: DatabaseMigration = {
  id: '017_production_profile_systems',
  async up(database) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS production_profile_systems (
        id TEXT PRIMARY KEY NOT NULL,
        company_id TEXT NOT NULL,
        display_name TEXT NOT NULL DEFAULT '',
        brand TEXT NOT NULL,
        series_name TEXT NOT NULL,
        version TEXT NOT NULL,
        status TEXT NOT NULL,
        frame_profile_code TEXT NOT NULL,
        welding_allowance_mode TEXT NOT NULL,
        technical_values_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_production_profile_systems_company
      ON production_profile_systems(company_id);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_production_profile_systems_identity
      ON production_profile_systems(company_id, brand, series_name, version);
    `);
  },
};
