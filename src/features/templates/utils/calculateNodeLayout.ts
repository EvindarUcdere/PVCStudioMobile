import { DesignNode } from '../../../domain/designs/entities/DesignNode';
import { InsectScreenType } from '../../../domain/designs/entities/PanelNode';
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
  insectScreen: InsectScreenType | null;
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
      const shutterHeight = node.rollerShutter?.enabled
        ? Math.min(current.height * 0.35, Math.max(10, current.height * 0.14))
        : 0;
      visit(node.child, {
        ...current,
        y: current.y + shutterHeight,
        height: Math.max(1, current.height - shutterHeight),
      });
      return;
    }

    if (node.type === 'panel') {
      layouts.push({
        ...current,
        id: node.id,
        openingType: node.openingType,
        insectScreen: node.insectScreen ?? null,
      });
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
