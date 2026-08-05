import { ProfileDefinition } from './profileTypes';

export type RectMm = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ReferenceWindowGeometry = {
  wallOpening: RectMm;
  frameOuter: RectMm;
  frameInner: RectMm;
  moduleArea: RectMm;
  mullion: RectMm;
  leftModule: RectMm;
  rightModule: RectMm;
  rightSashOuter: RectMm;
  rightSashInner: RectMm;
  leftGlass: RectMm;
  rightGlass: RectMm;
  scale: number;
  originX: number;
  originY: number;
};

export const defaultFrameProfile: ProfileDefinition = {
  id: 'generic-70-frame',
  name: 'Generic 70 mm frame profile',
  type: 'frame',
  faceWidthMm: 70,
  depthMm: 70,
  paths: [
    { id: 'frame-shell', role: 'outerShell', closed: true, points: [] },
    { id: 'frame-chambers', role: 'chamber', closed: true, points: [] },
    { id: 'frame-gasket-channel', role: 'gasketChannel', closed: false, points: [] },
    { id: 'frame-reinforcement', role: 'reinforcement', closed: true, points: [] },
  ],
};

export const defaultSashProfile: ProfileDefinition = {
  id: 'generic-70-sash',
  name: 'Generic 70 mm sash profile',
  type: 'sash',
  faceWidthMm: 62,
  depthMm: 70,
  paths: [
    { id: 'sash-shell', role: 'outerShell', closed: true, points: [] },
    { id: 'sash-glass-channel', role: 'glassChannel', closed: false, points: [] },
    { id: 'sash-gasket-channel', role: 'gasketChannel', closed: false, points: [] },
  ],
};

export const defaultMullionProfile: ProfileDefinition = {
  id: 'generic-70-t-mullion',
  name: 'Generic 70 mm T mullion profile',
  type: 'mullion',
  faceWidthMm: 82,
  depthMm: 70,
  paths: [
    { id: 'mullion-shell', role: 'outerShell', closed: true, points: [] },
    { id: 'mullion-double-seat', role: 'glassChannel', closed: false, points: [] },
    { id: 'mullion-reinforcement', role: 'reinforcement', closed: true, points: [] },
  ],
};

export function insetRect(rect: RectMm, inset: number): RectMm {
  return {
    x: rect.x + inset,
    y: rect.y + inset,
    width: Math.max(0, rect.width - inset * 2),
    height: Math.max(0, rect.height - inset * 2),
  };
}

export function createReferenceWindowGeometry(
  canvasWidth: number,
  canvasHeight: number,
): ReferenceWindowGeometry {
  const wallOpening: RectMm = { x: 0, y: 0, width: 1400, height: 1400 };
  const installationGap = 0;
  const frameToModuleGap = 10;
  const sashClearance = 10;
  const glassGap = 20;
  const frameOuter = insetRect(wallOpening, installationGap);
  const frameInner = insetRect(frameOuter, defaultFrameProfile.faceWidthMm);
  const moduleArea = insetRect(frameInner, frameToModuleGap);
  const mullionWidth = defaultMullionProfile.faceWidthMm;
  const moduleWidth = (moduleArea.width - mullionWidth) / 2;
  const leftModule: RectMm = {
    x: moduleArea.x,
    y: moduleArea.y,
    width: moduleWidth,
    height: moduleArea.height,
  };
  const mullion: RectMm = {
    x: leftModule.x + leftModule.width,
    y: moduleArea.y,
    width: mullionWidth,
    height: moduleArea.height,
  };
  const rightModule: RectMm = {
    x: mullion.x + mullion.width,
    y: moduleArea.y,
    width: moduleWidth,
    height: moduleArea.height,
  };
  const rightSashOuter = insetRect(rightModule, sashClearance);
  const rightSashInner = insetRect(rightSashOuter, defaultSashProfile.faceWidthMm);
  const leftGlass = insetRect(leftModule, glassGap);
  const rightGlass = insetRect(rightSashInner, glassGap);
  const scale = Math.min((canvasWidth - 56) / wallOpening.width, (canvasHeight - 56) / wallOpening.height);

  return {
    wallOpening,
    frameOuter,
    frameInner,
    moduleArea,
    mullion,
    leftModule,
    rightModule,
    rightSashOuter,
    rightSashInner,
    leftGlass,
    rightGlass,
    scale,
    originX: (canvasWidth - wallOpening.width * scale) / 2,
    originY: (canvasHeight - wallOpening.height * scale) / 2,
  };
}

export function toPx(rect: RectMm, geometry: ReferenceWindowGeometry): RectMm {
  return {
    x: geometry.originX + rect.x * geometry.scale,
    y: geometry.originY + rect.y * geometry.scale,
    width: rect.width * geometry.scale,
    height: rect.height * geometry.scale,
  };
}

export function mmToPx(value: number, geometry: ReferenceWindowGeometry): number {
  return value * geometry.scale;
}

