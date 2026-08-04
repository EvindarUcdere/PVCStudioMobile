import {
  ProductionProfileSystem,
  TechnicalValue,
  TechnicalValueStatus,
  TechnicalValueUnit,
  WeldingAllowanceMode,
} from '../../../domain/production-calculation/types';

export type AdjustmentOperation = 'ADD' | 'SUBTRACT' | 'NONE';

export type AdjustmentFormValue = {
  operation: AdjustmentOperation;
  valueMm: string;
};

export type ProductionProfileFormValues = {
  displayName: string;
  brand: string;
  seriesName: string;
  version: string;
  frameProfileCode: string;
  sashProfileCode: string;
  mullionProfileCode: string;
  transomProfileCode: string;
  glazingBeadProfileCode: string;
  gasketCode: string;
  hardwareSetCode: string;
  stockLengthMm: string;
  horizontalFrameAdjustment: AdjustmentFormValue;
  verticalFrameAdjustment: AdjustmentFormValue;
  horizontalCutAngleDeg: string;
  verticalCutAngleDeg: string;
  sawKerfMm: string;
  startTrimMm: string;
  endTrimMm: string;
  weldingAllowanceMode: WeldingAllowanceMode;
  weldingAllowanceMmPerEnd: string;
  fixedGlassDeductionLeftMm: string;
  fixedGlassDeductionRightMm: string;
  fixedGlassDeductionTopMm: string;
  fixedGlassDeductionBottomMm: string;
  source: string;
  note: string;
  markVerified: boolean;
};

export type CompletionSummary = {
  completed: number;
  total: number;
  missingLabels: string[];
};

export const emptyProductionProfileFormValues: ProductionProfileFormValues = {
  displayName: '',
  brand: '',
  seriesName: '',
  version: '1.0.0',
  frameProfileCode: '',
  sashProfileCode: '',
  mullionProfileCode: '',
  transomProfileCode: '',
  glazingBeadProfileCode: '',
  gasketCode: '',
  hardwareSetCode: '',
  stockLengthMm: '',
  horizontalFrameAdjustment: { operation: 'NONE', valueMm: '' },
  verticalFrameAdjustment: { operation: 'NONE', valueMm: '' },
  horizontalCutAngleDeg: '',
  verticalCutAngleDeg: '',
  sawKerfMm: '',
  startTrimMm: '',
  endTrimMm: '',
  weldingAllowanceMode: 'INCLUDED_BY_MACHINE',
  weldingAllowanceMmPerEnd: '',
  fixedGlassDeductionLeftMm: '',
  fixedGlassDeductionRightMm: '',
  fixedGlassDeductionTopMm: '',
  fixedGlassDeductionBottomMm: '',
  source: '',
  note: '',
  markVerified: false,
};

export function shouldShowWeldingAllowance(mode: WeldingAllowanceMode): boolean {
  return mode === 'ADD_TO_CUT_LENGTH';
}

