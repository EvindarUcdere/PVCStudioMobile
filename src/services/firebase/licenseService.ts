import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { logger } from '../logger';
import { ensureFirebaseUser } from './firebaseAuthService';
import { getFirebaseServices } from './firebaseConfig';

export type LicenseValidationResult =
  | {
      ok: true;
      companyId: string;
      companyName: string | null;
      maxUsers: number | null;
      activeUserCount: number;
    }
  | {
      ok: false;
      reason: 'firebase-not-configured' | 'not-found' | 'inactive' | 'expired' | 'user-limit' | 'unknown';
      message: string;
    };

type LicenseDocument = {
  companyId?: string;
  companyName?: string;
  isActive?: boolean;
  maxUsers?: number;
  expiresAt?: string | null;
  activeUserIds?: Record<string, boolean>;
};

export async function validateAndJoinLicense(companyId: string): Promise<LicenseValidationResult> {
  const services = getFirebaseServices();
  const user = await ensureFirebaseUser();

  if (!services || !user) {
    return {
      ok: false,
      reason: 'firebase-not-configured',
      message: 'Firebase hazir degil. Lisans kontrolu yapilamadi.',
    };
  }

  try {
    const licenseSnapshot = await getLicenseSnapshot(companyId);

    if (!licenseSnapshot) {
      return {
        ok: false,
        reason: 'not-found',
        message: 'Bu firma kodu icin aktif lisans bulunamadi.',
      };
    }

    const license = licenseSnapshot.data as LicenseDocument;
    if (license.isActive !== true) {
      return {
        ok: false,
        reason: 'inactive',
        message: 'Bu firma kodu aktif degil.',
      };
    }

    if (isExpired(license.expiresAt)) {
      return {
        ok: false,
        reason: 'expired',
        message: 'Bu firma kodunun lisans suresi dolmus.',
      };
    }

    const activeUserIds = license.activeUserIds ?? {};
    const alreadyJoined = activeUserIds[user.uid] === true;
    const activeUserCount = Object.values(activeUserIds).filter(Boolean).length;
    const maxUsers = typeof license.maxUsers === 'number' && license.maxUsers > 0 ? Math.floor(license.maxUsers) : null;

    if (!alreadyJoined && maxUsers !== null && activeUserCount >= maxUsers) {
      return {
        ok: false,
        reason: 'user-limit',
        message: `Bu lisans icin kullanici limiti dolu. Limit: ${maxUsers}`,
      };
    }

    await setDoc(
      licenseSnapshot.ref,
      {
        activeUserIds: {
          [user.uid]: true,
        },
        lastJoinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return {
      ok: true,
      companyId,
      companyName: license.companyName?.trim() || null,
      maxUsers,
      activeUserCount: alreadyJoined ? activeUserCount : activeUserCount + 1,
    };
  } catch (error) {
    logger.error('License validation failed', error);
    return {
      ok: false,
      reason: 'unknown',
      message: 'Lisans kontrolu sirasinda hata olustu.',
    };
  }
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) {
    return false;
  }

  const time = new Date(expiresAt).getTime();
  return Number.isFinite(time) && time < Date.now();
}

async function getLicenseSnapshot(companyId: string): Promise<{
  ref: ReturnType<typeof doc>;
  data: LicenseDocument;
} | null> {
  const services = getFirebaseServices();

  if (!services) {
    return null;
  }

  const licenseRef = doc(services.firestore, 'licenses', companyId);
  const snapshot = await getDoc(licenseRef);
  if (snapshot.exists()) {
    return { ref: licenseRef, data: snapshot.data() as LicenseDocument };
  }

  return null;
}
