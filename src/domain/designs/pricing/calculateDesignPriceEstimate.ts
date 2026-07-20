import { DesignProject } from '../entities/DesignProject';
import { GlassSelection } from '../entities/GlassSelection';
import { ProfileSystemSelection } from '../entities/ProfileSystemSelection';
import { defaultProfileColorId, getProfileColorOption } from '../colors/profileColorOptions';
import {
  calculateDesignMaterialSummary,
  DesignMaterialSummary,
} from '../measurement/calculateDesignMaterialSummary';

export type ProfileSystemPriceOption = {
  id: string;
  name: string;
  profileWidth: number;
  chamberCount: number | null;
  wallClass: 'A' | 'B' | 'C' | null;
  meterPrice: number;
};

export type GlassPriceOption = {
  id: string;
  name: string;
  squareMeterPrice: number;
  formula: string | null;
  thickness: number | null;
  lowE: boolean;
  tempered: boolean;
  laminated: boolean;
};

export type ColorPriceOption = {
  id: string;
  name: string;
  multiplier: number;
};

export type PriceEstimateRates = {
  profileMeterPrice: number;
  glassSquareMeterPrice: number;
  openingPanelPrice: number;
  fixedPanelPrice: number;
  archSurcharge: number;
  profileSystems: ProfileSystemPriceOption[];
  glassTypes: GlassPriceOption[];
  colorMultipliers: ColorPriceOption[];
  customColorMultiplier: number;
};

export type DesignPriceEstimate = {
  summary: DesignMaterialSummary;
  rates: PriceEstimateRates;
  selectedProfileSystem: ProfileSystemPriceOption;
  selectedGlassType: GlassPriceOption;
  selectedColor: ColorPriceOption;
  profileLengthMeters: number;
  glassAreaSquareMeters: number;
  profileSubtotal: number;
  glassSubtotal: number;
  hardwareSubtotal: number;
  colorMultiplier: number;
  archSubtotal: number;
  unitTotal: number;
  total: number;
};

export const defaultPriceEstimateRates: PriceEstimateRates = {
  profileMeterPrice: 420,
  glassSquareMeterPrice: 950,
  openingPanelPrice: 650,
  fixedPanelPrice: 120,
  archSurcharge: 850,
  customColorMultiplier: 1.22,
  profileSystems: [
    {
      id: 'economy-60',
      name: 'Ekonomik 60 mm',
      profileWidth: 60,
      chamberCount: 4,
      wallClass: 'C',
      meterPrice: 340,
    },
    {
      id: 'standard-70',
      name: 'Standart 70 mm',
      profileWidth: 70,
      chamberCount: 5,
      wallClass: 'B',
      meterPrice: 420,
    },
    {
      id: 'premium-76',
      name: 'Premium 76 mm',
      profileWidth: 76,
      chamberCount: 6,
      wallClass: 'A',
      meterPrice: 560,
    },
    {
      id: 'premium-82',
      name: 'Premium 82 mm',
      profileWidth: 82,
      chamberCount: 7,
      wallClass: 'A',
      meterPrice: 680,
    },
  ],
  glassTypes: [
    {
      id: 'single-clear',
      name: 'Tek cam',
      squareMeterPrice: 620,
      formula: '4 mm',
      thickness: 4,
      lowE: false,
      tempered: false,
      laminated: false,
    },
    {
      id: 'double-clear',
      name: 'Cift cam',
      squareMeterPrice: 950,
      formula: '4+12+4',
      thickness: 20,
      lowE: false,
      tempered: false,
      laminated: false,
    },
    {
      id: 'double-low-e',
      name: 'Low-E cift cam',
      squareMeterPrice: 1250,
      formula: '4 Low-E+12+4',
      thickness: 20,
      lowE: true,
      tempered: false,
      laminated: false,
    },
    {
      id: 'tempered-double',
      name: 'Temperli cift cam',
      squareMeterPrice: 1480,
      formula: '4T+12+4T',
      thickness: 20,
      lowE: false,
      tempered: true,
      laminated: false,
    },
  ],
  colorMultipliers: [
    { id: defaultProfileColorId, name: 'Beyaz', multiplier: 1 },
    { id: 'anthracite', name: 'Antrasit', multiplier: 1.18 },
    { id: 'black', name: 'Siyah', multiplier: 1.2 },
    { id: 'cream', name: 'Krem', multiplier: 1.08 },
    { id: 'golden-oak', name: 'Altin Mese', multiplier: 1.28 },
    { id: 'walnut', name: 'Ceviz', multiplier: 1.3 },
    { id: 'dark-oak', name: 'Koyu Mese', multiplier: 1.32 },
    { id: 'gray', name: 'Gri', multiplier: 1.12 },
    { id: 'silver', name: 'Gumus', multiplier: 1.1 },
  ],
};

