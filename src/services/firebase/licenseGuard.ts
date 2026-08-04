import { getActiveCompanyId } from './companyWorkspaceService';
import {
  getStoredLicenseValidation,
  saveStoredLicenseValidation,
  StoredLicenseValidation,
} from './licenseOfflineStore';
import { LicenseValidationResult, validateAndJoinLicense } from './licenseService';

export type LicenseGuardResult =
  | {
      ok: true;
      companyId: string;
      license: Extract<LicenseValidationResult, { ok: true }>;
      source: 'firebase' | 'offline-grace';
    }
  | {
      ok: false;
      reason:
        | 'missing-company'
        | 'offline-not-allowed'
        | 'offline-grace-expired'
        | Extract<LicenseValidationResult, { ok: false }>['reason'];
      message: string;
    };

export type LicenseGuardDeps = {
  getActiveCompanyId: () => Promise<string | null>;
  validateAndJoinLicense: (companyId: string) => Promise<LicenseValidationResult>;
  getStoredLicenseValidation: (companyId: string) => Promise<StoredLicenseValidation | null>;
  saveStoredLicenseValidation: (snapshot: StoredLicenseValidation) => Promise<void>;
  now: () => Date;
};

const defaultDeps: LicenseGuardDeps = {
  getActiveCompanyId,
  validateAndJoinLicense,
  getStoredLicenseValidation,
  saveStoredLicenseValidation,
  now: () => new Date(),
};

let activeLicenseCheckPromise: Promise<LicenseGuardResult> | null = null;

export function createLicenseGuard(deps: LicenseGuardDeps) {
  let inFlight: Promise<LicenseGuardResult> | null = null;

  return {
    async verifyActiveCompanyLicense(): Promise<LicenseGuardResult> {
      if (inFlight) {
        return inFlight;
      }

      inFlight = verifyWithDeps(deps).finally(() => {
        inFlight = null;
      });

      return inFlight;
    },
  };
}

export async function verifyActiveCompanyLicense(): Promise<LicenseGuardResult> {
  if (activeLicenseCheckPromise) {
    return activeLicenseCheckPromise;
  }

  activeLicenseCheckPromise = verifyWithDeps(defaultDeps).finally(() => {
    activeLicenseCheckPromise = null;
  });

  return activeLicenseCheckPromise;
}

async function verifyWithDeps(deps: LicenseGuardDeps): Promise<LicenseGuardResult> {
  const companyId = await deps.getActiveCompanyId();
  if (!companyId) {
    return {
      ok: false,
      reason: 'missing-company',
      message: 'Uygulamayi kullanmak icin firma kodu girilmeli.',
    };
  }

  try {
    const license = await deps.validateAndJoinLicense(companyId);
    if (!license.ok) {
      if (license.reason === 'unknown') {
        return verifyOfflineGrace(companyId, deps);
      }

      return license;
    }

    await deps.saveStoredLicenseValidation({
      companyId,
      lastValidatedAt: deps.now().toISOString(),
      offlineEnabled: license.offlineEnabled,
      offlineGraceDays: license.offlineGraceDays,
    });

    return {
      ok: true,
      companyId,
      license,
      source: 'firebase',
    };
  } catch {
    return verifyOfflineGrace(companyId, deps);
  }
}

async function verifyOfflineGrace(companyId: string, deps: LicenseGuardDeps): Promise<LicenseGuardResult> {
  const storedLicense = await deps.getStoredLicenseValidation(companyId);

  if (!storedLicense?.offlineEnabled) {
    return {
      ok: false,
      reason: 'offline-not-allowed',
      message: 'Internet olmadan giris icin bu firmada offline lisans aktif degil.',
    };
  }

  const graceDays = Math.max(0, Math.floor(storedLicense.offlineGraceDays));
  const lastValidatedAt = new Date(storedLicense.lastValidatedAt).getTime();
  if (!Number.isFinite(lastValidatedAt) || graceDays <= 0) {
    return {
      ok: false,
      reason: 'offline-grace-expired',
      message: 'Offline kullanim suresi doldu. Devam etmek icin internete baglanin.',
    };
  }

  const expiresAt = lastValidatedAt + graceDays * 24 * 60 * 60 * 1000;
  if (deps.now().getTime() > expiresAt) {
    return {
      ok: false,
      reason: 'offline-grace-expired',
      message: 'Offline kullanim suresi doldu. Devam etmek icin internete baglanin.',
    };
  }

  return {
    ok: true,
    companyId,
    source: 'offline-grace',
    license: {
      ok: true,
      companyId,
      companyName: null,
      maxUsers: null,
      activeUserCount: 0,
      offlineEnabled: true,
      offlineGraceDays: graceDays,
    },
  };
}
