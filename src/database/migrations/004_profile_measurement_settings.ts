import { DatabaseMigration } from './types';

export const profileMeasurementSettingsMigration: DatabaseMigration = {
  id: '004_profile_measurement_settings',
  async up(database) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS profile_measurement_settings (
        series_id TEXT PRIMARY KEY NOT NULL,
        frame_width REAL NOT NULL,
        sash_width REAL NOT NULL,
        mullion_width REAL NOT NULL,
        glass_rebate REAL NOT NULL,
        cutting_allowance REAL NOT NULL,
        welding_allowance REAL NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  },
};