export function calculateDesignPriceEstimate(
  design: DesignProject,
  inputRates: Partial<PriceEstimateRates> = defaultPriceEstimateRates,
): DesignPriceEstimate {
  const rates = normalizePriceEstimateRates(inputRates);
  const summary = calculateDesignMaterialSummary(design);
  const selectedProfileSystem = getSelectedProfileSystem(design.profileSystem, rates);
  const selectedGlassType = getSelectedGlassType(design.defaultGlass, rates);
  const selectedColor = getSelectedColor(design.profileSystem, rates);
  const profileLengthMeters = roundMoney(calculateProfileLengthMeters(summary));
  const glassAreaSquareMeters = roundMoney(calculateGlassAreaSquareMeters(summary));
  const colorMultiplier = selectedColor.multiplier;
  const profileSubtotal = roundMoney(profileLengthMeters * selectedProfileSystem.meterPrice * colorMultiplier);
  const glassSubtotal = roundMoney(glassAreaSquareMeters * selectedGlassType.squareMeterPrice);
  const hardwareSubtotal = roundMoney(
    summary.openingPanelCount * rates.openingPanelPrice + summary.fixedPanelCount * rates.fixedPanelPrice,
  );
  const archSubtotal = summary.archHeight ? rates.archSurcharge : 0;
  const unitTotal = roundMoney(profileSubtotal + glassSubtotal + hardwareSubtotal + archSubtotal);

  return {
    summary,
    rates,
    selectedProfileSystem,
    selectedGlassType,
    selectedColor,
    profileLengthMeters,
    glassAreaSquareMeters,
    profileSubtotal,
    glassSubtotal,
    hardwareSubtotal,
    colorMultiplier,
    archSubtotal,
    unitTotal,
    total: roundMoney(unitTotal * summary.quantity),
  };
}

export function getDefaultProfileSystemPriceOption(
  inputRates: Partial<PriceEstimateRates> = defaultPriceEstimateRates,
): ProfileSystemPriceOption {
  const rates = normalizePriceEstimateRates(inputRates);
  return rates.profileSystems.find((option) => option.id === 'standard-70') ?? rates.profileSystems[0]!;
}

export function getDefaultGlassPriceOption(
  inputRates: Partial<PriceEstimateRates> = defaultPriceEstimateRates,
): GlassPriceOption {
  const rates = normalizePriceEstimateRates(inputRates);
  return rates.glassTypes.find((option) => option.id === 'double-clear') ?? rates.glassTypes[0]!;
}

export function normalizePriceEstimateRates(
  inputRates: Partial<PriceEstimateRates> = defaultPriceEstimateRates,
): PriceEstimateRates {
  return {
    ...defaultPriceEstimateRates,
    ...inputRates,
    profileSystems: inputRates.profileSystems ?? defaultPriceEstimateRates.profileSystems,
    glassTypes: inputRates.glassTypes ?? defaultPriceEstimateRates.glassTypes,
    colorMultipliers: inputRates.colorMultipliers ?? defaultPriceEstimateRates.colorMultipliers,
    customColorMultiplier: inputRates.customColorMultiplier ?? defaultPriceEstimateRates.customColorMultiplier,
  };
}

function calculateProfileLengthMeters(summary: DesignMaterialSummary): number {
  const outerPerimeter = ((summary.designWidth + summary.designHeight) * 2) / 1000;
  const panelPerimeters = summary.panels.reduce(
    (total, panel) => total + ((panel.panelWidth + panel.panelHeight) * 2) / 1000,
    0,
  );

  return outerPerimeter + panelPerimeters * 0.55;
}

function calculateGlassAreaSquareMeters(summary: DesignMaterialSummary): number {
  return summary.panels.reduce(
    (total, panel) => total + (panel.glassWidth * panel.glassHeight) / 1_000_000,
    0,
  );
}

function getSelectedProfileSystem(
  profileSystem: ProfileSystemSelection | null,
  rates: PriceEstimateRates,
): ProfileSystemPriceOption {
  const fallback = getDefaultProfileSystemPriceOption(rates);
  const selected = rates.profileSystems.find((option) => option.id === profileSystem?.seriesId);
  return selected ?? { ...fallback, meterPrice: rates.profileMeterPrice };
}

function getSelectedGlassType(
  glass: GlassSelection | null,
  rates: PriceEstimateRates,
): GlassPriceOption {
  const fallback = getDefaultGlassPriceOption(rates);
  const selected = rates.glassTypes.find((option) => option.id === glass?.glassTypeId);
  return selected ?? { ...fallback, squareMeterPrice: rates.glassSquareMeterPrice };
}

function getSelectedColor(
  profileSystem: ProfileSystemSelection | null,
  rates: PriceEstimateRates,
): ColorPriceOption {
  const colorId = profileSystem?.exteriorColorId ?? profileSystem?.interiorColorId ?? defaultProfileColorId;
  const selected = rates.colorMultipliers.find((option) => option.id === colorId);

  if (selected) {
    return selected;
  }

  const color = getProfileColorOption(colorId);
  return {
    id: color.id,
    name: color.name,
    multiplier: color.id === defaultProfileColorId ? 1 : rates.customColorMultiplier,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
