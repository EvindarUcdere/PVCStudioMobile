import { RepositoryError } from '../../domain/designs/errors';
import { createIsoTimestamp } from '../../domain/designs/utils/date';
import { createId } from '../../domain/designs/utils/id';
import { CashTransaction } from '../../domain/finance/entities/CashTransaction';
import {
  CashTransactionRepository,
  ListCashTransactionsOptions,
  SaveCashTransactionInput,
} from './CashTransactionRepository';
import { SqliteDatabaseLike } from './SqliteDesignRepository';

type CashTransactionRow = {
  id: string;
  type: CashTransaction['type'];
  category: CashTransaction['category'];
  title: string;
  amount: number;
  transaction_date: string;
  customer_id: string | null;
  design_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sync_status: CashTransaction['syncStatus'];
  version: number;
};

export class SqliteCashTransactionRepository implements CashTransactionRepository {
  constructor(private readonly database: SqliteDatabaseLike) {}

  async save(input: SaveCashTransactionInput): Promise<CashTransaction> {
    const id = input.id ?? createId();
    const title = input.title.trim();

    if (!title || input.amount <= 0) {
      throw new RepositoryError('Cash transaction title and positive amount are required.');
    }

    const existing = await this.getById(id);
    const now = createIsoTimestamp();
    const createdAt = existing?.createdAt ?? now;
    const version = input.version ?? (existing ? existing.version + 1 : 1);

    await this.database.runAsync(
      `
        INSERT OR REPLACE INTO cash_transactions
        (id, type, category, title, amount, transaction_date, customer_id, design_id, notes,
         created_at, updated_at, sync_status, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        id,
        input.type,
        input.category,
        title,
        input.amount,
        input.transactionDate,
        input.customerId ?? null,
        input.designId ?? null,
        normalizeOptionalText(input.notes),
        createdAt,
        now,
        input.syncStatus ?? 'pending',
        version,
      ],
    );

    const saved = await this.getById(id);
    if (!saved) {
      throw new RepositoryError('Saved cash transaction could not be read.');
    }

    return saved;
  }

  async getById(id: string): Promise<CashTransaction | null> {
    const row = await this.database.getFirstAsync<CashTransactionRow>(
      'SELECT * FROM cash_transactions WHERE id = ? LIMIT 1;',
      [id],
    );

    return row ? toDomain(row) : null;
  }

  async list(options: ListCashTransactionsOptions = {}): Promise<CashTransaction[]> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (options.customerId) {
      where.push('customer_id = ?');
      params.push(options.customerId);
    }

    if (options.designId) {
      where.push('design_id = ?');
      params.push(options.designId);
    }

    if (options.fromDate) {
      where.push('transaction_date >= ?');
      params.push(options.fromDate);
    }

    if (options.toDate) {
      where.push('transaction_date <= ?');
      params.push(options.toDate);
    }

    params.push(options.limit ?? 200, options.offset ?? 0);

    const rows = await this.database.getAllAsync<CashTransactionRow>(
      `
        SELECT * FROM cash_transactions
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY transaction_date DESC, updated_at DESC
        LIMIT ? OFFSET ?;
      `,
      params,
    );

    return rows.map(toDomain);
  }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toDomain(row: CashTransactionRow): CashTransaction {
  return {
    id: row.id,
    type: row.type,
    category: row.category,
    title: row.title,
    amount: row.amount,
    transactionDate: row.transaction_date,
    customerId: row.customer_id,
    designId: row.design_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
    version: row.version,
  };
}
