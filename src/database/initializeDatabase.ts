import { logger } from '../services/logger';
import { getDatabase } from './client';
import { DATABASE_NAME } from '../constants/app';
import { initialMetadataMigration } from './migrations/001_initial_metadata';
import { designDomainMigration } from './migrations/002_design_domain';
import { designTemplatesMigration } from './migrations/003_design_templates';
import { profileMeasurementSettingsMigration } from './migrations/004_profile_measurement_settings';
import { quotesMigration } from './migrations/005_quotes';
import { customersMigration } from './migrations/006_customers';
import { designJobStatusMigration } from './migrations/007_design_job_status';
import { designJobNameMigration } from './migrations/008_design_job_name';
import { cashTransactionsMigration } from './migrations/009_cash_transactions';
import { stockItemsMigration } from './migrations/010_stock_items';
import { stockConsumptionsMigration } from './migrations/011_stock_consumptions';
import { jobProjectsMigration } from './migrations/012_job_projects';
import { paymentPlansMigration } from './migrations/013_payment_plans';
import { activityLogsMigration } from './migrations/014_activity_logs';
import { activityLogActorMigration } from './migrations/015_activity_log_actor';
import { reliabilityIndexesMigration } from './migrations/016_reliability_indexes';
import { DatabaseMigration, MigrationDatabase } from './migrations/types';
import { seedReferenceData } from './seeds/seedReferenceData';
import { seedProfileMeasurementSettings } from './seeds/seedProfileMeasurementSettings';
import { seedSystemTemplates } from './seeds/seedSystemTemplates';
import { SQLiteBindParams, SQLiteDatabase, backupDatabaseAsync, openDatabaseAsync } from 'expo-sqlite';

const migrations: DatabaseMigration[] = [
  initialMetadataMigration,
  designDomainMigration,
  designTemplatesMigration,
  profileMeasurementSettingsMigration,
  quotesMigration,
  customersMigration,
  designJobStatusMigration,
  designJobNameMigration,
  cashTransactionsMigration,
  stockItemsMigration,
  stockConsumptionsMigration,
  jobProjectsMigration,
  paymentPlansMigration,
  activityLogsMigration,
  activityLogActorMigration,
  reliabilityIndexesMigration,
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
  let backupCreated = false;

  for (const migration of migrations) {
    if (
      migration.id !== initialMetadataMigration.id &&
      (await hasMigrationRun(database, migration.id))
    ) {
      continue;
    }

    if (migration.id !== initialMetadataMigration.id && !backupCreated) {
      await createPreMigrationBackup(database);
      backupCreated = true;
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

async function createPreMigrationBackup(database: MigrationDatabase): Promise<void> {
  const sourceDatabase = await getDatabase();
  const backupName = getMigrationBackupDatabaseName();
  let backupDatabase: SQLiteDatabase | null = null;

  try {
    backupDatabase = await openDatabaseAsync(backupName);
    await backupDatabaseAsync({
      sourceDatabase,
      destDatabase: backupDatabase,
    });
    await setMetadata(database, 'last_migration_backup', backupName);
  } catch (error) {
    logger.error('SQLite migration backup failed', error);
  } finally {
    await backupDatabase?.closeAsync().catch((closeError) => {
      logger.error('SQLite migration backup close failed', closeError);
    });
  }
}

function getMigrationBackupDatabaseName(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${DATABASE_NAME.replace(/\.db$/i, '')}_pre_migration_${timestamp}.db`;
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
