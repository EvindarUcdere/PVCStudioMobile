import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { PriceEstimateRates } from '../../domain/designs/pricing/calculateDesignPriceEstimate';
import { logger } from '../logger';
import { ensureCompanyWorkspace, getCloudWorkspacePath } from './companyWorkspaceService';
import { getFirebaseServices } from './firebaseConfig';

const pricingSettingsDocumentId = 'pricing-settings';

export async function backupPricingSettingsToCloud(settings: PriceEstimateRates): Promise<boolean> {
  const services = getFirebaseServices();
  const workspace = await getCloudWorkspacePath();

  if (!services || !workspace) {
    return false;
  }

  try {
    await ensureCompanyWorkspace();
    await setDoc(
      doc(services.firestore, 'companies', workspace.rootId, 'settings', pricingSettingsDocumentId),
      {
        settings,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  } catch (error) {
    logger.error('Pricing settings cloud backup failed', error);
    return false;
  }
}

export async function restorePricingSettingsFromCloud(): Promise<PriceEstimateRates | null> {
  const services = getFirebaseServices();
  const workspace = await getCloudWorkspacePath();

  if (!services || !workspace) {
    return null;
  }

  try {
    await ensureCompanyWorkspace();
    const snapshot = await getDoc(
      doc(services.firestore, 'companies', workspace.rootId, 'settings', pricingSettingsDocumentId),
    );
    const data = snapshot.data();
    return snapshot.exists() && data?.settings ? (data.settings as PriceEstimateRates) : null;
  } catch (error) {
    logger.error('Pricing settings cloud restore failed', error);
    return null;
  }
}
