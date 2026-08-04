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
  const panels = collectPanelsInVisualOrder(project.rootNode);
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

  if (panelCount === 2) {
    return `${prefix}${positionedLabel(panels[0]!.openingType, 'Sol')} ${positionedLabel(
      panels[1]!.openingType,
      'Sag',
    )}`;
  }

  if (panelCount === 3) {
    return `${prefix}${positionedLabel(panels[0]!.openingType, 'Sol')} ${positionedLabel(
      panels[1]!.openingType,
      'Orta',
    )} ${positionedLabel(panels[2]!.openingType, 'Sag')}`;
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

function positionedLabel(openingType: OpeningType, position: 'Sol' | 'Orta' | 'Sag'): string {
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
