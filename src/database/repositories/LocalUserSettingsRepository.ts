import { getDatabase } from '../client';
import { createId } from '../../domain/designs/utils/id';

const operatorNameKey = 'local_operator_name';
const deviceIdKey = 'local_device_id';

type MetadataRow = {
  value: string | null;
};

export async function getLocalOperatorName(): Promise<string | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<MetadataRow>(
    'SELECT value FROM app_metadata WHERE key = ? LIMIT 1;',
    [operatorNameKey],
  );
  const name = row?.value?.trim();
  return name ? name : null;
}

export async function saveLocalOperatorName(name: string): Promise<string | null> {
  const normalized = name.trim();
  const database = await getDatabase();
  await database.runAsync(
    `
      INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
      VALUES (?, ?, ?);
    `,
    [operatorNameKey, normalized, new Date().toISOString()],
  );

  return normalized ? normalized : null;
}

export async function getLocalDeviceId(): Promise<string> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<MetadataRow>(
    'SELECT value FROM app_metadata WHERE key = ? LIMIT 1;',
    [deviceIdKey],
  );
  const existingId = row?.value?.trim();

  if (existingId) {
    return existingId;
  }

  const nextId = createId();
  await database.runAsync(
    `
      INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
      VALUES (?, ?, ?);
    `,
    [deviceIdKey, nextId, new Date().toISOString()],
  );

  return nextId;
}
