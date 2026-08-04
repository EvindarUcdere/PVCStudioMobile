import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getStoredLicenseValidation,
  saveStoredLicenseValidation,
} from '../licenseOfflineStore';

const secureStore = vi.hoisted(() => ({
  setItemAsync: vi.fn(async (_key: string, _value: string) => undefined),
  getItemAsync: vi.fn(async (_key: string) => null as string | null),
}));

vi.mock('expo-secure-store', () => secureStore);

describe('license offline store', () => {
  beforeEach(() => {
    secureStore.setItemAsync.mockClear();
    secureStore.getItemAsync.mockClear();
  });

  it('uses Android SecureStore compatible keys', async () => {
    await saveStoredLicenseValidation({
      companyId: 'ALI/PVC:2026',
      lastValidatedAt: '2026-08-04T09:00:00.000Z',
      offlineEnabled: true,
      offlineGraceDays: 7,
    });

    const key = secureStore.setItemAsync.mock.calls[0]?.[0];

    expect(key).toBe('pvc-studio-license-validation_ALI_PVC_2026');
    expect(key).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('reads with the same sanitized key format', async () => {
    secureStore.getItemAsync.mockResolvedValueOnce(
      JSON.stringify({
        companyId: 'ALI/PVC:2026',
        lastValidatedAt: '2026-08-04T09:00:00.000Z',
        offlineEnabled: true,
        offlineGraceDays: 7,
      }),
    );

    const result = await getStoredLicenseValidation('ALI/PVC:2026');
    const key = secureStore.getItemAsync.mock.calls[0]?.[0];

    expect(key).toBe('pvc-studio-license-validation_ALI_PVC_2026');
    expect(result?.offlineEnabled).toBe(true);
  });
});
