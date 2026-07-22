import { EntityNotFoundError, RepositoryError } from '../../domain/designs/errors';
import { createId } from '../../domain/designs/utils/id';
import { createIsoTimestamp } from '../../domain/designs/utils/date';
import { Customer } from '../../domain/customers/entities/Customer';
import { CustomerRepository, ListCustomersOptions, SaveCustomerInput } from './CustomerRepository';
import { SqliteDatabaseLike } from './SqliteDesignRepository';

type CustomerRow = {
  id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: Customer['syncStatus'];
  version: number;
};

export class SqliteCustomerRepository implements CustomerRepository {
  constructor(private readonly database: SqliteDatabaseLike) {}

  async save(input: SaveCustomerInput): Promise<Customer> {
    const id = input.id ?? createId();
    const fullName = input.fullName.trim();

    if (!fullName) {
      throw new RepositoryError('Customer full name is required.');
    }

    const existing = await this.getRawById(id);
    const now = createIsoTimestamp();
    const createdAt = existing?.createdAt ?? now;
    const version = input.version ?? (existing ? existing.version + 1 : 1);

    await this.database.runAsync(
      `
        INSERT OR REPLACE INTO customers
        (id, full_name, phone, address, notes, created_at, updated_at, deleted_at, sync_status, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        id,
        fullName,
        normalizeOptionalText(input.phone),
        normalizeOptionalText(input.address),
        normalizeOptionalText(input.notes),
        createdAt,
        now,
        input.deletedAt ?? null,
        input.syncStatus ?? 'pending',
        version,
      ],
    );

    const saved = await this.getById(id);
    if (!saved) {
      throw new RepositoryError('Saved customer could not be read.');
    }

    return saved;
  }

  async getById(id: string): Promise<Customer | null> {
    const row = await this.database.getFirstAsync<CustomerRow>(
      'SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL LIMIT 1;',
      [id],
    );

    return row ? toDomain(row) : null;
  }

  private async getRawById(id: string): Promise<Customer | null> {
    const row = await this.database.getFirstAsync<CustomerRow>(
      'SELECT * FROM customers WHERE id = ? LIMIT 1;',
      [id],
    );

    return row ? toDomain(row) : null;
  }

  async list(options: ListCustomersOptions = {}): Promise<Customer[]> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (!options.includeDeleted) {
      where.push('deleted_at IS NULL');
    }

    if (options.search?.trim()) {
      where.push('(full_name LIKE ? OR phone LIKE ? OR address LIKE ?)');
      const search = `%${options.search.trim()}%`;
      params.push(search, search, search);
    }

    params.push(options.limit ?? 100, options.offset ?? 0);

    const rows = await this.database.getAllAsync<CustomerRow>(
      `
        SELECT * FROM customers
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?;
      `,
      params,
    );

    return rows.map(toDomain);
  }

  async softDelete(id: string): Promise<Customer> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new EntityNotFoundError('Customer', id);
    }

    const now = createIsoTimestamp();
    await this.database.runAsync(
      'UPDATE customers SET deleted_at = ?, updated_at = ?, sync_status = ?, version = ? WHERE id = ?;',
      [now, now, 'pending', existing.version + 1, id],
    );

    return {
      ...existing,
      deletedAt: now,
      updatedAt: now,
      syncStatus: 'pending',
      version: existing.version + 1,
    };
  }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toDomain(row: CustomerRow): Customer {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status,
    version: row.version,
  };
}
