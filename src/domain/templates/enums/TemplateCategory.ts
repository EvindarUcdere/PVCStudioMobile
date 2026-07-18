export const templateCategories = [
  'window',
  'door',
  'balcony',
  'sliding',
  'tilt',
  'special',
] as const;

export type TemplateCategory = (typeof templateCategories)[number];

export const templateCategoryLabels: Record<TemplateCategory, string> = {
  window: 'Pencere',
  door: 'Kapı',
  balcony: 'Balkon',
  sliding: 'Sürme',
  tilt: 'Vasistas',
  special: 'Özel',
};
