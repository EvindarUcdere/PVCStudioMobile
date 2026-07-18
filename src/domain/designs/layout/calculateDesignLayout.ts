import { DesignNode } from '../entities/DesignNode';
import {
  DESIGN_LAYOUT_DEFAULT_PADDING,
  DESIGN_LAYOUT_MAX_DEPTH,
  DESIGN_LAYOUT_MAX_SCALE,
  DESIGN_LAYOUT_MIN_RENDER_SIZE,
} from './layoutConstants';
import { DesignLayoutResult, LayoutBounds, NodeBounds, PanelBounds, SplitBounds } from './layoutTypes';

type CalculateDesignLayoutInput = {
  rootNode: DesignNode;
  designWidth: number;
  designHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  padding?: number;
};

type VisitInput = {
  node: DesignNode;
  bounds: LayoutBounds;
  realBounds: LayoutBounds;
  depth: number;
  result: DesignLayoutResult;
  visited: Set<string>;
};

export class DesignLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignLayoutError';
  }
}

export function calculateDesignLayout({
  rootNode,
  designWidth,
  designHeight,
  canvasWidth,
  canvasHeight,
  padding = DESIGN_LAYOUT_DEFAULT_PADDING,
}: CalculateDesignLayoutInput): DesignLayoutResult {
  assertPositive(designWidth, 'designWidth');
  assertPositive(designHeight, 'designHeight');
  assertPositive(canvasWidth, 'canvasWidth');
  assertPositive(canvasHeight, 'canvasHeight');

  const availableWidth = Math.max(DESIGN_LAYOUT_MIN_RENDER_SIZE, canvasWidth - padding * 2);
  const availableHeight = Math.max(DESIGN_LAYOUT_MIN_RENDER_SIZE, canvasHeight - padding * 2);
  const scale = Math.min(availableWidth / designWidth, availableHeight / designHeight, DESIGN_LAYOUT_MAX_SCALE);
  const renderWidth = designWidth * scale;
  const renderHeight = designHeight * scale;
  const frameBounds: NodeBounds = {
    nodeId: rootNode.id,
    nodeType: 'frame',
    x: (canvasWidth - renderWidth) / 2,
    y: (canvasHeight - renderHeight) / 2,
    width: renderWidth,
    height: renderHeight,
    depth: 0,
  };

  const result: DesignLayoutResult = {
    scale,
    frameBounds,
    nodeBounds: { [rootNode.id]: frameBounds },
    panelBounds: [],
    splitBounds: [],
  };

  visitNode({
    node: rootNode,
    bounds: frameBounds,
    realBounds: { x: 0, y: 0, width: designWidth, height: designHeight },
    depth: 0,
    result,
    visited: new Set<string>(),
  });

  if (result.panelBounds.length === 0) {
    throw new DesignLayoutError('Design tree does not contain a panel.');
  }

  return result;
}

function visitNode({ node, bounds, realBounds, depth, result, visited }: VisitInput): void {
  if (depth > DESIGN_LAYOUT_MAX_DEPTH) {
    throw new DesignLayoutError('Design tree maximum depth exceeded.');
  }

  if (visited.has(node.id)) {
    throw new DesignLayoutError('Design tree contains duplicate node ids.');
  }

  if (bounds.width <= 0 || bounds.height <= 0 || realBounds.width <= 0 || realBounds.height <= 0) {
    throw new DesignLayoutError('Design tree contains invalid bounds.');
  }

  visited.add(node.id);

  if (node.type === 'frame') {
    const frameBounds: NodeBounds = { ...bounds, nodeId: node.id, nodeType: 'frame', depth };
    result.nodeBounds[node.id] = frameBounds;
    visitNode({
      node: node.child,
      bounds,
      realBounds,
      depth: depth + 1,
      result,
      visited,
    });
    return;
  }

  if (node.type === 'panel') {
    const panelBounds: PanelBounds = {
      ...bounds,
      nodeId: node.id,
      nodeType: 'panel',
      depth,
      openingType: node.openingType,
      realWidth: realBounds.width,
      realHeight: realBounds.height,
    };
    result.nodeBounds[node.id] = panelBounds;
    result.panelBounds.push(panelBounds);
    return;
  }

  if (node.ratio <= 0 || node.ratio >= 1) {
    throw new DesignLayoutError('Design tree contains invalid split ratio.');
  }

  if (node.direction === 'vertical') {
    const firstWidth = bounds.width * node.ratio;
    const firstRealWidth = realBounds.width * node.ratio;
    const splitBounds: SplitBounds = {
      ...bounds,
      nodeId: node.id,
      nodeType: 'split',
      depth,
      direction: node.direction,
      dividerX1: bounds.x + firstWidth,
      dividerY1: bounds.y,
      dividerX2: bounds.x + firstWidth,
      dividerY2: bounds.y + bounds.height,
    };
    result.nodeBounds[node.id] = splitBounds;
    result.splitBounds.push(splitBounds);
    visitNode({
      node: node.first,
      bounds: { ...bounds, width: firstWidth },
      realBounds: { ...realBounds, width: firstRealWidth },
      depth: depth + 1,
      result,
      visited,
    });
    visitNode({
      node: node.second,
      bounds: {
        x: bounds.x + firstWidth,
        y: bounds.y,
        width: bounds.width - firstWidth,
        height: bounds.height,
      },
      realBounds: {
        x: realBounds.x + firstRealWidth,
        y: realBounds.y,
        width: realBounds.width - firstRealWidth,
        height: realBounds.height,
      },
      depth: depth + 1,
      result,
      visited,
    });
    return;
  }

  const firstHeight = bounds.height * node.ratio;
  const firstRealHeight = realBounds.height * node.ratio;
  const splitBounds: SplitBounds = {
    ...bounds,
    nodeId: node.id,
    nodeType: 'split',
    depth,
    direction: node.direction,
    dividerX1: bounds.x,
    dividerY1: bounds.y + firstHeight,
    dividerX2: bounds.x + bounds.width,
    dividerY2: bounds.y + firstHeight,
  };
  result.nodeBounds[node.id] = splitBounds;
  result.splitBounds.push(splitBounds);
  visitNode({
    node: node.first,
    bounds: { ...bounds, height: firstHeight },
    realBounds: { ...realBounds, height: firstRealHeight },
    depth: depth + 1,
    result,
    visited,
  });
  visitNode({
    node: node.second,
    bounds: {
      x: bounds.x,
      y: bounds.y + firstHeight,
      width: bounds.width,
      height: bounds.height - firstHeight,
    },
    realBounds: {
      x: realBounds.x,
      y: realBounds.y + firstRealHeight,
      width: realBounds.width,
      height: realBounds.height - firstRealHeight,
    },
    depth: depth + 1,
    result,
    visited,
  });
}

function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DesignLayoutError(`${name} must be positive.`);
  }
}
