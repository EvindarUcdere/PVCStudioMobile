import { DesignNode } from '../entities/DesignNode';
import { DesignProject } from '../entities/DesignProject';
import { GlassSelection } from '../entities/GlassSelection';
import { PanelNode } from '../entities/PanelNode';
import { ProfileSystemSelection } from '../entities/ProfileSystemSelection';
import { OpeningType } from '../enums/OpeningType';
import { SplitDirection } from '../enums/SplitDirection';
import { defaultProfileColorId } from '../colors/profileColorOptions';
import { createPanelNode } from '../factories/createPanelNode';
import { createSplitNode } from '../factories/createSplitNode';
import { GlassPriceOption, ProfileSystemPriceOption } from '../pricing/calculateDesignPriceEstimate';
import { countPanels } from './findNodeById';
import { getArchHeight, isArchTopFrame, withArchHeight } from './frameShape';
import { getPanelRealDimensions } from './getPanelDimensions';

export type AddPanelSide = 'left' | 'right' | 'top' | 'bottom';
export type MergePanelSide = 'left' | 'right' | 'top' | 'bottom';

export function updatePanelOpening(
  rootNode: DesignNode,
  panelId: string,
  openingType: OpeningType,
): DesignNode {
  return updatePanel(rootNode, panelId, (panel) => ({ ...panel, openingType }));
}

export function splitPanel(
  rootNode: DesignNode,
  panelId: string,
  direction: SplitDirection,
): DesignNode {
  return updatePanel(rootNode, panelId, (panel) =>
    createSplitNode({
      direction,
      first: panel,
      second: createPanelNode(),
    }),
  );
}

export function removePanel(rootNode: DesignNode, panelId: string): DesignNode {
  if (countPanels(rootNode) <= 1) {
    return rootNode;
  }

  return removeNode(rootNode, panelId).node ?? rootNode;
}

export function mergePanelWithAdjacent(
  rootNode: DesignNode,
  panelId: string,
  side: MergePanelSide,
): DesignNode {
  if (countPanels(rootNode) <= 1) {
    return rootNode;
  }

  const result = mergeNode(rootNode, panelId, side);
  return result.changed ? result.node : rootNode;
}

export function addPanelToDesignEdge(
  project: DesignProject,
  referencePanelId: string,
  side: AddPanelSide,
): DesignProject {
  if (project.rootNode.type !== 'frame') {
    return project;
  }

  const dimensions = getPanelRealDimensions({
    rootNode: project.rootNode,
    panelId: referencePanelId,
    designWidth: project.width,
    designHeight: project.height,
  });

  if (!dimensions) {
    return project;
  }

  const newPanel = createPanelNode();

  if (side === 'left' || side === 'right') {
    const addedWidth = dimensions.width;
    const nextWidth = project.width + addedWidth;
    const existingRatio = project.width / nextWidth;
    const child = createSplitNode({
      direction: 'vertical',
      ratio: side === 'left' ? addedWidth / nextWidth : existingRatio,
      first: side === 'left' ? newPanel : project.rootNode.child,
      second: side === 'left' ? project.rootNode.child : newPanel,
    });

    return {
      ...project,
      width: Math.round(nextWidth),
      rootNode: { ...project.rootNode, child },
    };
  }

  const addedHeight = dimensions.height;
  const nextHeight = project.height + addedHeight;
  const existingRatio = project.height / nextHeight;
  const child = createSplitNode({
    direction: 'horizontal',
    ratio: side === 'top' ? addedHeight / nextHeight : existingRatio,
    first: side === 'top' ? newPanel : project.rootNode.child,
    second: side === 'top' ? project.rootNode.child : newPanel,
  });

  return {
    ...project,
    height: Math.round(nextHeight),
    rootNode: { ...project.rootNode, child },
  };
}

