export type DecorativeBarType =
  | 'none'
  | 'single-horizontal'
  | 'single-vertical'
  | 'grid'
  | 'triple-horizontal'
  | 'triple-vertical';

export type DecorativeBarConfig = {
  type: DecorativeBarType;
  horizontalCount: number;
  verticalCount: number;
};

export type GlassSelection = {
  glassTypeId: string;
  formula: string | null;
  thickness: number | null;
  color: string | null;
  pattern: string | null;
  lowE: boolean;
  tempered: boolean;
  laminated: boolean;
  decorativeBar: DecorativeBarConfig | null;
};
