import { Firestore, collection, doc, getDoc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';

import {
  createCashTransactionRepository,
  createCustomerRepository,
  createDesignRepository,
  createQuoteRepository,
  createStockRepository,
} from '../../database/repositories/createRepositories';
import { getCompanyProfile, saveCompanyProfile } from '../../database/repositories/CompanyProfileRepository';
import { getPricingSettings, savePricingSettings } from '../../database/repositories/PricingSettingsRepository';
import {
  listStockConsumptions,
  saveStockConsumptionForDesign,
  StockConsumptionLine,
} from '../../database/repositories/StockConsumptionRepository';
import { CompanyProfile } from '../../domain/company/entities/CompanyProfile';
import { Customer } from '../../domain/customers/entities/Customer';
import { DesignProject } from '../../domain/designs/entities/DesignProject';
import { PriceEstimateRates } from '../../domain/designs/pricing/calculateDesignPriceEstimate';
import { CashTransaction } from '../../domain/finance/entities/CashTransaction';
import { StockItem } from '../../domain/inventory/entities/StockItem';
import { Quote } from '../../domain/quotes/entities/Quote';
import { logger } from '../logger';
import { getFirebaseServices } from './firebaseConfig';
import { ensureCompanyWorkspace, getCloudWorkspacePath } from './companyWorkspaceService';

export type FullSyncResult = {
  userId: string;
  companyId: string;
  customers: number;
  designs: number;
  quotes: number;
  cashTransactions: number;
  stockItems: number;
  stockConsumptions: number;
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

type CloudCashTransactionDocument = {
  data: CashTransaction;
  updatedAt: string;
};

type CloudStockItemDocument = {
  data: StockItem;
  updatedAt: string;
};

type CloudStockConsumptionDocument = {
  designId: string;
  consumedAt: string;
  lines: StockConsumptionLine[];
};

type CloudPricingDocument = {
  settings: PriceEstimateRates;
};

type CloudCompanyProfileDocument = {
  profile: CompanyProfile;
};

export async function backupAllLocalDataToCloud(): Promise<FullSyncResult | null> {
  const services = getFirebaseServices();
  const workspace = await getCloudWorkspacePath();

  if (!services || !workspace) {
    return null;
  }

  await ensureCompanyWorkspace();

  const customerRepository = await createCustomerRepository();
  const designRepository = await createDesignRepository();
  const quoteRepository = await createQuoteRepository();
  const cashTransactionRepository = await createCashTransactionRepository();
  const stockRepository = await createStockRepository();
  const customers = await customerRepository.list({ includeDeleted: true, limit: 1000 });
  const designs = await designRepository.list({ includeDeleted: true, limit: 1000 });
  const quotes = await quoteRepository.list({ limit: 1000 });
  const cashTransactions = await cashTransactionRepository.list({ limit: 1000 });
  const stockItems = await stockRepository.list({ includeInactive: true, limit: 1000 });
  const stockConsumptions = await listStockConsumptions();
  const pricingSettings = await getPricingSettings();
  const companyProfile = await getCompanyProfile();
  const batch = writeBatch(services.firestore);
  const workspaceDoc = doc(services.firestore, workspace.rootCollection, workspace.rootId);

  customers.forEach((customer) => {
    batch.set(doc(workspaceDoc, 'customers', customer.id), {
      data: customer,
      updatedAt: customer.updatedAt,
      syncedAt: serverTimestamp(),
    });
  });

  designs.forEach((design) => {
    batch.set(doc(workspaceDoc, 'designs', design.id), {
      data: design,
      updatedAt: design.updatedAt,
      syncedAt: serverTimestamp(),
    });
  });

  quotes.forEach((quote) => {
    batch.set(doc(workspaceDoc, 'quotes', quote.id), {
      data: quote,
      updatedAt: quote.updatedAt,
      syncedAt: serverTimestamp(),
    });
  });

  cashTransactions.forEach((transaction) => {
    batch.set(doc(workspaceDoc, 'cashTransactions', transaction.id), {
      data: transaction,
      updatedAt: transaction.updatedAt,
      syncedAt: serverTimestamp(),
    });
  });

  stockItems.forEach((item) => {
    batch.set(doc(workspaceDoc, 'stockItems', item.id), {
      data: item,
      updatedAt: item.updatedAt,
      syncedAt: serverTimestamp(),
    });
  });

  stockConsumptions.forEach((consumption) => {
    batch.set(doc(workspaceDoc, 'stockConsumptions', consumption.designId), {
      designId: consumption.designId,
      consumedAt: consumption.consumedAt,
      lines: consumption.lines,
      syncedAt: serverTimestamp(),
    });
  });

  batch.set(
    workspaceDoc,
    {
      companyId: workspace.rootId,
      pricingSettings,
      companyProfile,
      syncSummary: {
        customerCount: customers.length,
        designCount: designs.length,
        quoteCount: quotes.length,
        cashTransactionCount: cashTransactions.length,
        stockItemCount: stockItems.length,
        stockConsumptionCount: stockConsumptions.length,
        pricingSettings: true,
        companyProfile: true,
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(
    doc(workspaceDoc, 'settings', 'pricing-settings'),
    {
      settings: pricingSettings,
      syncedAt: serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(
    doc(workspaceDoc, 'settings', 'company-profile'),
    {
      profile: companyProfile,
      syncedAt: serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(
    doc(workspaceDoc, 'sync', 'summary'),
    {
      customerCount: customers.length,
      designCount: designs.length,
      quoteCount: quotes.length,
      cashTransactionCount: cashTransactions.length,
      stockItemCount: stockItems.length,
      stockConsumptionCount: stockConsumptions.length,
      pricingSettings: true,
      companyProfile: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  try {
    await batch.commit();
    return {
      userId: workspace.userId,
      companyId: workspace.rootId,
      customers: customers.length,
      designs: designs.length,
      quotes: quotes.length,
      cashTransactions: cashTransactions.length,
      stockItems: stockItems.length,
      stockConsumptions: stockConsumptions.length,
      pricingSettings: true,
      companyProfile: true,
    };
  } catch (error) {
    logger.error('Full cloud backup failed', error);
    return null;
  }
}

export async function hasCloudStockConsumptionForDesign(designId: string): Promise<boolean> {
  const services = getFirebaseServices();
  const workspace = await getCloudWorkspacePath();

  if (!services || !workspace) {
    return false;
  }

  try {
    const snapshot = await getDoc(
      doc(services.firestore, workspace.rootCollection, workspace.rootId, 'stockConsumptions', designId),
    );
    return snapshot.exists();
  } catch (error) {
    logger.error('Stock consumption cloud check failed', error);
    return false;
  }
}

export async function backupStockConsumptionToCloud(
  designId: string,
  consumedAt: string,
  lines: StockConsumptionLine[],
): Promise<boolean> {
  const services = getFirebaseServices();
  const workspace = await getCloudWorkspacePath();

  if (!services || !workspace) {
    return false;
  }

  try {
    await setSingleDocument(services.firestore, workspace.rootId, 'stockConsumptions', designId, {
      designId,
      consumedAt,
      lines,
      syncedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    logger.error('Stock consumption cloud backup failed', error);
    return false;
  }
}

export async function backupStockItemToCloud(item: StockItem): Promise<boolean> {
  const services = getFirebaseServices();
  const workspace = await getCloudWorkspacePath();

  if (!services || !workspace) {
    return false;
  }

  try {
    await setSingleDocument(services.firestore, workspace.rootId, 'stockItems', item.id, {
      data: item,
      updatedAt: item.updatedAt,
      syncedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    logger.error('Stock item cloud backup failed', error);
    return false;
  }
}

export async function backupCashTransactionToCloud(transaction: CashTransaction): Promise<boolean> {
  const services = getFirebaseServices();
  const workspace = await getCloudWorkspacePath();

  if (!services || !workspace) {
    return false;
  }

  try {
    await setSingleDocument(services.firestore, workspace.rootId, 'cashTransactions', transaction.id, {
      data: transaction,
      updatedAt: transaction.updatedAt,
      syncedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    logger.error('Cash transaction cloud backup failed', error);
    return false;
  }
}

export async function backupCustomerToCloud(customer: Customer): Promise<boolean> {
  const services = getFirebaseServices();
  const workspace = await getCloudWorkspacePath();

  if (!services || !workspace) {
    return false;
  }

  try {
    await setSingleDocument(services.firestore, workspace.rootId, 'customers', customer.id, {
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
  const workspace = await getCloudWorkspacePath();

  if (!services || !workspace) {
    return false;
  }

  try {
    await setSingleDocument(services.firestore, workspace.rootId, 'designs', design.id, {
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
  const workspace = await getCloudWorkspacePath();

  if (!services || !workspace) {
    return false;
  }

  try {
    await setSingleDocument(services.firestore, workspace.rootId, 'quotes', quote.id, {
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
  const workspace = await getCloudWorkspacePath();

  if (!services || !workspace) {
    return null;
  }

  try {
    await ensureCompanyWorkspace();
    const workspaceDoc = doc(services.firestore, workspace.rootCollection, workspace.rootId);
    const customerRepository = await createCustomerRepository();
    const designRepository = await createDesignRepository();
    const quoteRepository = await createQuoteRepository();
    const cashTransactionRepository = await createCashTransactionRepository();
    const stockRepository = await createStockRepository();
    const customerSnapshots = await getDocs(collection(workspaceDoc, 'customers'));
    const designSnapshots = await getDocs(collection(workspaceDoc, 'designs'));
    const quoteSnapshots = await getDocs(collection(workspaceDoc, 'quotes'));
    const cashTransactionSnapshots = await getDocs(collection(workspaceDoc, 'cashTransactions'));
    const stockItemSnapshots = await getDocs(collection(workspaceDoc, 'stockItems'));
    const stockConsumptionSnapshots = await getDocs(collection(workspaceDoc, 'stockConsumptions'));
    const pricingSnapshots = await getDocs(collection(workspaceDoc, 'settings'));
    let restoredCustomers = 0;
    let restoredDesigns = 0;
    let restoredQuotes = 0;
    let restoredCashTransactions = 0;
    let restoredStockItems = 0;
    let restoredStockConsumptions = 0;
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
      const cloudDesign = normalizeCloudDesign(document.data);
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

    for (const snapshot of cashTransactionSnapshots.docs) {
      const document = snapshot.data() as CloudCashTransactionDocument;
      const cloudTransaction = document.data;
      const localTransaction = await cashTransactionRepository.getById(cloudTransaction.id);

      if (!localTransaction || isCloudNewer(cloudTransaction.updatedAt, localTransaction.updatedAt)) {
        await cashTransactionRepository.save({
          id: cloudTransaction.id,
          type: cloudTransaction.type,
          category: cloudTransaction.category,
          title: cloudTransaction.title,
          amount: cloudTransaction.amount,
          transactionDate: cloudTransaction.transactionDate,
          customerId: cloudTransaction.customerId,
          designId: cloudTransaction.designId,
          notes: cloudTransaction.notes,
          syncStatus: cloudTransaction.syncStatus,
          version: cloudTransaction.version,
        });
        restoredCashTransactions += 1;
      }
    }

    for (const snapshot of stockItemSnapshots.docs) {
      const document = snapshot.data() as CloudStockItemDocument;
      const cloudItem = document.data;
      const localItem = await stockRepository.getById(cloudItem.id);

      if (!localItem || isCloudNewer(cloudItem.updatedAt, localItem.updatedAt)) {
        await stockRepository.save({
          id: cloudItem.id,
          name: cloudItem.name,
          type: cloudItem.type,
          quantity: cloudItem.quantity,
          unit: cloudItem.unit,
          minimumQuantity: cloudItem.minimumQuantity,
          purchasePrice: cloudItem.purchasePrice,
          isActive: cloudItem.isActive,
          notes: cloudItem.notes,
          syncStatus: cloudItem.syncStatus,
          version: cloudItem.version,
        });
        restoredStockItems += 1;
      }
    }

    for (const snapshot of stockConsumptionSnapshots.docs) {
      const data = snapshot.data() as CloudStockConsumptionDocument;
      if (data.designId && data.consumedAt && Array.isArray(data.lines)) {
        await saveStockConsumptionForDesign(data.designId, data.lines, data.consumedAt);
        restoredStockConsumptions += 1;
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
      userId: workspace.userId,
      companyId: workspace.rootId,
      customers: restoredCustomers,
      designs: restoredDesigns,
      quotes: restoredQuotes,
      cashTransactions: restoredCashTransactions,
      stockItems: restoredStockItems,
      stockConsumptions: restoredStockConsumptions,
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

function normalizeCloudDesign(design: DesignProject): DesignProject {
  return {
    ...design,
    jobStatus: design.jobStatus ?? 'draft',
    jobName: design.jobName ?? null,
  };
}

async function setSingleDocument(
  firestore: Firestore,
  companyId: string,
  collectionName:
    | 'cashTransactions'
    | 'customers'
    | 'designs'
    | 'quotes'
    | 'stockItems'
    | 'stockConsumptions',
  documentId: string,
  data: unknown,
): Promise<void> {
  const batch = writeBatch(firestore);
  const workspaceDoc = doc(firestore, 'companies', companyId);
  batch.set(doc(workspaceDoc, collectionName, documentId), data);
  batch.set(
    workspaceDoc,
    {
      companyId,
      lastAutoSyncedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();
}
