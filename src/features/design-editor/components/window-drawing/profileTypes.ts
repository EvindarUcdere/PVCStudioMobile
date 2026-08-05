export type DrawingMode = 'elevation' | 'section';

export type ProfileType = 'frame' | 'sash' | 'mullion' | 'glazingBead' | 'gasket' | 'glass';

export type ProfilePathRole =
  | 'outerShell'
  | 'innerWall'
  | 'chamber'
  | 'gasketChannel'
  | 'glassChannel'
  | 'reinforcement';

export type Point = {
  x: number;
  y: number;
};

export type ProfilePath = {
  id: string;
  points: Point[];
  closed: boolean;
  role: ProfilePathRole;
};

export type ProfileChamber = {
  id: string;
  points: Point[];
};

export type ProfileDefinition = {
  id: string;
  name: string;
  type: ProfileType;
  faceWidthMm: number;
  depthMm: number;
  chambers?: ProfileChamber[];
  paths: ProfilePath[];
};

export type GlassUnitDefinition = {
  paneCount: 1 | 2 | 3;
  paneThicknessMm: number[];
  spacerThicknessMm: number[];
};

export type WindowDimensions = {
  widthMm: number;
  heightMm: number;
};

