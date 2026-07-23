import { DesignProject } from '../designs/entities/DesignProject';
import {
  calculateDesignPriceEstimate,
  defaultPriceEstimateRates,
  PriceEstimateRates,
} from '../designs/pricing/calculateDesignPriceEstimate';
import { StockItem, StockItemType, StockUnit } from './entities/StockItem';

export type DesignStockNeedStatus = 'ok' | 'low' | 'missing';

export type DesignStockNeed = {
  id: string;
  type: StockItemType;
  label: string;
  requiredQuantity: number;
  availableQuantity: number;
  missingQuantity: number;
  unit: StockUnit;
  status: DesignStockNeedStatus;
  detail: string;
};

export function calculateDesignStockNeeds(
  design: DesignProject,
  stockItems: StockItem[],
  rates: Partial<PriceEstimateRates> = defaultPriceEstimateRates,
): DesignStockNeed[] {
  const estimate = calculateDesignPriceEstimate(design, rates);
  const quantity = estimate.summary.quantity;
  const profileNeed = estimate.profileLengthMeters * quantity;
  const glassNeed = estimate.glassAreaSquareMeters * quantity;
  const hardwareNeed = estimate.summary.openingPanelCount * quantity;

  return [
    createNeed({
      id: 'profile',
      type: 'pvc_profile',
      label: `${estimate.selectedProfileSystem.name} profil`,
      requiredQuantity: profileNeed,
      unit: 'meter',
      detail: `Renk: ${estimate.selectedColor.name}`,
      stockItems,
    }),
    createNeed({
      id: 'glass',
      type: 'glass',
      label: estimate.selectedGlassType.name,
      requiredQuantity: glassNeed,
      unit: 'square_meter',
      detail: `${estimate.summary.glassCount * quantity} cam parcasi`,
      stockItems,
    }),
    createNeed({
      id: 'hardware',
      type: 'hardware',
      label: 'Acilim mekanizmasi',
      requiredQuantity: hardwareNeed,
      unit: 'piece',
      detail: `${estimate.summary.openingPanelCount * quantity} acilir kanat`,
      stockItems,
    }),
  ].filter((need) => need.requiredQuantity > 0);
}

function createNeed({
  id,
  type,
  label,
  requiredQuantity,
  unit,
  detail,
  stockItems,
}: {
  id: string;
  type: StockItemType;
  label: string;
  requiredQuantity: number;
  unit: StockUnit;
  detail: string;
  stockItems: StockItem[];
}): DesignStockNeed {
  const availableQuantity = sumAvailableStock(stockItems, type, unit);
  const missingQuantity = Math.max(0, requiredQuantity - availableQuantity);

  return {
    id,
    type,
    label,
    requiredQuantity: roundQuantity(requiredQuantity),
    availableQuantity: roundQuantity(availableQuantity),
    missingQuantity: roundQuantity(missingQuantity),
    unit,
    status: getNeedStatus(requiredQuantity, availableQuantity),
    detail,
  };
}

function sumAvailableStock(stockItems: StockItem[], type: StockItemType, unit: StockUnit): number {
  return stockItems
    .filter((item) => item.isActive && item.type === type && isCompatibleUnit(item.unit, unit))
    .reduce((total, item) => total + item.quantity, 0);
}

function isCompatibleUnit(stockUnit: StockUnit, requiredUnit: StockUnit): boolean {
  if (stockUnit === requiredUnit) {
    return true;
  }

  return requiredUnit === 'piece' && stockUnit === 'set';
}

function getNeedStatus(requiredQuantity: number, availableQuantity: number): DesignStockNeedStatus {
  if (availableQuantity < requiredQuantity) {
    return 'missing';
  }

  if (availableQuantity <= requiredQuantity * 1.15) {
    return 'low';
  }

  return 'ok';
}

function roundQuantity(value: number): number {
  return Math.round(value * 100) / 100;
}
