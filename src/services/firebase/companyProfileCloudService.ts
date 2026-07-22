import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { CompanyProfile } from '../../domain/company/entities/CompanyProfile';
import { logger } from '../logger';
import { ensureCompanyWorkspace, getCloudWorkspacePath } from './companyWorkspaceService';
import { getFirebaseServices } from './firebaseConfig';

const companyProfileDocumentId = 'company-profile';

export async function backupCompanyProfileToCloud(profile: CompanyProfile): Promise<boolean> {
  const services = getFirebaseServices();
  const workspace = await getCloudWorkspacePath();

  if (!services || !workspace) {
    return false;
  }

  try {
    await ensureCompanyWorkspace();
    await setDoc(
      doc(services.firestore, 'companies', workspace.rootId, 'settings', companyProfileDocumentId),
      {
        profile,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    await setDoc(
      doc(services.firestore, 'companies', workspace.rootId),
      {
        companyId: workspace.rootId,
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
  const workspace = await getCloudWorkspacePath();

  if (!services || !workspace) {
    return null;
  }

  try {
    await ensureCompanyWorkspace();
    const snapshot = await getDoc(
      doc(services.firestore, 'companies', workspace.rootId, 'settings', companyProfileDocumentId),
    );
    const data = snapshot.data();
    return snapshot.exists() && data?.profile ? (data.profile as CompanyProfile) : null;
  } catch (error) {
    logger.error('Company profile cloud restore failed', error);
    return null;
  }
}
