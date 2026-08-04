import * as SecureStore from 'expo-secure-store';

export type StoredLicenseValidation = {
  companyId: string;
  lastValidatedAt: string;
  offlineEnabled: boolean;
  offlineGraceDays: number;
};

const keyPrefix = 'pvc-studio-license-validation';

export async function saveStoredLicenseValidation(snapshot: StoredLicenseValidation): Promise<void> {
  await SecureStore.setItemAsync(getStorageKey(snapshot.companyId), JSON.stringify(snapshot));
}

export async function getStoredLicenseValidation(companyId: string): Promise<StoredLicenseValidation | null> {
  const raw = await SecureStore.getItemAsync(getStorageKey(companyId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredLicenseValidation>;
    if (
      parsed.companyId !== companyId ||
      typeof parsed.lastValidatedAt !== 'string' ||
      typeof parsed.offlineEnabled !== 'boolean' ||
      typeof parsed.offlineGraceDays !== 'number'
    ) {
      return null;
    }

    return {
      companyId: parsed.companyId,
      lastValidatedAt: parsed.lastValidatedAt,
      offlineEnabled: parsed.offlineEnabled,
      offlineGraceDays: Math.max(0, Math.floor(parsed.offlineGraceDays)),
    };
  } catch {
    return null;
  }
}

function getStorageKey(companyId: string): string {
  const normalizedCompanyId = String(companyId).replace(/[^A-Z0-9._-]/gi, '_');
  return `${keyPrefix}_${normalizedCompanyId}`;
}
