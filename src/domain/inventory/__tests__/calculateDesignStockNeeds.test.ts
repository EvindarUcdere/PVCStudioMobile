import { describe, expect, it } from 'vitest';

import { createEmptyDesignProject } from '../../designs/factories/createEmptyDesignProject';
import { calculateDesignStockNeeds } from '../calculateDesignStockNeeds';
import { StockItem } from '../entities/StockItem';

describe('calculateDesignStockNeeds', () => {
  it('compares estimated design material needs against active stock', () => {
    const design = {
      ...createEmptyDesignProject({ name: 'Test pencere', width: 1200, height: 1400 }),
      quantity: 2,
    };
    const stockItems: StockItem[] = [
      createStockItem({ type: 'pvc_profile', quantity: 100, unit: 'meter' }),
      createStockItem({ type: 'glass', quantity: 1, unit: 'square_meter' }),
      createStockItem({ type: 'hardware', quantity: 5, unit: 'piece' }),
      createStockItem({ type: 'pvc_profile', quantity: 999, unit: 'meter', isActive: false }),
    ];

    const needs = calculateDesignStockNeeds(design, stockItems);

    expect(needs.find((need) => need.id === 'profile')?.status).toBe('ok');
    expect(needs.find((need) => need.id === 'glass')?.status).toBe('missing');
    expect(needs.find((need) => need.id === 'glass')?.missingQuantity).toBeGreaterThan(0);
  });
});

function createStockItem(input: Partial<StockItem>): StockItem {
  return {
    id: `${input.type}-${input.unit}-${input.quantity}`,
    name: 'Test stok',
    type: input.type ?? 'pvc_profile',
    quantity: input.quantity ?? 0,
    unit: input.unit ?? 'meter',
    minimumQuantity: 0,
    purchasePrice: null,
    isActive: input.isActive ?? true,
    notes: null,
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
    syncStatus: 'local',
    version: 1,
  };
}
