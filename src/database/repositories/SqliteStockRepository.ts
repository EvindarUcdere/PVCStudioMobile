import { EntityNotFoundError, RepositoryError } from '../../domain/designs/errors';
import { createIsoTimestamp } from '../../domain/designs/utils/date';
import { createId } from '../../domain/designs/utils/id';
import { StockItem } from '../../domain/inventory/entities/StockItem';
import { ListStockItemsOptions, SaveStockItemInput, StockRepository } from './StockRepository';
import { SqliteDatabaseLike } from './SqliteDesignRepository';

type StockItemRow = {
  id: string;
  name: string;
  type: StockItem['type'];
  quantity: number;
  unit: StockItem['unit'];
  minimum_quantity: number;
  purchase_price: number | null;
  is_active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sync_status: StockItem['syncStatus'];
  version: number;
};

export class SqliteStockRepository implements StockRepository {
  constructor(private readonly database: SqliteDatabaseLike) {}

  async save(input: SaveStockItemInput): Promise<StockItem> {
    const id = input.id ?? createId();
    const name = input.name.trim();

    if (!name || input.quantity < 0 || input.minimumQuantity < 0) {
      throw new RepositoryError('Stock item name and non-negative quantities are required.');
    }

    const existing = await this.getById(id);
    const now = createIsoTimestamp();
    const createdAt = existing?.createdAt ?? now;
    const version = input.version ?? (existing ? existing.version + 1 : 1);

    await this.database.runAsync(
      `
        INSERT OR REPLACE INTO stock_items
        (id, name, type, quantity, unit, minimum_quantity, purchase_price, is_active, notes,
         created_at, updated_at, sync_status, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        id,
        name,
        input.type,
        input.quantity,
        input.unit,
        input.minimumQuantity,
        input.purchasePrice ?? null,
        (input.isActive ?? true) ? 1 : 0,
        normalizeOptionalText(input.notes),
        createdAt,
        now,
        input.syncStatus ?? 'pending',
        version,
      ],
    );

    const saved = await this.getById(id);
    if (!saved) {
      throw new RepositoryError('Saved stock item could not be read.');
    }

    return saved;
  }

  async getById(id: string): Promise<StockItem | null> {
    const row = await this.database.getFirstAsync<StockItemRow>(
      'SELECT * FROM stock_items WHERE id = ? LIMIT 1;',
      [id],
    );

    return row ? toDomain(row) : null;
  }

  async list(options: ListStockItemsOptions = {}): Promise<StockItem[]> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (!options.includeInactive) {
      where.push('is_active = 1');
    }

    if (options.lowStockOnly) {
      where.push('quantity <= minimum_quantity');
    }

    if (options.type) {
      where.push('type = ?');
      params.push(options.type);
    }

    params.push(options.limit ?? 200, options.offset ?? 0);

    const rows = await this.database.getAllAsync<StockItemRow>(
      `
        SELECT * FROM stock_items
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?;
      `,
      params,
    );

    return rows.map(toDomain);
  }

  async setActive(id: string, isActive: boolean): Promise<StockItem> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new EntityNotFoundError('StockItem', id);
    }

    await this.database.runAsync(
      'UPDATE stock_items SET is_active = ?, updated_at = ?, sync_status = ?, version = ? WHERE id = ?;',
      [isActive ? 1 : 0, createIsoTimestamp(), 'pending', existing.version + 1, id],
    );

    const saved = await this.getById(id);
    if (!saved) {
      throw new RepositoryError('Updated stock item could not be read.');
    }

    return saved;
  }

  async adjustQuantity(id: string, delta: number): Promise<StockItem> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new EntityNotFoundError('StockItem', id);
    }

    const nextQuantity = existing.quantity + delta;
    if (nextQuantity < 0) {
      throw new RepositoryError('Stock item quantity cannot be negative.');
    }

    await this.database.runAsync(
      'UPDATE stock_items SET quantity = ?, updated_at = ?, sync_status = ?, version = ? WHERE id = ?;',
      [nextQuantity, createIsoTimestamp(), 'pending', existing.version + 1, id],
    );

    const saved = await this.getById(id);
    if (!saved) {
      throw new RepositoryError('Adjusted stock item could not be read.');
    }

    return saved;
  }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toDomain(row: StockItemRow): StockItem {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    quantity: row.quantity,
    unit: row.unit,
    minimumQuantity: row.minimum_quantity,
    purchasePrice: row.purchase_price,
    isActive: row.is_active === 1,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
    version: row.version,
  };
}
