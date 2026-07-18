import { ProfileSystemSelection } from '../entities/ProfileSystemSelection';

export type ProfileColorOption = {
  id: string;
  name: string;
  hexValue: string;
};

export const defaultProfileColorId = 'white';

export const profileColorOptions: ProfileColorOption[] = [
  { id: 'white', name: 'Beyaz', hexValue: '#FFFFFF' },
  { id: 'anthracite', name: 'Antrasit', hexValue: '#343A40' },
  { id: 'black', name: 'Siyah', hexValue: '#111111' },
  { id: 'cream', name: 'Krem', hexValue: '#F3E6C8' },
  { id: 'golden-oak', name: 'Altin Mese', hexValue: '#B47A3C' },
  { id: 'walnut', name: 'Ceviz', hexValue: '#6E4427' },
  { id: 'dark-oak', name: 'Koyu Mese', hexValue: '#4B2E1F' },
  { id: 'gray', name: 'Gri', hexValue: '#8A8F94' },
  { id: 'silver', name: 'Gumus', hexValue: '#C0C0C0' },
];

export function getProfileColorOption(colorId: string | null | undefined): ProfileColorOption {
  return (
    profileColorOptions.find((option) => option.id === colorId) ??
    parseCustomColor(colorId) ??
    { id: defaultProfileColorId, name: 'Beyaz', hexValue: '#FFFFFF' }
  );
}

export function getDesignProfileColor(profileSystem: ProfileSystemSelection | null): ProfileColorOption {
  return getProfileColorOption(profileSystem?.exteriorColorId ?? profileSystem?.interiorColorId);
}

export function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

export function createCustomColorId(hexValue: string): string {
  return `custom:${hexValue.trim().toUpperCase()}`;
}

function parseCustomColor(colorId: string | null | undefined): ProfileColorOption | null {
  if (!colorId?.startsWith('custom:')) {
    return null;
  }

  const hexValue = colorId.replace('custom:', '');
  if (!isValidHexColor(hexValue)) {
    return null;
  }

  return {
    id: colorId,
    name: 'Ozel renk',
    hexValue,
  };
}
