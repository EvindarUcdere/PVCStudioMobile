export type WallClass = 'A' | 'B' | 'C';

export type ProfileSystemSelection = {
  brandId: string;
  seriesId: string;
  profileWidth: number;
  chamberCount: number | null;
  wallClass: WallClass | null;
  gasketCount: number | null;
  gasketColor: string | null;
  steelThickness: number | null;
  interiorColorId: string;
  exteriorColorId: string;
  productionProfileSystemId?: string | undefined;
  productionProfileSystemName?: string | undefined;
  productionProfileSystemVersion?: string | undefined;
  productionProfileSystemStatus?: 'DRAFT' | 'VERIFIED' | 'ARCHIVED' | undefined;
  productionFrameProfileCode?: string | undefined;
  productionSashProfileCode?: string | undefined;
  productionMullionProfileCode?: string | undefined;
  productionTransomProfileCode?: string | undefined;
  productionGlazingBeadProfileCode?: string | undefined;
  productionGasketCode?: string | undefined;
  productionHardwareSetCode?: string | undefined;
};
