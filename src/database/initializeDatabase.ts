import { logger } from '../services/logger';
import { getDatabase } from './client';
import { initialMetadataMigration } from './migrations/001_initial_metadata';
import { designDomainMigration } from './migrations/002_design_domain';
import { designTemplatesMigration } from './migrations/003_design_templates';
import { profileMeasurementSettingsMigration } from './migrations/004_profile_measurement_settings';
import { quotesMigration } from './migrations/005_quotes';
import { customersMigration } from './migrations/006_customers';
import { designJobStatusMigration } from './migrations/007_design_job_status';
import { DatabaseMigration, MigrationDatabase } from './migrations/types';
import { seedReferenceData } from './seeds/seedReferenceData';
import { seedProfileMeasurementSettings } from './seeds/seedProfileMeasurementSettings';
import { seedSystemTemplates } from './seeds/seedSystemTemplates';
import { SQLiteBindParams, SQLiteDatabase } from 'expo-sqlite';

const migrations: DatabaseMigration[] = [
  initialMetadataMigration,
  designDomainMigration,
  designTemplatesMigration,
  profileMeasurementSettingsMigration,
  quotesMigration,
  customersMigration,
  designJobStatusMigration,
];

type MetadataRow = {
  value: string | null;
};

async function setMetadata(database: MigrationDatabase, key: string, value: string): Promise<void> {
  await database.runAsync(
    `
      INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
      VALUES (?, ?, ?);
    `,
    [key, value, new Date().toISOString()],
  );
}

async function hasMigrationRun(database: MigrationDatabase, migrationId: string): Promise<boolean> {
  const row = await database.getFirstAsync<MetadataRow>(
    'SELECT value FROM app_metadata WHERE key = ? LIMIT 1;',
    [`migration:${migrationId}`],
  );

  return row?.value === 'applied';
}

async function runMigrations(database: MigrationDatabase): Promise<void> {
  for (const migration of migrations) {
    if (
      migration.id !== initialMetadataMigration.id &&
      (await hasMigrationRun(database, migration.id))
    ) {
      continue;
    }

    await database.execAsync('BEGIN TRANSACTION;');
    try {
      await migration.up(database);
      await setMetadata(database, `migration:${migration.id}`, 'applied');
      await setMetadata(database, 'schema_version', migration.id);
      await database.execAsync('COMMIT;');
    } catch (error) {
      await database.execAsync('ROLLBACK;');
      throw error;
    }
  }
}

function createMigrationDatabase(database: SQLiteDatabase): MigrationDatabase {
  return {
    execAsync(sql) {
      return database.execAsync(sql);
    },
    runAsync(sql, params = []) {
      return database.runAsync(sql, params as SQLiteBindParams);
    },
    getFirstAsync<T>(sql: string, params = []) {
      return database.getFirstAsync<T>(sql, params as SQLiteBindParams);
    },
  };
}

export async function initializeDatabase(): Promise<void> {
  try {
    const database = createMigrationDatabase(await getDatabase());

    await runMigrations(database);
    await seedReferenceData(database);
    await seedProfileMeasurementSettings(database);
    await seedSystemTemplates(database);
    await database.runAsync(
      `
        INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
        VALUES (?, ?, ?);
      `,
      ['database_ready', 'true', new Date().toISOString()],
    );
  } catch (error) {
    logger.error('Veritabani baslatma hatasi', error);
    throw error;
  }
}
