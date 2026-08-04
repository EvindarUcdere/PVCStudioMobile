import { DatabaseMigration } from './types';

export const productionProfileDisplayNameMigration: DatabaseMigration = {
  id: '018_production_profile_display_name',
  async up(database) {
    const displayNameColumn = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM pragma_table_info('production_profile_systems') WHERE name = 'display_name' LIMIT 1;",
    );

    if (!displayNameColumn) {
      await database.execAsync(`
        ALTER TABLE production_profile_systems
        ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
      `);
    }

    await database.execAsync(`
      UPDATE production_profile_systems
      SET display_name = TRIM(brand || ' ' || series_name)
      WHERE display_name = '';
    `);
  },
};
