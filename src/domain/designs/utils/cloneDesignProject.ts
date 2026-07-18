import { AccessorySelection } from '../entities/AccessorySelection';
import { DesignNode } from '../entities/DesignNode';
import { DesignProject } from '../entities/DesignProject';
import { createIsoTimestamp } from './date';
import { createId } from './id';

function cloneAccessory(
  accessory: AccessorySelection,
  nodeIdMap: ReadonlyMap<string, string>,
): AccessorySelection {
  const mappedTarget =
    accessory.targetNodeId === null ? null : (nodeIdMap.get(accessory.targetNodeId) ?? null);

  return {
    ...accessory,
    id: createId(),
    targetNodeId: mappedTarget,
  };
}

function cloneNode(node: DesignNode, nodeIdMap: Map<string, string>): DesignNode {
  const newId = createId();
  nodeIdMap.set(node.id, newId);

  if (node.type === 'frame') {
    return {
      ...node,
      id: newId,
      child: cloneNode(node.child, nodeIdMap),
    };
  }

  if (node.type === 'split') {
    return {
      ...node,
      id: newId,
      first: cloneNode(node.first, nodeIdMap),
      second: cloneNode(node.second, nodeIdMap),
    };
  }

  return {
    ...node,
    id: newId,
    accessories: [],
  };
}

function remapPanelAccessories(
  node: DesignNode,
  originalNode: DesignNode,
  nodeIdMap: Map<string, string>,
): DesignNode {
  if (node.type === 'frame' && originalNode.type === 'frame') {
    return {
      ...node,
      child: remapPanelAccessories(node.child, originalNode.child, nodeIdMap),
    };
  }

  if (node.type === 'split' && originalNode.type === 'split') {
    return {
      ...node,
      first: remapPanelAccessories(node.first, originalNode.first, nodeIdMap),
      second: remapPanelAccessories(node.second, originalNode.second, nodeIdMap),
    };
  }

  if (node.type === 'panel' && originalNode.type === 'panel') {
    return {
      ...node,
      accessories: originalNode.accessories.map((accessory) =>
        cloneAccessory(accessory, nodeIdMap),
      ),
    };
  }

  return node;
}

export function cloneDesignProject(project: DesignProject, newName?: string): DesignProject {
  const nodeIdMap = new Map<string, string>();
  const clonedNodeWithoutAccessories = cloneNode(project.rootNode, nodeIdMap);
  const rootNode = remapPanelAccessories(clonedNodeWithoutAccessories, project.rootNode, nodeIdMap);
  const now = createIsoTimestamp();

  return {
    ...project,
    id: createId(),
    name: newName ?? `${project.name} - Kopya`,
    rootNode,
    accessories: project.accessories.map((accessory) => cloneAccessory(accessory, nodeIdMap)),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local',
    version: 1,
  };
}
