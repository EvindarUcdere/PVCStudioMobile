import {
  CashTransaction,
  CashTransactionCategory,
  CashTransactionType,
} from '../../domain/finance/entities/CashTransaction';

export type SaveCashTransactionInput = {
  id?: string;
  type: CashTransactionType;
  category: CashTransactionCategory;
  title: string;
  amount: number;
  transactionDate: string;
  customerId?: string | null;
  designId?: string | null;
  notes?: string | null;
  syncStatus?: CashTransaction['syncStatus'];
  version?: number;
};

export type ListCashTransactionsOptions = {
  customerId?: string;
  designId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
};

export interface CashTransactionRepository {
  save(input: SaveCashTransactionInput): Promise<CashTransaction>;
  getById(id: string): Promise<CashTransaction | null>;
  list(options?: ListCashTransactionsOptions): Promise<CashTransaction[]>;
}
