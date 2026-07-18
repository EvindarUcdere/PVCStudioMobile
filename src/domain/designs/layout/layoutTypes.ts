import { OpeningType } from '../enums/OpeningType';

export type NodeBounds = {
  nodeId: string;
  nodeType: 'frame' | 'split' | 'panel';
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
};

export type PanelBounds = NodeBounds & {
  nodeType: 'panel';
  openingType: OpeningType;
  realWidth: number;
  realHeight: number;
};

export type SplitBounds = NodeBounds & {
  nodeType: 'split';
  direction: 'horizontal' | 'vertical';
  dividerX1: number;
  dividerY1: number;
  dividerX2: number;
  dividerY2: number;
};

export type DesignLayoutResult = {
  scale: number;
  frameBounds: NodeBounds;
  nodeBounds: Record<string, NodeBounds>;
  panelBounds: PanelBounds[];
  splitBounds: SplitBounds[];
};

export type LayoutBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
