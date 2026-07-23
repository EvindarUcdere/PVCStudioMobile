export type CashTransactionType = 'income' | 'expense';

export type CashTransactionCategory =
  | 'job_payment'
  | 'pvc_profile'
  | 'glass'
  | 'accessory'
  | 'hardware'
  | 'labor'
  | 'transport'
  | 'material'
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
  job_payment: 'Musteri odemesi',
  pvc_profile: 'PVC profil',
  glass: 'Cam',
  accessory: 'Aksesuar',
  hardware: 'Mekanizma',
  labor: 'Iscilik',
  transport: 'Nakliye',
  material: 'Malzeme',
  rent: 'Kira',
  utilities: 'Fatura',
  other: 'Diger',
};
