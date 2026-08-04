import {
  CalculationTraceItem,
  FixedGlassPiece,
  FrameCutPiece,
  ProductionCalculationInput,
  ProductionCalculationIssue,
  ProductionCalculationResult,
  ProductionProfileSystem,
  ProfileSystemTechnicalValues,
  TechnicalValue,
} from './types';

export const productionCalculationEngineVersion = '0.1.0';

const requiredTechnicalValueKeys: (keyof ProfileSystemTechnicalValues)[] = [
  'stockLengthMm',
  'horizontalFrameAdjustmentMm',
  'verticalFrameAdjustmentMm',
  'horizontalCutAngleDeg',
  'verticalCutAngleDeg',
  'sawKerfMm',
  'startTrimMm',
  'endTrimMm',
];

export function calculateFixedOuterFrameProduction(
  input: ProductionCalculationInput,
  profileSystem: ProductionProfileSystem | null,
  now = new Date(),
): ProductionCalculationResult {
  const calculatedAt = now.toISOString();
  const baseFailure = {
    ok: false as const,
    calculationMode: input.calculationMode,
    designId: input.designId,
    engineVersion: productionCalculationEngineVersion,
    calculatedAt,
  };

  const inputIssues = validateInput(input);
  if (inputIssues.length > 0) {
    return { ...baseFailure, issues: inputIssues };
  }

  if (!profileSystem) {
    return {
      ...baseFailure,
      issues: [
        {
          code: 'PROFILE_SYSTEM_NOT_FOUND',
          message: 'Secilen profil sistemi bulunamadi.',
        },
      ],
    };
  }

  const profileIssues = validateProfileSystem(input, profileSystem);
  if (profileIssues.length > 0) {
    return { ...baseFailure, issues: profileIssues };
  }

  const horizontalCut = calculateCutLength({
    baseLengthMm: input.widthMm,
    adjustment: profileSystem.technicalValues.horizontalFrameAdjustmentMm,
    weldingAllowance: profileSystem.technicalValues.weldingAllowanceMmPerEnd,
    weldingAllowanceMode: profileSystem.weldingAllowanceMode,
  });
  const verticalCut = calculateCutLength({
    baseLengthMm: input.heightMm,
    adjustment: profileSystem.technicalValues.verticalFrameAdjustmentMm,
    weldingAllowance: profileSystem.technicalValues.weldingAllowanceMmPerEnd,
    weldingAllowanceMode: profileSystem.weldingAllowanceMode,
  });
  const stockLength = profileSystem.technicalValues.stockLengthMm.value;
  const cutIssues: ProductionCalculationIssue[] = [];

  if (horizontalCut <= 0 || horizontalCut > stockLength) {
    cutIssues.push({
      code: 'INVALID_CUT_LENGTH',
      message: 'Yatay kasa kesim olcusu gecersiz veya stok boyunu asiyor.',
      field: 'horizontalFrameAdjustmentMm',
    });
  }

  if (verticalCut <= 0 || verticalCut > stockLength) {
    cutIssues.push({
      code: 'INVALID_CUT_LENGTH',
      message: 'Dikey kasa kesim olcusu gecersiz veya stok boyunu asiyor.',
      field: 'verticalFrameAdjustmentMm',
    });
  }

  if (cutIssues.length > 0) {
    return { ...baseFailure, issues: cutIssues };
  }

  return {
    ok: true,
    calculationMode: input.calculationMode,
    designId: input.designId,
    engineVersion: productionCalculationEngineVersion,
    calculatedAt,
    profileSystemSnapshot: cloneProfileSystem(profileSystem),
    frameCuts: [
      createFrameCutPiece({
        orientation: 'HORIZONTAL',
        profileSystem,
        baseLengthMm: input.widthMm,
        adjustmentField: 'horizontalFrameAdjustmentMm',
        angleField: 'horizontalCutAngleDeg',
        cutLengthMm: horizontalCut,
      }),
      createFrameCutPiece({
        orientation: 'VERTICAL',
        profileSystem,
        baseLengthMm: input.heightMm,
        adjustmentField: 'verticalFrameAdjustmentMm',
        angleField: 'verticalCutAngleDeg',
        cutLengthMm: verticalCut,
      }),
    ],
  };
}