export function adjustArchHeight(project: DesignProject, delta: number): DesignProject {
  if (project.rootNode.type !== 'frame' || !isArchTopFrame(project.rootNode)) {
    return project;
  }

  const currentHeight = getArchHeight(project.rootNode, project.height);
  const minHeight = Math.round(project.height * 0.15);
  const maxHeight = Math.round(project.height * 0.6);
  const nextHeight = Math.min(maxHeight, Math.max(minHeight, currentHeight + delta));

  return {
    ...project,
    rootNode: withArchHeight(project.rootNode, nextHeight),
  };
}

function updatePanel(
  node: DesignNode,
  panelId: string,
  updater: (panel: PanelNode) => DesignNode,
): DesignNode {
  if (node.type === 'panel') {
    return node.id === panelId ? updater(node) : node;
  }

  if (node.type === 'frame') {
    return { ...node, child: updatePanel(node.child, panelId, updater) };
  }

  return {
    ...node,
    first: updatePanel(node.first, panelId, updater),
    second: updatePanel(node.second, panelId, updater),
  };
}

export function updateProfileColor(project: DesignProject, colorId: string): DesignProject {
  return {
    ...project,
    profileSystem: {
      ...createDefaultProfileSystem(project.profileSystem),
      interiorColorId: colorId,
      exteriorColorId: colorId,
    },
  };
}

export function updateProfileSystemSelection(
  project: DesignProject,
  option: ProfileSystemPriceOption,
): DesignProject {
  const current = createDefaultProfileSystem(project.profileSystem);

  return {
    ...project,
    profileSystem: {
      ...current,
      seriesId: option.id,
      profileWidth: option.profileWidth,
      chamberCount: option.chamberCount,
      wallClass: option.wallClass,
    },
  };
}

export function updateDefaultGlassSelection(project: DesignProject, option: GlassPriceOption): DesignProject {
  const current = createDefaultGlass(project.defaultGlass);

  return {
    ...project,
    defaultGlass: {
      ...current,
      glassTypeId: option.id,
      formula: option.formula,
      thickness: option.thickness,
      lowE: option.lowE,
      tempered: option.tempered,
      laminated: option.laminated,
    },
  };
}

function createDefaultProfileSystem(
  current: ProfileSystemSelection | null,
): ProfileSystemSelection {
  return (
    current ?? {
      brandId: 'sample-brand-a',
      seriesId: 'standard-70',
      profileWidth: 70,
      chamberCount: 5,
      wallClass: 'B',
      gasketCount: 2,
      gasketColor: null,
      steelThickness: null,
      interiorColorId: defaultProfileColorId,
      exteriorColorId: defaultProfileColorId,
    }
  );
}

function createDefaultGlass(current: GlassSelection | null): GlassSelection {
  return (
    current ?? {
      glassTypeId: 'double-clear',
      formula: '4+12+4',
      thickness: 20,
      color: null,
      pattern: null,
      lowE: false,
      tempered: false,
      laminated: false,
      decorativeBar: null,
    }
  );
}

type MergeNodeResult = {
  node: DesignNode;
  changed: boolean;
};

function mergeNode(node: DesignNode, panelId: string, side: MergePanelSide): MergeNodeResult {
  if (node.type === 'panel') {
    return { node, changed: false };
  }

  if (node.type === 'frame') {
    const child = mergeNode(node.child, panelId, side);
    return {
      node: child.changed ? { ...node, child: child.node } : node,
      changed: child.changed,
    };
  }

  const direction = side === 'left' || side === 'right' ? 'vertical' : 'horizontal';
  if (node.direction === direction) {
    const groupMerge = mergeDirectionalGroup(node, panelId, side, direction);
    if (groupMerge.changed) {
      return groupMerge;
    }
  }

  const first = mergeNode(node.first, panelId, side);
  if (first.changed) {
    return { node: { ...node, first: first.node }, changed: true };
  }

  const second = mergeNode(node.second, panelId, side);
  if (second.changed) {
    return { node: { ...node, second: second.node }, changed: true };
  }

  return { node, changed: false };
}

