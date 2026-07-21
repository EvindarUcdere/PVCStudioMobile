import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';

import { createDesignRepository, createQuoteRepository } from '../../database/repositories/createRepositories';
import { getPricingSettings, savePricingSettings } from '../../database/repositories/PricingSettingsRepository';
import { DesignProject } from '../../domain/designs/entities/DesignProject';
import { PriceEstimateRates } from '../../domain/designs/pricing/calculateDesignPriceEstimate';
import { Quote } from '../../domain/quotes/entities/Quote';
import { logger } from '../logger';
import { ensureFirebaseUser } from './firebaseAuthService';
import { getFirebaseServices } from './firebaseConfig';

export type FullSyncResult = {
  designs: number;
  quotes: number;
  pricingSettings: boolean;
};

type CloudDesignDocument = {
  data: DesignProject;
  updatedAt: string;
};

type CloudQuoteDocument = {
  data: Quote;
  updatedAt: string;
};

type CloudPricingDocument = {
  settings: PriceEstimateRates;
};

export async function backupAllLocalDataToCloud(): Promise<FullSyncResult | null> {
  const services = getFirebaseServices();
  const user = await ensureFirebaseUser();

  if (!services || !user) {
    return null;
  }

  const designRepository = await createDesignRepository();
  const quoteRepository = await createQuoteRepository();
  const designs = await designRepository.list({ includeDeleted: true, limit: 1000 });
  const quotes = await quoteRepository.list({ limit: 1000 });
  const pricingSettings = await getPricingSettings();
  const batch = writeBatch(services.firestore);
  const userDoc = doc(services.firestore, 'users', user.uid);

  designs.forEach((design) => {
    batch.set(doc(userDoc, 'designs', design.id), {
      data: design,
      updatedAt: design.updatedAt,
      syncedAt: serverTimestamp(),
    });
  });

  quotes.forEach((quote) => {
    batch.set(doc(userDoc, 'quotes', quote.id), {
      data: quote,
      updatedAt: quote.updatedAt,
      syncedAt: serverTimestamp(),
    });
  });

  batch.set(
    userDoc,
    {
      uid: user.uid,
      pricingSettings,
      syncSummary: {
        designCount: designs.length,
        quoteCount: quotes.length,
        pricingSettings: true,
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(
    doc(userDoc, 'settings', 'pricing-settings'),
    {
      settings: pricingSettings,
      syncedAt: serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(
    doc(userDoc, 'sync', 'summary'),
    {
      designCount: designs.length,
      quoteCount: quotes.length,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  try {
    await batch.commit();
    return {
      designs: designs.length,
      quotes: quotes.length,
      pricingSettings: true,
    };
  } catch (error) {
    logger.error('Full cloud backup failed', error);
    return null;
  }
}

export async function restoreAllCloudDataToLocal(): Promise<FullSyncResult | null> {
  const services = getFirebaseServices();
  const user = await ensureFirebaseUser();

  if (!services || !user) {
    return null;
  }

  try {
    const userDoc = doc(services.firestore, 'users', user.uid);
    const designRepository = await createDesignRepository();
    const quoteRepository = await createQuoteRepository();
    const designSnapshots = await getDocs(collection(userDoc, 'designs'));
    const quoteSnapshots = await getDocs(collection(userDoc, 'quotes'));
    const pricingSnapshots = await getDocs(collection(userDoc, 'settings'));
    let restoredDesigns = 0;
    let restoredQuotes = 0;
    let restoredPricingSettings = false;

    for (const snapshot of designSnapshots.docs) {
      const document = snapshot.data() as CloudDesignDocument;
      const cloudDesign = document.data;
      const localDesign = await designRepository.getById(cloudDesign.id);

      if (!localDesign) {
        await designRepository.create(cloudDesign);
        restoredDesigns += 1;
        continue;
      }

      if (isCloudNewer(cloudDesign.updatedAt, localDesign.updatedAt)) {
        await designRepository.update(cloudDesign);
        restoredDesigns += 1;
      }
    }

    for (const snapshot of quoteSnapshots.docs) {
      const document = snapshot.data() as CloudQuoteDocument;
      const cloudQuote = document.data;
      const localQuote = await quoteRepository.getById(cloudQuote.id);

      if (!localQuote || isCloudNewer(cloudQuote.updatedAt, localQuote.updatedAt)) {
        await quoteRepository.save({
          id: cloudQuote.id,
          designId: cloudQuote.designId,
          designName: cloudQuote.designName,
          customerName: cloudQuote.customerName,
          customerPhone: cloudQuote.customerPhone,
          note: cloudQuote.note,
          status: cloudQuote.status,
          width: cloudQuote.width,
          height: cloudQuote.height,
          quantity: cloudQuote.quantity,
          profileSystemName: cloudQuote.profileSystemName,
          colorName: cloudQuote.colorName,
          glassTypeName: cloudQuote.glassTypeName,
          unitTotal: cloudQuote.unitTotal,
          total: cloudQuote.total,
          message: cloudQuote.message,
        });
        restoredQuotes += 1;
      }
    }

    const pricingDocument = pricingSnapshots.docs.find((snapshot) => snapshot.id === 'pricing-settings');
    if (pricingDocument) {
      const data = pricingDocument.data() as CloudPricingDocument;
      if (data.settings) {
        await savePricingSettings(data.settings);
        restoredPricingSettings = true;
      }
    }

    return {
      designs: restoredDesigns,
      quotes: restoredQuotes,
      pricingSettings: restoredPricingSettings,
    };
  } catch (error) {
    logger.error('Full cloud restore failed', error);
    return null;
  }
}

function isCloudNewer(cloudUpdatedAt: string, localUpdatedAt: string): boolean {
  return new Date(cloudUpdatedAt).getTime() > new Date(localUpdatedAt).getTime();
}
