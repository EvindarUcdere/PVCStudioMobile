import { SQLiteBindParams } from 'expo-sqlite';

import { getDatabase } from '../client';

export type StockConsumptionLine = {
  stockItemId: string;
  stockItemName: string;
  quantity: number;
  unit: string;
};

export type StockConsumptionRecord = {
  designId: string;
  consumedAt: string;
  lines: StockConsumptionLine[];
};

type StockConsumptionRow = {
  design_id: string;
  consumed_at: string;
  items_json: string;
};

export async function hasStockConsumptionForDesign(designId: string): Promise<boolean> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<Pick<StockConsumptionRow, 'design_id'>>(
    'SELECT design_id FROM stock_consumptions WHERE design_id = ? LIMIT 1;',
    [designId] as SQLiteBindParams,
  );

  return Boolean(row);
}

export async function saveStockConsumptionForDesign(
  designId: string,
  lines: StockConsumptionLine[],
  consumedAt = new Date().toISOString(),
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `
      INSERT OR REPLACE INTO stock_consumptions (design_id, consumed_at, items_json)
      VALUES (?, ?, ?);
    `,
    [designId, consumedAt, JSON.stringify(lines)] as SQLiteBindParams,
  );
}

export async function listStockConsumptions(): Promise<StockConsumptionRecord[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<StockConsumptionRow>(
    'SELECT * FROM stock_consumptions ORDER BY consumed_at DESC;',
  );

  return rows.map((row) => ({
    designId: row.design_id,
    consumedAt: row.consumed_at,
    lines: parseLines(row.items_json),
  }));
}

function parseLines(value: string): StockConsumptionLine[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as StockConsumptionLine[]) : [];
  } catch {
    return [];
  }
}