function mergeDirectionalGroup(
  node: DesignNode,
  panelId: string,
  side: MergePanelSide,
  direction: SplitDirection,
): MergeNodeResult {
  const items = flattenDirection(node, direction);
  const selectedIndex = items.findIndex((item) => item.type === 'panel' && item.id === panelId);

  if (selectedIndex < 0) {
    return { node, changed: false };
  }

  const neighborIndex =
    side === 'left' || side === 'top' ? selectedIndex - 1 : selectedIndex + 1;
  const selected = items[selectedIndex];
  const neighbor = items[neighborIndex];

  if (selected?.type !== 'panel' || neighbor?.type !== 'panel') {
    return { node, changed: false };
  }

  const firstIndex = Math.min(selectedIndex, neighborIndex);
  const nextItems = [
    ...items.slice(0, firstIndex),
    selected,
    ...items.slice(firstIndex + 2),
  ];

  return {
    node: buildDirectionTree(direction, nextItems),
    changed: true,
  };
}

function flattenDirection(node: DesignNode, direction: SplitDirection): DesignNode[] {
  if (node.type === 'split' && node.direction === direction) {
    return [
      ...flattenDirection(node.first, direction),
      ...flattenDirection(node.second, direction),
    ];
  }

  return [node];
}

function buildDirectionTree(direction: SplitDirection, items: DesignNode[]): DesignNode {
  if (items.length <= 1) {
    return items[0]!;
  }

  const [first, ...rest] = items;
  const second = buildDirectionTree(direction, rest);
  const totalPanelCount = countPanels(first!) + countPanels(second);

  return createSplitNode({
    direction,
    first: first!,
    second,
    ratio: totalPanelCount > 0 ? countPanels(first!) / totalPanelCount : 0.5,
  });
}

type RemoveNodeResult = {
  node: DesignNode | null;
  removed: boolean;
  rebalanceDirection: SplitDirection | null;
};

function removeNode(node: DesignNode, panelId: string): RemoveNodeResult {
  if (node.type === 'panel') {
    return node.id === panelId
      ? { node: null, removed: true, rebalanceDirection: null }
      : { node, removed: false, rebalanceDirection: null };
  }

  if (node.type === 'frame') {
    const child = removeNode(node.child, panelId);
    return {
      node: child.node ? { ...node, child: child.node } : node,
      removed: child.removed,
      rebalanceDirection: null,
    };
  }

  const first = removeNode(node.first, panelId);
  const second = removeNode(node.second, panelId);

  if (first.node === null && second.node !== null) {
    return { node: second.node, removed: true, rebalanceDirection: node.direction };
  }

  if (first.node !== null && second.node === null) {
    return { node: first.node, removed: true, rebalanceDirection: node.direction };
  }

  if (first.node === null && second.node === null) {
    return {
      node,
      removed: first.removed || second.removed,
      rebalanceDirection: first.rebalanceDirection ?? second.rebalanceDirection,
    };
  }

  if (first.node === null || second.node === null) {
    return {
      node,
      removed: first.removed || second.removed,
      rebalanceDirection: first.rebalanceDirection ?? second.rebalanceDirection,
    };
  }

  const removed = first.removed || second.removed;
  const rebalanceDirection = first.rebalanceDirection ?? second.rebalanceDirection;

  return {
    node: {
      ...node,
      first: first.node,
      second: second.node,
      ratio: removed && rebalanceDirection === node.direction ? getBalancedRatio(first.node, second.node) : node.ratio,
    },
    removed,
    rebalanceDirection,
  };
}

function getBalancedRatio(first: DesignNode, second: DesignNode): number {
  const firstPanelCount = countPanels(first);
  const secondPanelCount = countPanels(second);
  const totalPanelCount = firstPanelCount + secondPanelCount;

  if (totalPanelCount <= 0) {
    return 0.5;
  }

  return firstPanelCount / totalPanelCount;
}
