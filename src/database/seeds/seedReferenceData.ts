import { MigrationDatabase } from '../migrations/types';

type ReferenceRow = {
  id: string;
  name: string;
};

const createdAt = '2026-01-01T00:00:00.000Z';

const profileBrands: ReferenceRow[] = [
  { id: 'sample-brand-a', name: 'Örnek Marka A' },
  { id: 'sample-brand-b', name: 'Örnek Marka B' },
];

const profileSeries = [
  {
    id: 'standard-70',
    brandId: 'sample-brand-a',
    name: 'Standart 70',
    profileWidth: 70,
    chamberCount: 5,
    wallClass: 'B',
    gasketCount: 2,
  },
  {
    id: 'premium-80',
    brandId: 'sample-brand-b',
    name: 'Premium 80',
    profileWidth: 80,
    chamberCount: 6,
    wallClass: 'A',
    gasketCount: 3,
  },
];

const profileColors = [
  { id: 'white', name: 'Beyaz', hexValue: '#FFFFFF' },
  { id: 'anthracite', name: 'Antrasit', hexValue: '#343A40' },
  { id: 'black', name: 'Siyah', hexValue: '#111111' },
  { id: 'cream', name: 'Krem', hexValue: '#F3E6C8' },
  { id: 'golden-oak', name: 'Altın Meşe', hexValue: '#B47A3C' },
  { id: 'walnut', name: 'Ceviz', hexValue: '#6E4427' },
  { id: 'dark-oak', name: 'Koyu Meşe', hexValue: '#4B2E1F' },
  { id: 'gray', name: 'Gri', hexValue: '#8A8F94' },
  { id: 'silver', name: 'Gümüş', hexValue: '#C0C0C0' },
];

const glassTypes = [
  { id: 'single-glass', name: 'Tek Cam', formula: '4', thickness: 4 },
  { id: 'double-glass', name: 'Çift Cam', formula: '4 + 16 + 4', thickness: 24 },
  { id: 'triple-glass', name: 'Üçlü Cam', formula: '4 + 12 + 4 + 12 + 4', thickness: 36 },
  { id: 'insulated-glass', name: 'Isıcam', formula: '4 + 16 + 4', thickness: 24 },
  { id: 'low-e', name: 'Low-E', formula: null, thickness: null },
  { id: 'laminated', name: 'Lamine', formula: null, thickness: null },
  { id: 'tempered', name: 'Temperli', formula: null, thickness: null },
  { id: 'smoked', name: 'Füme', formula: null, thickness: null },
  { id: 'reflective', name: 'Reflekte', formula: null, thickness: null },
  { id: 'frosted', name: 'Buzlu', formula: null, thickness: null },
  { id: 'patterned', name: 'Desenli', formula: null, thickness: null },
];

const accessoryTypes = [
  'Sineklik',
  'Panjur',
  'Denizlik',
  'Alüminyum Eşik',
  'Çocuk Kilidi',
  'Güvenlik Kolu',
  'Standart Kol',
  'Kilit',
  'Havalandırma',
  'Montaj',
  'Söküm',
].map((name) => ({
  id: name
    .toLocaleLowerCase('tr-TR')
    .replaceAll(' ', '-')
    .replaceAll('ı', 'i')
    .replaceAll('ü', 'u')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ğ', 'g')
    .replaceAll('ç', 'c'),
  name,
}));

export async function seedReferenceData(database: MigrationDatabase): Promise<void> {
  for (const brand of profileBrands) {
    await database.runAsync(
      `INSERT OR IGNORE INTO profile_brands (id, name, is_active, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?);`,
      [brand.id, brand.name, createdAt, createdAt],
    );
  }

  for (const series of profileSeries) {
    await database.runAsync(
      `INSERT OR IGNORE INTO profile_series
       (id, brand_id, name, profile_width, chamber_count, wall_class, gasket_count, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?);`,
      [
        series.id,
        series.brandId,
        series.name,
        series.profileWidth,
        series.chamberCount,
        series.wallClass,
        series.gasketCount,
        createdAt,
        createdAt,
      ],
    );
  }

  for (const color of profileColors) {
    await database.runAsync(
      `INSERT OR IGNORE INTO profile_colors
       (id, name, hex_value, texture_asset, is_active, created_at, updated_at)
       VALUES (?, ?, ?, NULL, 1, ?, ?);`,
      [color.id, color.name, color.hexValue, createdAt, createdAt],
    );
  }

  for (const glassType of glassTypes) {
    await database.runAsync(
      `INSERT OR IGNORE INTO glass_types
       (id, name, default_formula, default_thickness, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?);`,
      [glassType.id, glassType.name, glassType.formula, glassType.thickness, createdAt, createdAt],
    );
  }

  for (const accessoryType of accessoryTypes) {
    await database.runAsync(
      `INSERT OR IGNORE INTO accessory_types
       (id, name, category, is_active, created_at, updated_at)
       VALUES (?, ?, 'general', 1, ?, ?);`,
      [accessoryType.id, accessoryType.name, createdAt, createdAt],
    );
  }
}
