import { describe, expect, it } from 'vitest';

import { Quote } from '../../../domain/quotes/entities/Quote';
import { SqliteDatabaseLike } from '../SqliteDesignRepository';
import { SqliteQuoteRepository } from '../SqliteQuoteRepository';

type QuoteRow = {
  id: string;
  design_id: string;
  design_name: string;
  customer_name: string | null;
  customer_phone: string | null;
  note: string | null;
  status: Quote['status'];
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

class InMemoryQuoteDatabase implements SqliteDatabaseLike {
  readonly quotes = new Map<string, QuoteRow>();

  async execAsync(_sql: string): Promise<void> {}

  async runAsync(sql: string, params: unknown[] = []): Promise<unknown> {
    const normalized = sql.trim().toLowerCase();

    if (normalized.startsWith('insert or replace into quotes')) {
      const row: QuoteRow = {
        id: String(params[0]),
        design_id: String(params[1]),
        design_name: String(params[2]),
        customer_name: params[3] === null ? null : String(params[3]),
        customer_phone: params[4] === null ? null : String(params[4]),
        note: params[5] === null ? null : String(params[5]),
        status: params[6] as Quote['status'],
        width: Number(params[7]),
        height: Number(params[8]),
        quantity: Number(params[9]),
        profile_system_name: String(params[10]),
        color_name: String(params[11]),
        glass_type_name: String(params[12]),
        unit_total: Number(params[13]),
        total: Number(params[14]),
        message: String(params[15]),
        created_at: String(params[16]),
        updated_at: String(params[17]),
      };

      this.quotes.set(row.id, row);
    }

    if (normalized.startsWith('update quotes set status')) {
      const id = String(params[2]);
      const existing = this.quotes.get(id);
      if (existing) {
        this.quotes.set(id, {
          ...existing,
          status: params[0] as Quote['status'],
          updated_at: String(params[1]),
        });
      }
    }

    return {};
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const normalized = sql.trim().toLowerCase();

    if (normalized.includes('where id = ?')) {
      return (this.quotes.get(String(params[0])) as T | undefined) ?? null;
    }

    if (normalized.includes('where design_id = ?')) {
      const designId = String(params[0]);
      const row = Array.from(this.quotes.values())
        .filter((quote) => quote.design_id === designId)
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0];
      return (row as T | undefined) ?? null;
    }

    return null;
  }

  async getAllAsync<T>(): Promise<T[]> {
    return Array.from(this.quotes.values()) as T[];
  }
}

describe('SqliteQuoteRepository', () => {
  it('updates the existing design quote instead of creating a duplicate', async () => {
    const database = new InMemoryQuoteDatabase();
    const repository = new SqliteQuoteRepository(database);

    const first = await repository.save(createQuoteInput({ id: 'quote-1', total: 1000 }));
    const second = await repository.save(createQuoteInput({ id: 'quote-2', total: 1200 }));

    expect(second.id).toBe(first.id);
    expect(second.total).toBe(1200);
    expect(database.quotes.size).toBe(1);
  });

  it('does not downgrade an accepted quote back to draft', async () => {
    const repository = new SqliteQuoteRepository(new InMemoryQuoteDatabase());

    const accepted = await repository.save(createQuoteInput({ id: 'quote-1', status: 'accepted' }));
    const savedAgain = await repository.save(createQuoteInput({ id: 'quote-2', status: 'draft' }));

    expect(savedAgain.id).toBe(accepted.id);
    expect(savedAgain.status).toBe('accepted');
  });
});

function createQuoteInput(overrides: Partial<Quote> = {}) {
  return {
    id: overrides.id ?? 'quote-1',
    designId: overrides.designId ?? 'design-1',
    designName: overrides.designName ?? 'Salon',
    customerName: overrides.customerName ?? 'Ali',
    customerPhone: overrides.customerPhone ?? '05300000000',
    note: overrides.note ?? null,
    status: overrides.status ?? 'draft',
    width: overrides.width ?? 1200,
    height: overrides.height ?? 1400,
    quantity: overrides.quantity ?? 1,
    profileSystemName: overrides.profileSystemName ?? 'Standart',
    colorName: overrides.colorName ?? 'Beyaz',
    glassTypeName: overrides.glassTypeName ?? 'Cift cam',
    unitTotal: overrides.unitTotal ?? 1000,
    total: overrides.total ?? 1000,
    message: overrides.message ?? 'PVC teklif',
  };
}
