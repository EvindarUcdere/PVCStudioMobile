import { Quote, QuoteStatus } from '../../domain/quotes/entities/Quote';

export type SaveQuoteInput = Omit<Quote, 'createdAt' | 'updatedAt'>;

export interface QuoteRepository {
  save(input: SaveQuoteInput): Promise<Quote>;
  getById(id: string): Promise<Quote | null>;
  list(options?: { designId?: string; limit?: number; offset?: number }): Promise<Quote[]>;
  updateStatus(id: string, status: QuoteStatus): Promise<Quote>;
}
