import { EntityNotFoundError, RepositoryError } from '../../domain/designs/errors';
import { Quote, QuoteStatus } from '../../domain/quotes/entities/Quote';
import { createIsoTimestamp } from '../../domain/designs/utils/date';
import { SaveQuoteInput, QuoteRepository } from './QuoteRepository';
import { SqliteDatabaseLike } from './SqliteDesignRepository';

type QuoteRow = {
  id: string;
  design_id: string;
  design_name: string;
  customer_name: string | null;
  customer_phone: string | null;
  note: string | null;
  status: QuoteStatus;
  width: number;
  height: number;
  quantity: number;
  profile_system_name: string;
  color_name: string;
  glass_type_name: string;
  unit_total: number;
  total: number;
  message: string;
  created_at: string;
  updated_at: string;
};

export class SqliteQuoteRepository implements QuoteRepository {
  constructor(private readonly database: SqliteDatabaseLike) {}

  async save(input: SaveQuoteInput): Promise<Quote> {
    try {
      const existing = await this.getById(input.id);
      const now = createIsoTimestamp();
      const createdAt = existing?.createdAt ?? now;

      await this.database.runAsync(
        `
          INSERT OR REPLACE INTO quotes
          (id, design_id, design_name, customer_name, customer_phone, note, status, width, height,
           quantity, profile_system_name, color_name, glass_type_name, unit_total, total, message,
           created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        [
          input.id,
          input.designId,
          input.designName,
          input.customerName,
          input.customerPhone,
          input.note,
          input.status,
          input.width,
          input.height,
          input.quantity,
          input.profileSystemName,
          input.colorName,
          input.glassTypeName,
          input.unitTotal,
          input.total,
          input.message,
          createdAt,
          now,
        ],
      );

      const saved = await this.getById(input.id);
      if (!saved) {
        throw new RepositoryError('Saved quote could not be read.');
      }

      return saved;
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }

      throw new RepositoryError('Quote save failed.', { cause: error });
    }
  }

  async getById(id: string): Promise<Quote | null> {
    const row = await this.database.getFirstAsync<QuoteRow>(
      'SELECT * FROM quotes WHERE id = ? LIMIT 1;',
      [id],
    );

    return row ? toDomain(row) : null;
  }

  async list(options: { designId?: string; limit?: number; offset?: number } = {}): Promise<Quote[]> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (options.designId) {
      where.push('design_id = ?');
      params.push(options.designId);
    }

    params.push(options.limit ?? 100, options.offset ?? 0);

    const rows = await this.database.getAllAsync<QuoteRow>(
      `
        SELECT * FROM quotes
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?;
      `,
      params,
    );

    return rows.map(toDomain);
  }

  async updateStatus(id: string, status: QuoteStatus): Promise<Quote> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new EntityNotFoundError('Quote', id);
    }

    await this.database.runAsync(
      'UPDATE quotes SET status = ?, updated_at = ? WHERE id = ?;',
      [status, createIsoTimestamp(), id],
    );

    const saved = await this.getById(id);
    if (!saved) {
      throw new RepositoryError('Updated quote could not be read.');
    }

    return saved;
  }
}

function toDomain(row: QuoteRow): Quote {
  return {
    id: row.id,
    designId: row.design_id,
    designName: row.design_name,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    note: row.note,
    status: row.status,
    width: row.width,
    height: row.height,
    quantity: row.quantity,
    profileSystemName: row.profile_system_name,
    colorName: row.color_name,
    glassTypeName: row.glass_type_name,
    unitTotal: row.unit_total,
    total: row.total,
    message: row.message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