export function calculateFixedGlassProduction(
  input: ProductionCalculationInput,
  profileSystem: ProductionProfileSystem | null,
  now = new Date(),
): ProductionCalculationResult {
  const frameResult = calculateFixedOuterFrameProduction(input, profileSystem, now);

  if (!frameResult.ok) {
    return frameResult;
  }

  const calculatedAt = now.toISOString();
  const baseFailure = {
    ok: false as const,
    calculationMode: input.calculationMode,
    designId: input.designId,
    engineVersion: productionCalculationEngineVersion,
    calculatedAt,
  };
  const glassIssues = validateFixedGlassRules(frameResult.profileSystemSnapshot);

  if (glassIssues.length > 0) {
    return { ...baseFailure, issues: glassIssues };
  }

  const fixedGlass = createFixedGlassPiece(input, frameResult.profileSystemSnapshot);
  if (fixedGlass.widthMm <= 0 || fixedGlass.heightMm <= 0) {
    return {
      ...baseFailure,
      issues: [
        {
          code: 'INVALID_GLASS_SIZE',
          message: 'Cam olcusu sifir veya negatif cikti. Cam kurallarini kontrol edin.',
        },
      ],
    };
  }

  return {
    ...frameResult,
    fixedGlass,
  };
}

function validateInput(input: ProductionCalculationInput): ProductionCalculationIssue[] {
  const issues: ProductionCalculationIssue[] = [];

  if (!Number.isFinite(input.widthMm) || input.widthMm <= 0) {
    issues.push({
      code: 'INVALID_WIDTH',
      message: 'Genislik 0 dan buyuk bir mm degeri olmali.',
      field: 'widthMm',
    });
  }

  if (!Number.isFinite(input.heightMm) || input.heightMm <= 0) {
    issues.push({
      code: 'INVALID_HEIGHT',
      message: 'Yukseklik 0 dan buyuk bir mm degeri olmali.',
      field: 'heightMm',
    });
  }

  return issues;
}

function validateProfileSystem(
  input: ProductionCalculationInput,
  profileSystem: ProductionProfileSystem,
): ProductionCalculationIssue[] {
  const issues: ProductionCalculationIssue[] = [];

  if (profileSystem.status !== 'VERIFIED') {
    issues.push({
      code: 'PROFILE_SYSTEM_NOT_VERIFIED',
      message: 'Bu profil sistemi icin dogrulanmis uretim verileri eksik.',
    });
  }

  if (profileSystem.version !== input.profileSystemVersion) {
    issues.push({
      code: 'PROFILE_SYSTEM_VERSION_MISMATCH',
      message: 'Tasarimdaki profil sistemi surumu ile kayitli surum eslesmiyor.',
    });
  }

  if (!profileSystem.frameProfileCode.trim()) {
    issues.push({
      code: 'FRAME_PROFILE_NOT_FOUND',
      message: 'Kasa profil kodu girilmeden uretim kesim listesi olusturulamaz.',
      field: 'frameProfileCode',
    });
  }

  const requiredKeys =
    profileSystem.weldingAllowanceMode === 'ADD_TO_CUT_LENGTH'
      ? [...requiredTechnicalValueKeys, 'weldingAllowanceMmPerEnd' as const]
      : requiredTechnicalValueKeys;

  requiredKeys.forEach((key) => {
    const value = profileSystem.technicalValues[key];
    if (!isTechnicalValuePresent(value)) {
      issues.push({
        code: 'TECHNICAL_VALUE_MISSING',
        message: `${technicalValueLabels[key]} teknik degeri eksik.`,
        field: key,
      });
      return;
    }

    if (value.status !== 'VERIFIED') {
      issues.push({
        code: 'TECHNICAL_VALUE_NOT_VERIFIED',
        message: `${technicalValueLabels[key]} teknik degeri dogrulanmamis.`,
        field: key,
      });
    }
  });

  return issues;
}

