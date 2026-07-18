import { DesignNode } from '../entities/DesignNode';
import { calculateDesignLayout } from '../layout/calculateDesignLayout';

type GetPanelRealDimensionsInput = {
  rootNode: DesignNode;
  panelId: string;
  designWidth: number;
  designHeight: number;
};

export type PanelRealDimensions = {
  width: number;
  height: number;
};

export function getPanelRealDimensions({
  rootNode,
  panelId,
  designWidth,
  designHeight,
}: GetPanelRealDimensionsInput): PanelRealDimensions | null {
  const layout = calculateDesignLayout({
    rootNode,
    designWidth,
    designHeight,
    canvasWidth: designWidth,
    canvasHeight: designHeight,
    padding: 0,
  });
  const panel = layout.panelBounds.find((item) => item.nodeId === panelId);

  if (!panel) {
    return null;
  }

  return {
    width: Math.round(panel.realWidth),
    height: Math.round(panel.realHeight),
  };
}
