import { DesignNode } from '../entities/DesignNode';
import { DesignProject } from '../entities/DesignProject';
import { OpeningType } from '../enums/OpeningType';
import { isArchTopFrame } from './frameShape';

type PanelSummary = {
  openingType: OpeningType;
};

export function withAutoDesignName(project: DesignProject): DesignProject {
  return {
    ...project,
    name: createDesignAutoName(project),
  };
}

export function createDesignAutoName(project: DesignProject): string {
  const rootNode = project.rootNode.type === 'frame' ? project.rootNode.child : project.rootNode;
  const panels = collectPanelsInVisualOrder(rootNode);
  const panelCount = panels.length;

  if (panelCount <= 0) {
    return 'Ozel Bos Tasarim';
  }

  const fixedCount = panels.filter((panel) => panel.openingType === 'fixed').length;
  const openingCount = panels.filter((panel) => isOpening(panel.openingType)).length;
  const slidingCount = panels.filter((panel) => isSliding(panel.openingType)).length;
  const doorCount = panels.filter((panel) => isDoor(panel.openingType)).length;
  const tiltCount = panels.filter((panel) => isTilt(panel.openingType)).length;
  const prefix = project.rootNode.type === 'frame' && isArchTopFrame(project.rootNode) ? 'Kemerli ' : '';

  if (panelCount === 1) {
    return `${prefix}Tek ${openingLabel(panels[0]!.openingType)}`;
  }

  if (panelCount <= 3) {
    return `${prefix}${describeNodeByLayout(rootNode)}`;
  }

  const parts = [`${prefix}${panelCount} Gozlu`];
  if (openingCount > 0) {
    parts.push(`${openingCount} Acilir`);
  }
  if (fixedCount > 0) {
    parts.push(`${fixedCount} Sabit`);
  }
  if (tiltCount > 0) {
    parts.push(`${tiltCount} Vasistas`);
  }
  if (slidingCount > 0) {
    parts.push(`${slidingCount} Surme`);
  }
  if (doorCount > 0) {
    parts.push(`${doorCount} Kapi`);
  }

  return parts.join(' ');
}

function collectPanelsInVisualOrder(node: DesignNode): PanelSummary[] {
  if (node.type === 'panel') {
    return [{ openingType: node.openingType }];
  }

  if (node.type === 'frame') {
    return collectPanelsInVisualOrder(node.child);
  }

  return [
    ...collectPanelsInVisualOrder(node.first),
    ...collectPanelsInVisualOrder(node.second),
  ];
}

function describeNodeByLayout(node: DesignNode): string {
  if (node.type === 'frame') {
    return describeNodeByLayout(node.child);
  }

  if (node.type === 'panel') {
    return openingLabel(node.openingType);
  }

  if (node.direction === 'vertical') {
    const verticalPanels = collectPureVerticalPanels(node);

    if (verticalPanels.length === 2) {
      return `${positionedLabel(verticalPanels[0]!.openingType, 'Sol')} ${positionedLabel(
        verticalPanels[1]!.openingType,
        'Sag',
      )}`;
    }

    if (verticalPanels.length === 3) {
      return `${positionedLabel(verticalPanels[0]!.openingType, 'Sol')} ${positionedLabel(
        verticalPanels[1]!.openingType,
        'Orta',
      )} ${positionedLabel(verticalPanels[2]!.openingType, 'Sag')}`;
    }

    return `${describeBranch(node.first, 'Sol')} ${describeBranch(node.second, 'Sag')}`;
  }

  return `${describeBranch(node.first, 'Ust')} ${describeBranch(node.second, 'Alt')}`;
}

function collectPureVerticalPanels(node: DesignNode): PanelSummary[] {
  if (node.type === 'panel') {
    return [{ openingType: node.openingType }];
  }

  if (node.type === 'frame') {
    return collectPureVerticalPanels(node.child);
  }

  if (node.direction !== 'vertical') {
    return [];
  }

  const first = collectPureVerticalPanels(node.first);
  const second = collectPureVerticalPanels(node.second);

  if (first.length === 0 || second.length === 0) {
    return [];
  }

  return [...first, ...second];
}

function describeBranch(node: DesignNode, position: 'Sol' | 'Sag' | 'Ust' | 'Alt'): string {
  if (node.type === 'panel') {
    return positionedLabel(node.openingType, position);
  }

  return `${position} ${describeNodeByLayout(node)}`;
}

function positionedLabel(openingType: OpeningType, position: 'Sol' | 'Orta' | 'Sag' | 'Ust' | 'Alt'): string {
  return `${position} ${openingLabel(openingType)}`;
}

function openingLabel(openingType: OpeningType): string {
  if (openingType === 'fixed') {
    return 'Sabit';
  }

  if (openingType === 'tilt' || openingType === 'tilt-top' || openingType === 'tilt-bottom') {
    return 'Vasistas';
  }

  if (openingType === 'tilt-turn-left' || openingType === 'tilt-turn-right') {
    return 'Cift Acilim';
  }

  if (isSliding(openingType)) {
    return 'Surme';
  }

  if (isDoor(openingType)) {
    return 'Kapi';
  }

  return 'Acilir';
}

function isOpening(openingType: OpeningType): boolean {
  return (
    openingType === 'open-left' ||
    openingType === 'open-right' ||
    openingType === 'tilt-turn-left' ||
    openingType === 'tilt-turn-right'
  );
}

function isTilt(openingType: OpeningType): boolean {
  return openingType === 'tilt' || openingType === 'tilt-top' || openingType === 'tilt-bottom';
}

function isSliding(openingType: OpeningType): boolean {
  return openingType === 'sliding-left' || openingType === 'sliding-right';
}

function isDoor(openingType: OpeningType): boolean {
  return openingType === 'door-left' || openingType === 'door-right';
}