function validateFixedGlassRules(profileSystem: ProductionProfileSystem): ProductionCalculationIssue[] {
  const issues: ProductionCalculationIssue[] = [];
  const requiredGlassKeys: (keyof ProfileSystemTechnicalValues)[] = [
    'fixedGlassDeductionLeftMm',
    'fixedGlassDeductionRightMm',
    'fixedGlassDeductionTopMm',
    'fixedGlassDeductionBottomMm',
  ];

  requiredGlassKeys.forEach((key) => {
    const value = profileSystem.technicalValues[key];

    if (!isTechnicalValuePresent(value)) {
      issues.push({
        code: 'TECHNICAL_VALUE_MISSING',
        message: `${technicalValueLabels[key]} teknik degeri eksik.`,
        field: key,
      });
      return;
    }

    if (value.status !== 'VERIFIED') {
      issues.push({
        code: 'TECHNICAL_VALUE_NOT_VERIFIED',
        message: `${technicalValueLabels[key]} teknik degeri dogrulanmamis.`,
        field: key,
      });
    }
  });

  return issues;
}

function isTechnicalValuePresent(value: TechnicalValue | undefined): value is TechnicalValue {
  return value !== undefined && Number.isFinite(value.value);
}

function calculateCutLength({
  baseLengthMm,
  adjustment,
  weldingAllowance,
  weldingAllowanceMode,
}: {
  baseLengthMm: number;
  adjustment: TechnicalValue;
  weldingAllowance: TechnicalValue | undefined;
  weldingAllowanceMode: ProductionProfileSystem['weldingAllowanceMode'];
}): number {
  const weldingAddition =
    weldingAllowanceMode === 'ADD_TO_CUT_LENGTH' && weldingAllowance ? weldingAllowance.value * 2 : 0;
  return Math.round(baseLengthMm + adjustment.value + weldingAddition);
}

function createFrameCutPiece({
  orientation,
  profileSystem,
  baseLengthMm,
  adjustmentField,
  angleField,
  cutLengthMm,
}: {
  orientation: FrameCutPiece['orientation'];
  profileSystem: ProductionProfileSystem;
  baseLengthMm: number;
  adjustmentField: 'horizontalFrameAdjustmentMm' | 'verticalFrameAdjustmentMm';
  angleField: 'horizontalCutAngleDeg' | 'verticalCutAngleDeg';
  cutLengthMm: number;
}): FrameCutPiece {
  const adjustment = profileSystem.technicalValues[adjustmentField];
  const angle = profileSystem.technicalValues[angleField];
  const weldingAllowance = profileSystem.technicalValues.weldingAllowanceMmPerEnd;
  const weldingAddition =
    profileSystem.weldingAllowanceMode === 'ADD_TO_CUT_LENGTH' && weldingAllowance
      ? weldingAllowance.value * 2
      : 0;
  const trace: CalculationTraceItem[] = [
    {
      label: orientation === 'HORIZONTAL' ? 'Dis genislik' : 'Dis yukseklik',
      operation: 'INPUT',
      value: baseLengthMm,
      unit: 'MM',
    },
    {
      label: technicalValueLabels[adjustmentField],
      operation: adjustment.value >= 0 ? 'ADD' : 'SUBTRACT',
      value: Math.abs(adjustment.value),
      unit: 'MM',
      field: adjustmentField,
    },
    {
      label: 'Kaynak payi yontemi',
      operation: 'CHECK',
      value: profileSystem.weldingAllowanceMode,
      unit: 'TEXT',
    },
  ];

  if (weldingAddition > 0) {
    trace.push({
      label: 'Iki uc kaynak payi',
      operation: 'ADD',
      value: weldingAddition,
      unit: 'MM',
      field: 'weldingAllowanceMmPerEnd',
    });
  }

  trace.push({
    label: 'Kesim olcusu',
    operation: 'RESULT',
    value: cutLengthMm,
    unit: 'MM',
  });

  return {
    component: 'OUTER_FRAME',
    profileCode: profileSystem.frameProfileCode,
    reference: 'PRE_WELD_CUT_LENGTH',
    orientation,
    cutLengthMm,
    quantity: 2,
    angleStartDeg: angle.value,
    angleEndDeg: angle.value,
    calculationTrace: trace,
  };
}

