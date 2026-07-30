import { deleteField, doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';

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

export type LicenseSeat = {
  userId: string;
  isCurrentDevice: boolean;
};

export type LicenseSeatSummary = {
  companyId: string;
  companyName: string | null;
  maxUsers: number | null;
  activeUserCount: number;
  seats: LicenseSeat[];
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

    const joined = await runTransaction(services.firestore, async (transaction) => {
      const latestSnapshot = await transaction.get(licenseSnapshot.ref);
      if (!latestSnapshot.exists()) {
        return null;
      }

      const latestLicense = latestSnapshot.data() as LicenseDocument;
      if (latestLicense.isActive !== true || isExpired(latestLicense.expiresAt)) {
        return null;
      }

      const latestActiveUserIds = latestLicense.activeUserIds ?? {};
      const latestAlreadyJoined = latestActiveUserIds[user.uid] === true;
      const latestActiveUserCount = Object.values(latestActiveUserIds).filter(Boolean).length;
      const latestMaxUsers =
        typeof latestLicense.maxUsers === 'number' && latestLicense.maxUsers > 0
          ? Math.floor(latestLicense.maxUsers)
          : null;

      if (!latestAlreadyJoined && latestMaxUsers !== null && latestActiveUserCount >= latestMaxUsers) {
        return {
          ok: false as const,
          reason: 'user-limit' as const,
          message: `Bu lisans icin kullanici limiti dolu. Limit: ${latestMaxUsers}`,
        };
      }

      transaction.set(
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
        ok: true as const,
        companyName: latestLicense.companyName?.trim() || null,
        maxUsers: latestMaxUsers,
        activeUserCount: latestAlreadyJoined ? latestActiveUserCount : latestActiveUserCount + 1,
      };
    });

    if (!joined) {
      return {
        ok: false,
        reason: 'unknown',
        message: 'Lisans kontrolu sirasinda hata olustu.',
      };
    }

    if (!joined.ok) {
      return joined;
    }

    return {
      ok: true,
      companyId,
      companyName: joined.companyName,
      maxUsers: joined.maxUsers,
      activeUserCount: joined.activeUserCount,
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

export async function getLicenseSeatSummary(companyId: string): Promise<LicenseSeatSummary | null> {
  const services = getFirebaseServices();
  const user = await ensureFirebaseUser();

  if (!services || !user) {
    return null;
  }

  try {
    const licenseSnapshot = await getLicenseSnapshot(companyId);
    if (!licenseSnapshot) {
      return null;
    }

    const license = licenseSnapshot.data;
    const activeUserIds = license.activeUserIds ?? {};
    const seats = Object.entries(activeUserIds)
      .filter(([, isActive]) => isActive === true)
      .map(([userId]) => ({
        userId,
        isCurrentDevice: userId === user.uid,
      }));
    const maxUsers = typeof license.maxUsers === 'number' && license.maxUsers > 0 ? Math.floor(license.maxUsers) : null;

    return {
      companyId,
      companyName: license.companyName?.trim() || null,
      maxUsers,
      activeUserCount: seats.length,
      seats,
    };
  } catch (error) {
    logger.error('License seat summary failed', error);
    return null;
  }
}

export async function releaseCurrentLicenseSeat(companyId: string): Promise<boolean> {
  const services = getFirebaseServices();
  const user = await ensureFirebaseUser();

  if (!services || !user) {
    return false;
  }

  try {
    const licenseRef = doc(services.firestore, 'licenses', companyId);
    await runTransaction(services.firestore, async (transaction) => {
      const snapshot = await transaction.get(licenseRef);
      if (!snapshot.exists()) {
        return;
      }

      const license = snapshot.data() as LicenseDocument;
      const updates: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
        [`activeUserIds.${user.uid}`]: deleteField(),
      };

      Object.entries(license.activeUserIds ?? {}).forEach(([activeSeatId, isActive]) => {
        if (isActive !== true) {
          updates[`activeUserIds.${activeSeatId}`] = deleteField();
        }
      });

      transaction.update(licenseRef, updates);
    });
    return true;
  } catch (error) {
    logger.error('License seat release failed', error);
    return false;
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
