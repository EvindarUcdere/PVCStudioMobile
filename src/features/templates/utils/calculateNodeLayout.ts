import { DesignNode } from '../../../domain/designs/entities/DesignNode';
import { OpeningType } from '../../../domain/designs/enums/OpeningType';

export type LayoutBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PanelLayout = LayoutBounds & {
  id: string;
  openingType: OpeningType;
};

export function calculateNodeLayout(rootNode: DesignNode, bounds: LayoutBounds): PanelLayout[] {
  const layouts: PanelLayout[] = [];
  const visited = new Set<string>();

  function visit(node: DesignNode, current: LayoutBounds): void {
    if (visited.has(node.id)) {
      return;
    }
    visited.add(node.id);

    if (node.type === 'frame') {
      visit(node.child, current);
      return;
    }

    if (node.type === 'panel') {
      layouts.push({ ...current, id: node.id, openingType: node.openingType });
      return;
    }

    if (node.direction === 'vertical') {
      const firstWidth = current.width * node.ratio;
      visit(node.first, { ...current, width: firstWidth });
      visit(node.second, {
        x: current.x + firstWidth,
        y: current.y,
        width: current.width - firstWidth,
        height: current.height,
      });
      return;
    }

    const firstHeight = current.height * node.ratio;
    visit(node.first, { ...current, height: firstHeight });
    visit(node.second, {
      x: current.x,
      y: current.y + firstHeight,
      width: current.width,
      height: current.height - firstHeight,
    });
  }

  visit(rootNode, bounds);
  return layouts;
}