function createFixedGlassPiece(
  input: ProductionCalculationInput,
  profileSystem: ProductionProfileSystem,
): FixedGlassPiece {
  const left = profileSystem.technicalValues.fixedGlassDeductionLeftMm!;
  const right = profileSystem.technicalValues.fixedGlassDeductionRightMm!;
  const top = profileSystem.technicalValues.fixedGlassDeductionTopMm!;
  const bottom = profileSystem.technicalValues.fixedGlassDeductionBottomMm!;
  const widthMm = Math.round(input.widthMm - left.value - right.value);
  const heightMm = Math.round(input.heightMm - top.value - bottom.value);
  const calculationTrace: CalculationTraceItem[] = [
    {
      label: 'Dis genislik',
      operation: 'INPUT',
      value: input.widthMm,
      unit: 'MM',
      field: 'widthMm',
    },
    {
      label: technicalValueLabels.fixedGlassDeductionLeftMm,
      operation: 'SUBTRACT',
      value: left.value,
      unit: 'MM',
      field: 'fixedGlassDeductionLeftMm',
    },
    {
      label: technicalValueLabels.fixedGlassDeductionRightMm,
      operation: 'SUBTRACT',
      value: right.value,
      unit: 'MM',
      field: 'fixedGlassDeductionRightMm',
    },
    {
      label: 'Cam siparis eni',
      operation: 'RESULT',
      value: widthMm,
      unit: 'MM',
    },
    {
      label: 'Dis yukseklik',
      operation: 'INPUT',
      value: input.heightMm,
      unit: 'MM',
      field: 'heightMm',
    },
    {
      label: technicalValueLabels.fixedGlassDeductionTopMm,
      operation: 'SUBTRACT',
      value: top.value,
      unit: 'MM',
      field: 'fixedGlassDeductionTopMm',
    },
    {
      label: technicalValueLabels.fixedGlassDeductionBottomMm,
      operation: 'SUBTRACT',
      value: bottom.value,
      unit: 'MM',
      field: 'fixedGlassDeductionBottomMm',
    },
    {
      label: 'Cam siparis boyu',
      operation: 'RESULT',
      value: heightMm,
      unit: 'MM',
    },
  ];

  return {
    component: 'FIXED_GLASS',
    reference: 'GLASS_ORDER_SIZE',
    widthMm,
    heightMm,
    areaSquareMeters: Math.round(((widthMm * heightMm) / 1_000_000) * 1000) / 1000,
    quantity: 1,
    calculationTrace,
  };
}

function cloneProfileSystem(profileSystem: ProductionProfileSystem): ProductionProfileSystem {
  return JSON.parse(JSON.stringify(profileSystem)) as ProductionProfileSystem;
}

const technicalValueLabels: Record<keyof ProfileSystemTechnicalValues, string> = {
  stockLengthMm: 'Profil stok boyu',
  horizontalFrameAdjustmentMm: 'Yatay kasa ekleme/dusum',
  verticalFrameAdjustmentMm: 'Dikey kasa ekleme/dusum',
  horizontalCutAngleDeg: 'Yatay kesim acisi',
  verticalCutAngleDeg: 'Dikey kesim acisi',
  sawKerfMm: 'Testere bicak payi',
  startTrimMm: 'Baslangic kirpma payi',
  endTrimMm: 'Bitis kirpma payi',
  weldingAllowanceMmPerEnd: 'Her uc kaynak payi',
  fixedGlassDeductionLeftMm: 'Sabit cam sol dusum',
  fixedGlassDeductionRightMm: 'Sabit cam sag dusum',
  fixedGlassDeductionTopMm: 'Sabit cam ust dusum',
  fixedGlassDeductionBottomMm: 'Sabit cam alt dusum',
};
