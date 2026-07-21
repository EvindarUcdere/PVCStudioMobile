import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { PriceEstimateRates } from '../../domain/designs/pricing/calculateDesignPriceEstimate';
import { logger } from '../logger';
import { ensureFirebaseUser } from './firebaseAuthService';
import { getFirebaseServices } from './firebaseConfig';

const pricingSettingsDocumentId = 'pricing-settings';

export async function backupPricingSettingsToCloud(settings: PriceEstimateRates): Promise<boolean> {
  const services = getFirebaseServices();
  const user = await ensureFirebaseUser();

  if (!services || !user) {
    return false;
  }

  try {
    await setDoc(
      doc(services.firestore, 'users', user.uid, 'settings', pricingSettingsDocumentId),
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
  const user = await ensureFirebaseUser();

  if (!services || !user) {
    return null;
  }

  try {
    const snapshot = await getDoc(doc(services.firestore, 'users', user.uid, 'settings', pricingSettingsDocumentId));
    const data = snapshot.data();
    return snapshot.exists() && data?.settings ? (data.settings as PriceEstimateRates) : null;
  } catch (error) {
    logger.error('Pricing settings cloud restore failed', error);
    return null;
  }
}
