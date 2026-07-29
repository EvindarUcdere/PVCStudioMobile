import { z } from 'zod';

import {
  defaultPriceEstimateRates,
  PriceEstimateRates,
} from '../../domain/designs/pricing/calculateDesignPriceEstimate';
import { getDatabase } from '../client';

const pricingSettingsKey = 'pricing_settings';

const priceEstimateRatesSchema: z.ZodType<PriceEstimateRates> = z.object({
  profileMeterPrice: z.number().nonnegative(),
  glassSquareMeterPrice: z.number().nonnegative(),
  openingPanelPrice: z.number().nonnegative(),
  fixedPanelPrice: z.number().nonnegative(),
  archSurcharge: z.number().nonnegative(),
  serviceLaborRate: z.number().nonnegative(),
  customColorMultiplier: z.number().nonnegative(),
  profileSystems: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      profileWidth: z.number().positive(),
      chamberCount: z.number().int().positive().nullable(),
      wallClass: z.enum(['A', 'B', 'C']).nullable(),
      meterPrice: z.number().nonnegative(),
    }),
  ),
  glassTypes: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      squareMeterPrice: z.number().nonnegative(),
      formula: z.string().nullable(),
      thickness: z.number().positive().nullable(),
      lowE: z.boolean(),
      tempered: z.boolean(),
      laminated: z.boolean(),
    }),
  ),
  colorMultipliers: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      multiplier: z.number().nonnegative(),
    }),
  ),
});

type MetadataRow = {
  value: string | null;
};

export async function getPricingSettings(): Promise<PriceEstimateRates> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<MetadataRow>(
    'SELECT value FROM app_metadata WHERE key = ? LIMIT 1;',
    [pricingSettingsKey],
  );

  if (!row?.value) {
    return defaultPriceEstimateRates;
  }

  try {
    return normalizePricingSettings(JSON.parse(row.value));
  } catch {
    return defaultPriceEstimateRates;
  }
}

export async function savePricingSettings(settings: Partial<PriceEstimateRates>): Promise<PriceEstimateRates> {
  const parsed = normalizePricingSettings(settings);
  const database = await getDatabase();

  await database.runAsync(
    `
      INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
      VALUES (?, ?, ?);
    `,
    [pricingSettingsKey, JSON.stringify(parsed), new Date().toISOString()],
  );

  return parsed;
}

export function normalizePricingSettings(value: unknown): PriceEstimateRates {
  const parsed = priceEstimateRatesSchema.safeParse(mergeWithDefaults(value));
  return parsed.success ? parsed.data : defaultPriceEstimateRates;
}

function mergeWithDefaults(value: unknown): PriceEstimateRates {
  if (!value || typeof value !== 'object') {
    return defaultPriceEstimateRates;
  }

  const legacyPartial = value as Partial<PriceEstimateRates> & { serviceLaborPrice?: number };
  const serviceLaborRate =
    typeof legacyPartial.serviceLaborRate === 'number'
      ? legacyPartial.serviceLaborRate
      : legacyServiceLaborPriceToRate(legacyPartial.serviceLaborPrice);

  return {
    ...defaultPriceEstimateRates,
    ...legacyPartial,
    serviceLaborRate,
    profileSystems: mergeOptionList(defaultPriceEstimateRates.profileSystems, legacyPartial.profileSystems),
    glassTypes: mergeOptionList(defaultPriceEstimateRates.glassTypes, legacyPartial.glassTypes),
    colorMultipliers: mergeOptionList(defaultPriceEstimateRates.colorMultipliers, legacyPartial.colorMultipliers),
  };
}

function legacyServiceLaborPriceToRate(value: number | undefined): number {
  if (typeof value !== 'number' || value <= 0) {
    return defaultPriceEstimateRates.serviceLaborRate;
  }

  const approximateTypicalMaterial = 5000;
  return Math.round((value / approximateTypicalMaterial) * 100);
}

function mergeOptionList<T extends { id: string }>(defaults: T[], saved: T[] | undefined): T[] {
  if (!Array.isArray(saved)) {
    return defaults;
  }

  return defaults.map((defaultOption) => ({
    ...defaultOption,
    ...saved.find((savedOption) => savedOption.id === defaultOption.id),
  }));
}
