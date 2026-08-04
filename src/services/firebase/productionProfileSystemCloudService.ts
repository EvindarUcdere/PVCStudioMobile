import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { z } from 'zod';

import {
  ProductionProfileSystem,
  ProfileSystemTechnicalValues,
  WeldingAllowanceMode,
} from '../../domain/production-calculation/types';
import { logger } from '../logger';
import { getFirebaseServices } from './firebaseConfig';
import { ensureCompanyWorkspace, getCloudWorkspacePath } from './companyWorkspaceService';

type CloudProductionProfileSystemDocument = {
  data: ProductionProfileSystem;
  updatedAt: string;
};

const technicalValueSchema = z.object({
  value: z.number(),
  unit: z.enum(['MM', 'DEGREE']),
  status: z.enum(['DRAFT', 'VERIFIED']),
  source: z.string().optional(),
  note: z.string().optional(),
  verifiedAt: z.string().optional(),
});

const technicalValuesSchema: z.ZodType<ProfileSystemTechnicalValues> = z.object({
  stockLengthMm: technicalValueSchema,
  horizontalFrameAdjustmentMm: technicalValueSchema,
  verticalFrameAdjustmentMm: technicalValueSchema,
  horizontalCutAngleDeg: technicalValueSchema,
  verticalCutAngleDeg: technicalValueSchema,
  sawKerfMm: technicalValueSchema,
  startTrimMm: technicalValueSchema,
  endTrimMm: technicalValueSchema,
  weldingAllowanceMmPerEnd: technicalValueSchema,
  fixedGlassDeductionLeftMm: technicalValueSchema.optional(),
  fixedGlassDeductionRightMm: technicalValueSchema.optional(),
  fixedGlassDeductionTopMm: technicalValueSchema.optional(),
  fixedGlassDeductionBottomMm: technicalValueSchema.optional(),
});

const productionProfileSystemSchema: z.ZodType<ProductionProfileSystem> = z.object({
  id: z.string().min(1),
  companyId: z.string().min(1),
  displayName: z.string().min(1),
  brand: z.string().min(1),
  seriesName: z.string().min(1),
  version: z.string().min(1),
  status: z.enum(['DRAFT', 'VERIFIED', 'ARCHIVED']),
  frameProfileCode: z.string(),
  sashProfileCode: z.string().optional(),
  mullionProfileCode: z.string().optional(),
  transomProfileCode: z.string().optional(),
  glazingBeadProfileCode: z.string().optional(),
  gasketCode: z.string().optional(),
  hardwareSetCode: z.string().optional(),
  weldingAllowanceMode: z.enum(['ADD_TO_CUT_LENGTH', 'INCLUDED_BY_MACHINE', 'NOT_APPLICABLE']) as z.ZodType<WeldingAllowanceMode>,
  technicalValues: technicalValuesSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export async function listProductionProfileSystemsFromCloud(
  companyId: string,
): Promise<ProductionProfileSystem[]> {
  const services = getFirebaseServices();
  const workspace = await getCloudWorkspacePath();

  if (!services || !workspace || workspace.rootId !== companyId) {
    return [];
  }

  try {
    const snapshots = await getDocs(collection(services.firestore, 'companies', workspace.rootId, 'productionProfileSystems'));
    return snapshots.docs
      .map((snapshot) => parseCloudProfile(snapshot.data()))
      .filter((profile): profile is ProductionProfileSystem => profile !== null)
      .sort((first, second) => {
        if (first.status === 'ARCHIVED' && second.status !== 'ARCHIVED') {
          return 1;
        }

        if (first.status !== 'ARCHIVED' && second.status === 'ARCHIVED') {
          return -1;
        }

        return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
      });
  } catch (error) {
    logger.error('Production profile systems cloud list failed', error);
    return [];
  }
}

export async function getProductionProfileSystemFromCloud(
  companyId: string,
  profileSystemId: string,
): Promise<ProductionProfileSystem | null> {
  const services = getFirebaseServices();
  const workspace = await getCloudWorkspacePath();

  if (!services || !workspace || workspace.rootId !== companyId) {
    return null;
  }

  try {
    const snapshot = await getDoc(
      doc(services.firestore, 'companies', workspace.rootId, 'productionProfileSystems', profileSystemId),
    );
    return snapshot.exists() ? parseCloudProfile(snapshot.data()) : null;
  } catch (error) {
    logger.error('Production profile system cloud get failed', error);
    return null;
  }
}

export async function saveProductionProfileSystemToCloud(
  input: ProductionProfileSystem,
): Promise<ProductionProfileSystem | null> {
  const services = getFirebaseServices();
  const workspace = await getCloudWorkspacePath();

  if (!services || !workspace || workspace.rootId !== input.companyId) {
    return null;
  }

  const parsed = productionProfileSystemSchema.parse(input);

  try {
    await ensureCompanyWorkspace();
    await setDoc(
      doc(services.firestore, 'companies', workspace.rootId, 'productionProfileSystems', parsed.id),
      {
        data: parsed,
        companyId: parsed.companyId,
        displayName: parsed.displayName,
        brand: parsed.brand,
        seriesName: parsed.seriesName,
        version: parsed.version,
        status: parsed.status,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return parsed;
  } catch (error) {
    logger.error('Production profile system cloud save failed', error);
    return null;
  }
}

function parseCloudProfile(value: unknown): ProductionProfileSystem | null {
  const document = value as Partial<CloudProductionProfileSystemDocument>;
  const parsed = productionProfileSystemSchema.safeParse(document.data ?? value);
  if (!parsed.success) {
    logger.error('Production profile system cloud document invalid', parsed.error);
    return null;
  }

  return parsed.data;
}
