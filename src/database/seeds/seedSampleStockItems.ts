import { StockItem } from '../../domain/inventory/entities/StockItem';
import { createStockRepository } from '../repositories/createRepositories';
import { SaveStockItemInput } from '../repositories/StockRepository';

export type SampleStockSeedResult = {
  created: number;
  skipped: number;
  savedItems: StockItem[];
};

const sampleStockItems: SaveStockItemInput[] = [
  {
    id: 'sample-stock-profile-standard-70-white',
    name: 'Standart 70 mm beyaz PVC profil',
    type: 'pvc_profile',
    quantity: 120,
    unit: 'meter',
    minimumQuantity: 30,
    purchasePrice: 420,
    notes: 'Test icin ana beyaz profil stogu.',
  },
  {
    id: 'sample-stock-profile-standard-70-anthracite',
    name: 'Standart 70 mm antrasit PVC profil',
    type: 'pvc_profile',
    quantity: 60,
    unit: 'meter',
    minimumQuantity: 20,
    purchasePrice: 520,
    notes: 'Renkli profil testleri icin.',
  },
  {
    id: 'sample-stock-profile-premium-76-white',
    name: 'Premium 76 mm beyaz PVC profil',
    type: 'pvc_profile',
    quantity: 45,
    unit: 'meter',
    minimumQuantity: 15,
    purchasePrice: 560,
    notes: 'Premium seri denemeleri icin.',
  },
  {
    id: 'sample-stock-glass-double-clear',
    name: 'Cift cam 4+12+4',
    type: 'glass',
    quantity: 38,
    unit: 'square_meter',
    minimumQuantity: 8,
    purchasePrice: 950,
    notes: 'Klasik pencere teklifleri icin yaygin cam.',
  },
  {
    id: 'sample-stock-glass-double-low-e',
    name: 'Low-E cift cam',
    type: 'glass',
    quantity: 18,
    unit: 'square_meter',
    minimumQuantity: 6,
    purchasePrice: 1250,
    notes: 'Isicam/Low-E fiyat ve stok testi.',
  },
  {
    id: 'sample-stock-hardware-opening-kit',
    name: 'Acilim mekanizmasi takim',
    type: 'hardware',
    quantity: 42,
    unit: 'piece',
    minimumQuantity: 10,
    purchasePrice: 260,
    notes: 'Acilir kanatlar icin genel mekanizma.',
  },
  {
    id: 'sample-stock-hardware-tilt-kit',
    name: 'Vasistas makas mekanizmasi',
    type: 'hardware',
    quantity: 18,
    unit: 'piece',
    minimumQuantity: 6,
    purchasePrice: 190,
    notes: 'Vasistas acilim testleri icin.',
  },
  {
    id: 'sample-stock-accessory-white-handle',
    name: 'Beyaz pencere kolu',
    type: 'accessory',
    quantity: 55,
    unit: 'piece',
    minimumQuantity: 15,
    purchasePrice: 75,
    notes: 'Acilir paneller icin kol stogu.',
  },
  {
    id: 'sample-stock-accessory-anthracite-handle',
    name: 'Antrasit pencere kolu',
    type: 'accessory',
    quantity: 24,
    unit: 'piece',
    minimumQuantity: 8,
    purchasePrice: 95,
    notes: 'Renkli profil isleri icin kol stogu.',
  },
  {
    id: 'sample-stock-consumable-seal',
    name: 'PVC conta',
    type: 'consumable',
    quantity: 12,
    unit: 'kg',
    minimumQuantity: 3,
    purchasePrice: 180,
    notes: 'Montaj ve uretim sarf denemesi.',
  },
  {
    id: 'sample-stock-consumable-screw',
    name: 'Montaj vida ve dubel kutusu',
    type: 'consumable',
    quantity: 9,
    unit: 'box',
    minimumQuantity: 3,
    purchasePrice: 320,
    notes: 'Montaj sarf malzemesi.',
  },
];

export async function seedSampleStockItems(): Promise<SampleStockSeedResult> {
  const repository = await createStockRepository();
  const savedItems: StockItem[] = [];
  let skipped = 0;

  for (const item of sampleStockItems) {
    if (item.id && (await repository.getById(item.id))) {
      skipped += 1;
      continue;
    }

    savedItems.push(await repository.save(item));
  }

  return {
    created: savedItems.length,
    skipped,
    savedItems,
  };
}
