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
};
