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
    const parsed = priceEstimateRatesSchema.safeParse(mergeWithDefaults(JSON.parse(row.value)));
    return parsed.success ? parsed.data : defaultPriceEstimateRates;
  } catch {
    return defaultPriceEstimateRates;
  }
}

export async function savePricingSettings(settings: PriceEstimateRates): Promise<PriceEstimateRates> {
  const parsed = priceEstimateRatesSchema.parse(settings);
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

function mergeWithDefaults(value: unknown): PriceEstimateRates {
  if (!value || typeof value !== 'object') {
    return defaultPriceEstimateRates;
  }

  const partial = value as Partial<PriceEstimateRates>;

  return {
    ...defaultPriceEstimateRates,
    ...partial,
    profileSystems: mergeOptionList(defaultPriceEstimateRates.profileSystems, partial.profileSystems),
    glassTypes: mergeOptionList(defaultPriceEstimateRates.glassTypes, partial.glassTypes),
    colorMultipliers: mergeOptionList(defaultPriceEstimateRates.colorMultipliers, partial.colorMultipliers),
  };
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
