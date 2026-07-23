import { createStockRepository } from '../../database/repositories/createRepositories';
import {
  hasStockConsumptionForDesign,
  saveStockConsumptionForDesign,
  StockConsumptionLine,
} from '../../database/repositories/StockConsumptionRepository';
import {
  backupStockConsumptionToCloud,
  backupStockItemToCloud,
  hasCloudStockConsumptionForDesign,
} from '../../services/firebase/fullSyncService';
import { DesignProject } from '../designs/entities/DesignProject';
import {
  defaultPriceEstimateRates,
  PriceEstimateRates,
} from '../designs/pricing/calculateDesignPriceEstimate';
import { calculateDesignStockNeeds } from './calculateDesignStockNeeds';
import { StockItem } from './entities/StockItem';

export type ConsumeDesignStockResult =
  | {
      status: 'consumed';
      lines: StockConsumptionLine[];
    }
  | {
      status: 'already-consumed';
    }
  | {
      status: 'missing-stock';
      message: string;
    };

export async function consumeDesignStock(
  design: DesignProject,
  rates: Partial<PriceEstimateRates> = defaultPriceEstimateRates,
): Promise<ConsumeDesignStockResult> {
  if ((await hasStockConsumptionForDesign(design.id)) || (await hasCloudStockConsumptionForDesign(design.id))) {
    return { status: 'already-consumed' };
  }

  const repository = await createStockRepository();
  const stockItems = await repository.list({ includeInactive: false, limit: 1000 });
  const needs = calculateDesignStockNeeds(design, stockItems, rates);
  const missingNeeds = needs.filter((need) => need.missingQuantity > 0);

  if (missingNeeds.length > 0) {
    return {
      status: 'missing-stock',
      message: missingNeeds
        .map((need) => `${need.label}: ${formatQuantity(need.missingQuantity)} eksik`)
        .join('\n'),
    };
  }

  const lines: StockConsumptionLine[] = [];

  for (const need of needs) {
    let remaining = need.requiredQuantity;
    const matchingStock = stockItems.filter(
      (item) => item.isActive && item.type === need.type && isCompatibleUnit(item, need.unit),
    );

    for (const item of matchingStock) {
      if (remaining <= 0) {
        break;
      }

      const consumedQuantity = Math.min(item.quantity, remaining);
      const updated = await repository.adjustQuantity(item.id, -consumedQuantity);
      void backupStockItemToCloud(updated);
      remaining = roundQuantity(remaining - consumedQuantity);
      lines.push({
        stockItemId: item.id,
        stockItemName: item.name,
        quantity: roundQuantity(consumedQuantity),
        unit: item.unit,
      });
    }
  }

  const consumedAt = new Date().toISOString();
  await saveStockConsumptionForDesign(design.id, lines, consumedAt);
  void backupStockConsumptionToCloud(design.id, consumedAt, lines);
  return { status: 'consumed', lines };
}

function isCompatibleUnit(item: StockItem, requiredUnit: string): boolean {
  return item.unit === requiredUnit || (requiredUnit === 'piece' && item.unit === 'set');
}

function formatQuantity(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}

function roundQuantity(value: number): number {
  return Math.round(value * 100) / 100;
}
