import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { CompanyProfile } from '../../domain/company/entities/CompanyProfile';
import { logger } from '../logger';
import { ensureFirebaseUser } from './firebaseAuthService';
import { getFirebaseServices } from './firebaseConfig';

const companyProfileDocumentId = 'company-profile';

export async function backupCompanyProfileToCloud(profile: CompanyProfile): Promise<boolean> {
  const services = getFirebaseServices();
  const user = await ensureFirebaseUser();

  if (!services || !user) {
    return false;
  }

  try {
    await setDoc(
      doc(services.firestore, 'users', user.uid, 'settings', companyProfileDocumentId),
      {
        profile,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    await setDoc(
      doc(services.firestore, 'users', user.uid),
      {
        uid: user.uid,
        companyProfile: profile,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  } catch (error) {
    logger.error('Company profile cloud backup failed', error);
    return false;
  }
}

export async function restoreCompanyProfileFromCloud(): Promise<CompanyProfile | null> {
  const services = getFirebaseServices();
  const user = await ensureFirebaseUser();

  if (!services || !user) {
    return null;
  }

  try {
    const snapshot = await getDoc(doc(services.firestore, 'users', user.uid, 'settings', companyProfileDocumentId));
    const data = snapshot.data();
    return snapshot.exists() && data?.profile ? (data.profile as CompanyProfile) : null;
  } catch (error) {
    logger.error('Company profile cloud restore failed', error);
    return null;
  }
}
