import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { getCompanyProfile } from '../../database/repositories/CompanyProfileRepository';
import { createId } from '../../domain/designs/utils/id';
import { logger } from '../logger';
import { ensureFirebaseUser } from './firebaseAuthService';
import { getFirebaseServices } from './firebaseConfig';

export async function getActiveCompanyId(): Promise<string | null> {
  const profile = await getCompanyProfile();
  const companyId = normalizeCompanyId(profile.companyId);
  return companyId || null;
}

export async function getCloudWorkspacePath(): Promise<
  { rootCollection: 'companies'; rootId: string; userId: string } | null
> {
  const services = getFirebaseServices();
  const user = await ensureFirebaseUser();
  const companyId = await getActiveCompanyId();

  if (!services || !user || !companyId) {
    return null;
  }

  return {
    rootCollection: 'companies',
    rootId: companyId,
    userId: user.uid,
  };
}

export async function ensureCompanyWorkspace(): Promise<string | null> {
  const services = getFirebaseServices();
  const user = await ensureFirebaseUser();
  const companyId = await getActiveCompanyId();

  if (!services || !user || !companyId) {
    return null;
  }

  try {
    await setDoc(
      doc(services.firestore, 'companies', companyId),
      {
        companyId,
        memberUserIds: {
          [user.uid]: true,
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    await setDoc(
      doc(services.firestore, 'users', user.uid),
      {
        uid: user.uid,
        companyId,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return companyId;
  } catch (error) {
    logger.error('Company workspace ensure failed', error);
    return null;
  }
}

export function createCompanyCode(): string {
  return createId().slice(0, 8).toUpperCase();
}

export function normalizeCompanyId(value: string): string {
  return value.trim().replace(/\s+/g, '-').toUpperCase();
}
