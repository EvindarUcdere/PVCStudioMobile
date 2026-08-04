import { describe, expect, it, vi } from 'vitest';

import { createLicenseGuard } from '../licenseGuard';
import { LicenseValidationResult } from '../licenseService';

vi.mock('../companyWorkspaceService', () => ({
  getActiveCompanyId: vi.fn(),
}));

vi.mock('../licenseService', () => ({
  validateAndJoinLicense: vi.fn(),
}));

vi.mock('../licenseOfflineStore', () => ({
  getStoredLicenseValidation: vi.fn(),
  saveStoredLicenseValidation: vi.fn(),
}));

const validLicense: LicenseValidationResult = {
  ok: true,
  companyId: 'ALI-PVC-2026',
  companyName: 'Ali PVC',
  maxUsers: 3,
  activeUserCount: 1,
  offlineEnabled: true,
  offlineGraceDays: 7,
};

function createTestGuard(
  overrides: Partial<Parameters<typeof createLicenseGuard>[0]> = {},
) {
  return createLicenseGuard({
    getActiveCompanyId: async () => 'ALI-PVC-2026',
    validateAndJoinLicense: async () => validLicense,
    getStoredLicenseValidation: async () => null,
    saveStoredLicenseValidation: async () => undefined,
    now: () => new Date('2026-08-04T09:00:00.000Z'),
    ...overrides,
  });
}

describe('license guard', () => {
  it('rejects access when no local company code exists', async () => {
    const validateAndJoinLicense = vi.fn();
    const guard = createTestGuard({
      getActiveCompanyId: async () => null,
      validateAndJoinLicense,
    });

    const result = await guard.verifyActiveCompanyLicense();

    expect(result).toMatchObject({ ok: false, reason: 'missing-company' });
    expect(validateAndJoinLicense).not.toHaveBeenCalled();
  });

  it('deduplicates rapid license checks', async () => {
    const validateAndJoinLicense = vi.fn(async () => validLicense);
    const saveStoredLicenseValidation = vi.fn(async () => undefined);
    const guard = createTestGuard({
      validateAndJoinLicense,
      saveStoredLicenseValidation,
    });

    const [first, second, third] = await Promise.all([
      guard.verifyActiveCompanyLicense(),
      guard.verifyActiveCompanyLicense(),
      guard.verifyActiveCompanyLicense(),
    ]);

    expect(validateAndJoinLicense).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(second).toEqual(third);
    expect(first.ok).toBe(true);
    expect(saveStoredLicenseValidation).toHaveBeenCalledTimes(1);
  });

  it('keeps one in-flight request during slow network', async () => {
    let resolveLicense: (result: LicenseValidationResult) => void = () => undefined;
    const slowLicensePromise = new Promise<LicenseValidationResult>((resolve) => {
      resolveLicense = resolve;
    });
    const validateAndJoinLicense = vi.fn(() => slowLicensePromise);
    const guard = createTestGuard({
      validateAndJoinLicense,
    });

    const first = guard.verifyActiveCompanyLicense();
    const second = guard.verifyActiveCompanyLicense();
    await Promise.resolve();

    expect(validateAndJoinLicense).toHaveBeenCalledTimes(1);
    resolveLicense(validLicense);

    await expect(first).resolves.toMatchObject({ ok: true, companyId: 'ALI-PVC-2026' });
    await expect(second).resolves.toMatchObject({ ok: true, companyId: 'ALI-PVC-2026' });
  });

  it('returns a controlled failure when Firebase validation throws and offline is not enabled', async () => {
    const validateAndJoinLicense = vi.fn(async () => {
      throw new Error('network failed');
    });
    const guard = createTestGuard({
      validateAndJoinLicense,
    });

    const result = await guard.verifyActiveCompanyLicense();

    expect(result).toMatchObject({
      ok: false,
      reason: 'offline-not-allowed',
      message: 'Internet olmadan giris icin bu firmada offline lisans aktif degil.',
    });
  });

  it('allows retry after a failed Firebase validation', async () => {
    const validateAndJoinLicense = vi
      .fn<() => Promise<LicenseValidationResult>>()
      .mockRejectedValueOnce(new Error('temporary error'))
      .mockResolvedValueOnce(validLicense);
    const guard = createTestGuard({
      validateAndJoinLicense,
    });

    await expect(guard.verifyActiveCompanyLicense()).resolves.toMatchObject({
      ok: false,
      reason: 'offline-not-allowed',
    });
    await expect(guard.verifyActiveCompanyLicense()).resolves.toMatchObject({ ok: true, companyId: 'ALI-PVC-2026' });
    expect(validateAndJoinLicense).toHaveBeenCalledTimes(2);
  });

  it('allows offline access only inside paid grace period', async () => {
    const guard = createTestGuard({
      validateAndJoinLicense: async () => ({
        ok: false,
        reason: 'unknown',
        message: 'network failed',
      }),
      getStoredLicenseValidation: async () => ({
        companyId: 'ALI-PVC-2026',
        lastValidatedAt: '2026-08-01T09:00:00.000Z',
        offlineEnabled: true,
        offlineGraceDays: 7,
      }),
    });

    await expect(guard.verifyActiveCompanyLicense()).resolves.toMatchObject({
      ok: true,
      companyId: 'ALI-PVC-2026',
      source: 'offline-grace',
    });
  });

  it('blocks offline access when paid grace period expired', async () => {
    const guard = createTestGuard({
      validateAndJoinLicense: async () => ({
        ok: false,
        reason: 'unknown',
        message: 'network failed',
      }),
      getStoredLicenseValidation: async () => ({
        companyId: 'ALI-PVC-2026',
        lastValidatedAt: '2026-07-01T09:00:00.000Z',
        offlineEnabled: true,
        offlineGraceDays: 7,
      }),
    });

    await expect(guard.verifyActiveCompanyLicense()).resolves.toMatchObject({
      ok: false,
      reason: 'offline-grace-expired',
    });
  });
});
