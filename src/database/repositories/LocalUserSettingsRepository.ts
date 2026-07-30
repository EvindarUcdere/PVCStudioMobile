import { getDatabase } from '../client';

const operatorNameKey = 'local_operator_name';

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
