import { Firestore, collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';

import {
  createCustomerRepository,
  createDesignRepository,
  createQuoteRepository,
} from '../../database/repositories/createRepositories';
import { getCompanyProfile, saveCompanyProfile } from '../../database/repositories/CompanyProfileRepository';
import { getPricingSettings, savePricingSettings } from '../../database/repositories/PricingSettingsRepository';
import { CompanyProfile } from '../../domain/company/entities/CompanyProfile';
import { Customer } from '../../domain/customers/entities/Customer';
import { DesignProject } from '../../domain/designs/entities/DesignProject';
import { PriceEstimateRates } from '../../domain/designs/pricing/calculateDesignPriceEstimate';
import { Quote } from '../../domain/quotes/entities/Quote';
import { logger } from '../logger';
import { ensureFirebaseUser } from './firebaseAuthService';
import { getFirebaseServices } from './firebaseConfig';

export type FullSyncResult = {
  userId: string;
  customers: number;
  designs: number;
  quotes: number;
  pricingSettings: boolean;
  companyProfile: boolean;
};

type CloudDesignDocument = {
  data: DesignProject;
  updatedAt: string;
};

type CloudCustomerDocument = {
  data: Customer;
  updatedAt: string;
};

type CloudQuoteDocument = {
  data: Quote;
  updatedAt: string;
};

type CloudPricingDocument = {
  settings: PriceEstimateRates;
};

type CloudCompanyProfileDocument = {
  profile: CompanyProfile;
};

export async function backupAllLocalDataToCloud(): Promise<FullSyncResult | null> {
  const services = getFirebaseServices();
  const user = await ensureFirebaseUser();

  if (!services || !user) {
    return null;
  }

  const customerRepository = await createCustomerRepository();
  const designRepository = await createDesignRepository();
  const quoteRepository = await createQuoteRepository();
  const customers = await customerRepository.list({ includeDeleted: true, limit: 1000 });
  const designs = await designRepository.list({ includeDeleted: true, limit: 1000 });
  const quotes = await quoteRepository.list({ limit: 1000 });
  const pricingSettings = await getPricingSettings();
  const companyProfile = await getCompanyProfile();
  const batch = writeBatch(services.firestore);
  const userDoc = doc(services.firestore, 'users', user.uid);

  customers.forEach((customer) => {
    batch.set(doc(userDoc, 'customers', customer.id), {
      data: customer,
      updatedAt: customer.updatedAt,
      syncedAt: serverTimestamp(),
    });
  });

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
      companyProfile,
      syncSummary: {
        customerCount: customers.length,
        designCount: designs.length,
        quoteCount: quotes.length,
        pricingSettings: true,
        companyProfile: true,
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
    doc(userDoc, 'settings', 'company-profile'),
    {
      profile: companyProfile,
      syncedAt: serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(
    doc(userDoc, 'sync', 'summary'),
    {
      customerCount: customers.length,
      designCount: designs.length,
      quoteCount: quotes.length,
      pricingSettings: true,
      companyProfile: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  try {
    await batch.commit();
    return {
      userId: user.uid,
      customers: customers.length,
      designs: designs.length,
      quotes: quotes.length,
      pricingSettings: true,
      companyProfile: true,
    };
  } catch (error) {
    logger.error('Full cloud backup failed', error);
    return null;
  }
}

export async function backupCustomerToCloud(customer: Customer): Promise<boolean> {
  const services = getFirebaseServices();
  const user = await ensureFirebaseUser();

  if (!services || !user) {
    return false;
  }

  try {
    await setSingleDocument(services.firestore, user.uid, 'customers', customer.id, {
      data: customer,
      updatedAt: customer.updatedAt,
      syncedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    logger.error('Customer cloud backup failed', error);
    return false;
  }
}

export async function backupDesignToCloud(design: DesignProject): Promise<boolean> {
  const services = getFirebaseServices();
  const user = await ensureFirebaseUser();

  if (!services || !user) {
    return false;
  }

  try {
    await setSingleDocument(services.firestore, user.uid, 'designs', design.id, {
      data: design,
      updatedAt: design.updatedAt,
      syncedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    logger.error('Design cloud backup failed', error);
    return false;
  }
}

export async function backupQuoteToCloud(quote: Quote): Promise<boolean> {
  const services = getFirebaseServices();
  const user = await ensureFirebaseUser();

  if (!services || !user) {
    return false;
  }

  try {
    await setSingleDocument(services.firestore, user.uid, 'quotes', quote.id, {
      data: quote,
      updatedAt: quote.updatedAt,
      syncedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    logger.error('Quote cloud backup failed', error);
    return false;
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
    const customerRepository = await createCustomerRepository();
    const designRepository = await createDesignRepository();
    const quoteRepository = await createQuoteRepository();
    const customerSnapshots = await getDocs(collection(userDoc, 'customers'));
    const designSnapshots = await getDocs(collection(userDoc, 'designs'));
    const quoteSnapshots = await getDocs(collection(userDoc, 'quotes'));
    const pricingSnapshots = await getDocs(collection(userDoc, 'settings'));
    let restoredCustomers = 0;
    let restoredDesigns = 0;
    let restoredQuotes = 0;
    let restoredPricingSettings = false;
    let restoredCompanyProfile = false;

    for (const snapshot of customerSnapshots.docs) {
      const document = snapshot.data() as CloudCustomerDocument;
      const cloudCustomer = document.data;
      const localCustomer = await customerRepository.getById(cloudCustomer.id);

      if (!localCustomer || isCloudNewer(cloudCustomer.updatedAt, localCustomer.updatedAt)) {
        await customerRepository.save({
          id: cloudCustomer.id,
          fullName: cloudCustomer.fullName,
          phone: cloudCustomer.phone,
          address: cloudCustomer.address,
          notes: cloudCustomer.notes,
          deletedAt: cloudCustomer.deletedAt,
          syncStatus: cloudCustomer.syncStatus,
          version: cloudCustomer.version,
        });
        restoredCustomers += 1;
      }
    }

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

    const companyProfileDocument = pricingSnapshots.docs.find((snapshot) => snapshot.id === 'company-profile');
    if (companyProfileDocument) {
      const data = companyProfileDocument.data() as CloudCompanyProfileDocument;
      if (data.profile) {
        await saveCompanyProfile(data.profile);
        restoredCompanyProfile = true;
      }
    }

    return {
      userId: user.uid,
      customers: restoredCustomers,
      designs: restoredDesigns,
      quotes: restoredQuotes,
      pricingSettings: restoredPricingSettings,
      companyProfile: restoredCompanyProfile,
    };
  } catch (error) {
    logger.error('Full cloud restore failed', error);
    return null;
  }
}

function isCloudNewer(cloudUpdatedAt: string, localUpdatedAt: string): boolean {
  return new Date(cloudUpdatedAt).getTime() > new Date(localUpdatedAt).getTime();
}

async function setSingleDocument(
  firestore: Firestore,
  userId: string,
  collectionName: 'customers' | 'designs' | 'quotes',
  documentId: string,
  data: unknown,
): Promise<void> {
  const batch = writeBatch(firestore);
  const userDoc = doc(firestore, 'users', userId);
  batch.set(doc(userDoc, collectionName, documentId), data);
  batch.set(
    userDoc,
    {
      uid: userId,
      lastAutoSyncedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();
}
