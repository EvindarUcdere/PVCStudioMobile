export type TechnicalValueUnit = 'MM' | 'DEGREE';

export type TechnicalValueStatus = 'DRAFT' | 'VERIFIED';

export type TechnicalValue = {
  value: number;
  unit: TechnicalValueUnit;
  status: TechnicalValueStatus;
  source?: string | undefined;
  note?: string | undefined;
  verifiedAt?: string | undefined;
};

export type ProductionProfileSystemStatus = 'DRAFT' | 'VERIFIED' | 'ARCHIVED';

export type WeldingAllowanceMode = 'ADD_TO_CUT_LENGTH' | 'INCLUDED_BY_MACHINE' | 'NOT_APPLICABLE';

export type ProfileSystemTechnicalValues = {
  stockLengthMm: TechnicalValue;
  horizontalFrameAdjustmentMm: TechnicalValue;
  verticalFrameAdjustmentMm: TechnicalValue;
  horizontalCutAngleDeg: TechnicalValue;
  verticalCutAngleDeg: TechnicalValue;
  sawKerfMm: TechnicalValue;
  startTrimMm: TechnicalValue;
  endTrimMm: TechnicalValue;
  weldingAllowanceMmPerEnd: TechnicalValue;
  fixedGlassDeductionLeftMm?: TechnicalValue | undefined;
  fixedGlassDeductionRightMm?: TechnicalValue | undefined;
  fixedGlassDeductionTopMm?: TechnicalValue | undefined;
  fixedGlassDeductionBottomMm?: TechnicalValue | undefined;
};

export type ProductionProfileSystem = {
  id: string;
  companyId: string;
  displayName: string;
  brand: string;
  seriesName: string;
  version: string;
  status: ProductionProfileSystemStatus;
  frameProfileCode: string;
  sashProfileCode?: string | undefined;
  mullionProfileCode?: string | undefined;
  transomProfileCode?: string | undefined;
  glazingBeadProfileCode?: string | undefined;
  gasketCode?: string | undefined;
  hardwareSetCode?: string | undefined;
  weldingAllowanceMode: WeldingAllowanceMode;
  technicalValues: ProfileSystemTechnicalValues;
  createdAt: string;
  updatedAt: string;
};

export type CalculationMode = 'ESTIMATE' | 'PRODUCTION';

export type ProductionCalculationErrorCode =
  | 'PROFILE_SYSTEM_NOT_FOUND'
  | 'PROFILE_SYSTEM_NOT_VERIFIED'
  | 'PROFILE_SYSTEM_VERSION_MISMATCH'
  | 'FRAME_PROFILE_NOT_FOUND'
  | 'TECHNICAL_VALUE_MISSING'
  | 'TECHNICAL_VALUE_NOT_VERIFIED'
  | 'INVALID_WIDTH'
  | 'INVALID_HEIGHT'
  | 'INVALID_CUT_LENGTH'
  | 'INVALID_GLASS_SIZE';

export type ProductionCalculationIssue = {
  code: ProductionCalculationErrorCode;
  message: string;
  field?: keyof ProfileSystemTechnicalValues | 'widthMm' | 'heightMm' | 'frameProfileCode';
};

export type CalculationTraceItem = {
  label: string;
  operation: 'INPUT' | 'ADD' | 'SUBTRACT' | 'CHECK' | 'RESULT';
  value: number | string;
  unit?: TechnicalValueUnit | 'TEXT';
  field?: keyof ProfileSystemTechnicalValues | 'widthMm' | 'heightMm' | 'frameProfileCode';
};

export type FixedGlassPiece = {
  component: 'FIXED_GLASS';
  reference: 'GLASS_ORDER_SIZE';
  widthMm: number;
  heightMm: number;
  areaSquareMeters: number;
  quantity: number;
  calculationTrace: CalculationTraceItem[];
};

export type FrameCutPiece = {
  component: 'OUTER_FRAME';
  profileCode: string;
  reference: 'PRE_WELD_CUT_LENGTH';
  orientation: 'HORIZONTAL' | 'VERTICAL';
  cutLengthMm: number;
  quantity: number;
  angleStartDeg: number;
  angleEndDeg: number;
  calculationTrace: CalculationTraceItem[];
};

export type ProductionCalculationInput = {
  calculationMode: 'PRODUCTION';
  designId: string;
  widthMm: number;
  heightMm: number;
  profileSystemId: string;
  profileSystemVersion: string;
};

export type ProductionCalculationSuccess = {
  ok: true;
  calculationMode: 'PRODUCTION';
  designId: string;
  engineVersion: string;
  calculatedAt: string;
  profileSystemSnapshot: ProductionProfileSystem;
  frameCuts: FrameCutPiece[];
  fixedGlass?: FixedGlassPiece | undefined;
};

export type ProductionCalculationFailure = {
  ok: false;
  calculationMode: 'PRODUCTION';
  designId: string;
  engineVersion: string;
  calculatedAt: string;
  issues: ProductionCalculationIssue[];
};

export type ProductionCalculationResult = ProductionCalculationSuccess | ProductionCalculationFailure;