export function parseDecimal(value: string): number | null {
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function toSignedAdjustment(adjustment: AdjustmentFormValue): number | null {
  if (adjustment.operation === 'NONE') {
    return 0;
  }

  const parsed = parseDecimal(adjustment.valueMm);
  if (parsed === null || parsed < 0) {
    return null;
  }

  return adjustment.operation === 'SUBTRACT' ? -parsed : parsed;
}

export function fromSignedAdjustment(value: number): AdjustmentFormValue {
  if (value > 0) {
    return { operation: 'ADD', valueMm: String(value) };
  }

  if (value < 0) {
    return { operation: 'SUBTRACT', valueMm: String(Math.abs(value)) };
  }

  return { operation: 'NONE', valueMm: '' };
}

export function getCompletionSummary(values: ProductionProfileFormValues): CompletionSummary {
  const requiredChecks: { label: string; complete: boolean }[] = [
    { label: 'Profil sistemi adı eksik', complete: Boolean(values.displayName.trim()) },
    { label: 'Marka eksik', complete: Boolean(values.brand.trim()) },
    { label: 'Seri adı eksik', complete: Boolean(values.seriesName.trim()) },
    { label: 'Sürüm eksik', complete: Boolean(values.version.trim()) },
    { label: 'Kasa profil kodu eksik', complete: Boolean(values.frameProfileCode.trim()) },
    { label: 'Profil stok boyu eksik', complete: isNonNegativeNumber(values.stockLengthMm) },
    { label: 'Kaynak yöntemi eksik', complete: Boolean(values.weldingAllowanceMode) },
    {
      label: 'Yatay kesim açısı eksik',
      complete: isNonNegativeNumber(values.horizontalCutAngleDeg),
    },
    {
      label: 'Dikey kesim açısı eksik',
      complete: isNonNegativeNumber(values.verticalCutAngleDeg),
    },
    {
      label: 'Kaynak belge veya açıklama eksik',
      complete: Boolean(values.source.trim() || values.note.trim()),
    },
    {
      label: 'Sabit cam sol dusum eksik',
      complete: isNonNegativeNumber(values.fixedGlassDeductionLeftMm),
    },
    {
      label: 'Sabit cam sag dusum eksik',
      complete: isNonNegativeNumber(values.fixedGlassDeductionRightMm),
    },
    {
      label: 'Sabit cam ust dusum eksik',
      complete: isNonNegativeNumber(values.fixedGlassDeductionTopMm),
    },
    {
      label: 'Sabit cam alt dusum eksik',
      complete: isNonNegativeNumber(values.fixedGlassDeductionBottomMm),
    },
  ];

  if (shouldShowWeldingAllowance(values.weldingAllowanceMode)) {
    requiredChecks.push({
      label: 'Her uç için kaynak payı eksik',
      complete: isNonNegativeNumber(values.weldingAllowanceMmPerEnd),
    });
  }

  return {
    completed: requiredChecks.filter((check) => check.complete).length,
    total: requiredChecks.length,
    missingLabels: requiredChecks.filter((check) => !check.complete).map((check) => check.label),
  };
}

export function canVerifyProfileSystem(values: ProductionProfileFormValues): {
  canVerify: boolean;
  missingLabels: string[];
} {
  const completion = getCompletionSummary(values);
  return {
    canVerify: completion.missingLabels.length === 0,
    missingLabels: completion.missingLabels,
  };
}

export function shouldDowngradeVerifiedEdit(
  previous: ProductionProfileSystem | null,
  values: ProductionProfileFormValues,
): boolean {
  if (!previous || previous.status !== 'VERIFIED' || values.markVerified) {
    return false;
  }

  return true;
}

export function toProductionProfileSystem(
  values: ProductionProfileFormValues,
  companyId: string,
  id: string,
  previous: ProductionProfileSystem | null,
  now: string,
): ProductionProfileSystem | null {
  const stockLengthMm = parseDecimal(values.stockLengthMm);
  const horizontalAdjustment = toSignedAdjustment(values.horizontalFrameAdjustment);
  const verticalAdjustment = toSignedAdjustment(values.verticalFrameAdjustment);
  const horizontalCutAngleDeg = parseDecimal(values.horizontalCutAngleDeg);
  const verticalCutAngleDeg = parseDecimal(values.verticalCutAngleDeg);
  const sawKerfMm = parseDecimal(values.sawKerfMm);
  const startTrimMm = parseDecimal(values.startTrimMm);
  const endTrimMm = parseDecimal(values.endTrimMm);
  const weldingAllowanceMmPerEnd = shouldShowWeldingAllowance(values.weldingAllowanceMode)
    ? parseDecimal(values.weldingAllowanceMmPerEnd)
    : 0;
  const fixedGlassDeductionLeftMm = parseDecimal(values.fixedGlassDeductionLeftMm);
  const fixedGlassDeductionRightMm = parseDecimal(values.fixedGlassDeductionRightMm);
  const fixedGlassDeductionTopMm = parseDecimal(values.fixedGlassDeductionTopMm);
  const fixedGlassDeductionBottomMm = parseDecimal(values.fixedGlassDeductionBottomMm);

  if (
    !values.displayName.trim() ||
    !values.brand.trim() ||
    !values.seriesName.trim() ||
    !values.version.trim() ||
    !values.frameProfileCode.trim() ||
    stockLengthMm === null ||
    horizontalAdjustment === null ||
    verticalAdjustment === null ||
    horizontalCutAngleDeg === null ||
    verticalCutAngleDeg === null ||
    sawKerfMm === null ||
    startTrimMm === null ||
    endTrimMm === null ||
    weldingAllowanceMmPerEnd === null ||
    fixedGlassDeductionLeftMm === null ||
    fixedGlassDeductionRightMm === null ||
    fixedGlassDeductionTopMm === null ||
    fixedGlassDeductionBottomMm === null ||
    stockLengthMm < 0 ||
    horizontalCutAngleDeg < 0 ||
    verticalCutAngleDeg < 0 ||
    sawKerfMm < 0 ||
    startTrimMm < 0 ||
    endTrimMm < 0 ||
    weldingAllowanceMmPerEnd < 0 ||
    fixedGlassDeductionLeftMm < 0 ||
    fixedGlassDeductionRightMm < 0 ||
    fixedGlassDeductionTopMm < 0 ||
    fixedGlassDeductionBottomMm < 0
  ) {
    return null;
  }

  const requestedVerified = values.markVerified && canVerifyProfileSystem(values).canVerify;
  const status: TechnicalValueStatus = requestedVerified ? 'VERIFIED' : 'DRAFT';
  const source = values.source.trim();
  const note = values.note.trim();

  return {
    id,
    companyId,
    displayName: values.displayName.trim(),
    brand: values.brand.trim(),
    seriesName: values.seriesName.trim(),
    version: values.version.trim(),
    status,
    frameProfileCode: values.frameProfileCode.trim(),
    sashProfileCode: optionalTrim(values.sashProfileCode),
    mullionProfileCode: optionalTrim(values.mullionProfileCode),
    transomProfileCode: optionalTrim(values.transomProfileCode),
    glazingBeadProfileCode: optionalTrim(values.glazingBeadProfileCode),
    gasketCode: optionalTrim(values.gasketCode),
    hardwareSetCode: optionalTrim(values.hardwareSetCode),
    weldingAllowanceMode: values.weldingAllowanceMode,
    technicalValues: {
      stockLengthMm: createTechnicalValue(stockLengthMm, 'MM', status, source, note, now),
      horizontalFrameAdjustmentMm: createTechnicalValue(horizontalAdjustment, 'MM', status, source, note, now),
      verticalFrameAdjustmentMm: createTechnicalValue(verticalAdjustment, 'MM', status, source, note, now),
      horizontalCutAngleDeg: createTechnicalValue(horizontalCutAngleDeg, 'DEGREE', status, source, note, now),
      verticalCutAngleDeg: createTechnicalValue(verticalCutAngleDeg, 'DEGREE', status, source, note, now),
      sawKerfMm: createTechnicalValue(sawKerfMm, 'MM', status, source, note, now),
      startTrimMm: createTechnicalValue(startTrimMm, 'MM', status, source, note, now),
      endTrimMm: createTechnicalValue(endTrimMm, 'MM', status, source, note, now),
      weldingAllowanceMmPerEnd: createTechnicalValue(weldingAllowanceMmPerEnd, 'MM', status, source, note, now),
      fixedGlassDeductionLeftMm: createTechnicalValue(
        fixedGlassDeductionLeftMm,
        'MM',
        status,
        source,
        note,
        now,
      ),
      fixedGlassDeductionRightMm: createTechnicalValue(
        fixedGlassDeductionRightMm,
        'MM',
        status,
        source,
        note,
        now,
      ),
      fixedGlassDeductionTopMm: createTechnicalValue(
        fixedGlassDeductionTopMm,
        'MM',
        status,
        source,
        note,
        now,
      ),
      fixedGlassDeductionBottomMm: createTechnicalValue(
        fixedGlassDeductionBottomMm,
        'MM',
        status,
        source,
        note,
        now,
      ),
    },
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
}

export function toProductionProfileFormValues(
  profileSystem: ProductionProfileSystem,
): ProductionProfileFormValues {
  const technicalValues = profileSystem.technicalValues;
  const firstValue = technicalValues.stockLengthMm;

  return {
    displayName: profileSystem.displayName,
    brand: profileSystem.brand,
    seriesName: profileSystem.seriesName,
    version: profileSystem.version,
    frameProfileCode: profileSystem.frameProfileCode,
    sashProfileCode: profileSystem.sashProfileCode ?? '',
    mullionProfileCode: profileSystem.mullionProfileCode ?? '',
    transomProfileCode: profileSystem.transomProfileCode ?? '',
    glazingBeadProfileCode: profileSystem.glazingBeadProfileCode ?? '',
    gasketCode: profileSystem.gasketCode ?? '',
    hardwareSetCode: profileSystem.hardwareSetCode ?? '',
    stockLengthMm: String(technicalValues.stockLengthMm.value),
    horizontalFrameAdjustment: fromSignedAdjustment(technicalValues.horizontalFrameAdjustmentMm.value),
    verticalFrameAdjustment: fromSignedAdjustment(technicalValues.verticalFrameAdjustmentMm.value),
    horizontalCutAngleDeg: String(technicalValues.horizontalCutAngleDeg.value),
    verticalCutAngleDeg: String(technicalValues.verticalCutAngleDeg.value),
    sawKerfMm: String(technicalValues.sawKerfMm.value),
    startTrimMm: String(technicalValues.startTrimMm.value),
    endTrimMm: String(technicalValues.endTrimMm.value),
    weldingAllowanceMode: profileSystem.weldingAllowanceMode,
    weldingAllowanceMmPerEnd: String(technicalValues.weldingAllowanceMmPerEnd.value),
    fixedGlassDeductionLeftMm: optionalTechnicalValueToString(technicalValues.fixedGlassDeductionLeftMm),
    fixedGlassDeductionRightMm: optionalTechnicalValueToString(technicalValues.fixedGlassDeductionRightMm),
    fixedGlassDeductionTopMm: optionalTechnicalValueToString(technicalValues.fixedGlassDeductionTopMm),
    fixedGlassDeductionBottomMm: optionalTechnicalValueToString(technicalValues.fixedGlassDeductionBottomMm),
    source: firstValue.source ?? '',
    note: firstValue.note ?? '',
    markVerified: profileSystem.status === 'VERIFIED',
  };
}

function optionalTechnicalValueToString(value: TechnicalValue | undefined): string {
  return value ? String(value.value) : '';
}

function optionalTrim(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function createTechnicalValue(
  value: number,
  unit: TechnicalValueUnit,
  status: TechnicalValueStatus,
  source: string,
  note: string,
  verifiedAt: string,
): TechnicalValue {
  return {
    value,
    unit,
    status,
    ...(source ? { source } : {}),
    ...(note ? { note } : {}),
    ...(status === 'VERIFIED' ? { verifiedAt } : {}),
  };
}

function isNonNegativeNumber(value: string): boolean {
  const parsed = parseDecimal(value);
  return parsed !== null && parsed >= 0;
}
