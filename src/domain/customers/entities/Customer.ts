export type Customer = {
  id: string;
  fullName: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: 'local' | 'pending' | 'synced' | 'conflict';
  version: number;
};
