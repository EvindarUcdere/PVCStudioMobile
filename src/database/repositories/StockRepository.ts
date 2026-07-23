import { StockItem, StockItemType, StockUnit } from '../../domain/inventory/entities/StockItem';

export type SaveStockItemInput = {
  id?: string;
  name: string;
  type: StockItemType;
  quantity: number;
  unit: StockUnit;
  minimumQuantity: number;
  purchasePrice?: number | null;
  isActive?: boolean;
  notes?: string | null;
  syncStatus?: StockItem['syncStatus'];
  version?: number;
};

export type ListStockItemsOptions = {
  includeInactive?: boolean;
  lowStockOnly?: boolean;
  limit?: number;
  offset?: number;
  type?: StockItemType;
};

export interface StockRepository {
  save(input: SaveStockItemInput): Promise<StockItem>;
  getById(id: string): Promise<StockItem | null>;
  list(options?: ListStockItemsOptions): Promise<StockItem[]>;
  setActive(id: string, isActive: boolean): Promise<StockItem>;
}
