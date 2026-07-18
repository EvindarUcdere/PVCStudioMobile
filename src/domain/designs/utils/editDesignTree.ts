import { DesignNode } from '../entities/DesignNode';
import { DesignProject } from '../entities/DesignProject';
import { PanelNode } from '../entities/PanelNode';
import { ProfileSystemSelection } from '../entities/ProfileSystemSelection';
import { OpeningType } from '../enums/OpeningType';
import { SplitDirection } from '../enums/SplitDirection';
import { defaultProfileColorId } from '../colors/profileColorOptions';
import { createPanelNode } from '../factories/createPanelNode';
import { createSplitNode } from '../factories/createSplitNode';
import { countPanels } from './findNodeById';
import { getArchHeight, isArchTopFrame, withArchHeight } from './frameShape';
import { getPanelRealDimensions } from './getPanelDimensions';

export type AddPanelSide = 'left' | 'right' | 'top' | 'bottom';

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
