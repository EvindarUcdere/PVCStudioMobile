export type StockItemType =
  | 'pvc_profile'
  | 'glass'
  | 'accessory'
  | 'hardware'
  | 'consumable'
  | 'other';

export type StockUnit = 'meter' | 'square_meter' | 'piece' | 'set' | 'kg' | 'box';

export type StockItem = {
  id: string;
  name: string;
  type: StockItemType;
  quantity: number;
  unit: StockUnit;
  minimumQuantity: number;
  purchasePrice: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'local' | 'pending' | 'synced' | 'conflict';
  version: number;
};

export const stockItemTypeLabels: Record<StockItemType, string> = {
  pvc_profile: 'PVC profil',
  glass: 'Cam',
  accessory: 'Aksesuar',
  hardware: 'Mekanizma',
  consumable: 'Sarf',
  other: 'Diger',
};

export const stockUnitLabels: Record<StockUnit, string> = {
  meter: 'metre',
  square_meter: 'm2',
  piece: 'adet',
  set: 'takim',
  kg: 'kg',
  box: 'kutu',
};
