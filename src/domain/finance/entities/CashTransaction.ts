export type CashTransactionType = 'income' | 'expense';

export type CashTransactionCategory =
  | 'job_payment'
  | 'material'
  | 'labor'
  | 'transport'
  | 'rent'
  | 'utilities'
  | 'other';

export type CashTransaction = {
  id: string;
  type: CashTransactionType;
  category: CashTransactionCategory;
  title: string;
  amount: number;
  transactionDate: string;
  customerId: string | null;
  designId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'local' | 'pending' | 'synced' | 'conflict';
  version: number;
};

export const cashTransactionCategoryLabels: Record<CashTransactionCategory, string> = {
  job_payment: 'Is odemesi',
  material: 'Malzeme',
  labor: 'Iscilik',
  transport: 'Nakliye',
  rent: 'Kira',
  utilities: 'Fatura',
  other: 'Diger',
};
