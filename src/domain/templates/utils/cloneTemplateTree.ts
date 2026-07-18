import { AccessorySelection } from '../../designs/entities/AccessorySelection';
import { DesignNode } from '../../designs/entities/DesignNode';
import { createId } from '../../designs/utils/id';

function cloneAccessory(
  accessory: AccessorySelection,
  nodeIdMap: ReadonlyMap<string, string>,
): AccessorySelection {
  return {
    ...accessory,
    id: createId(),
    targetNodeId: accessory.targetNodeId ? (nodeIdMap.get(accessory.targetNodeId) ?? null) : null,
  };
}

function cloneNodeIds(node: DesignNode, nodeIdMap: Map<string, string>): DesignNode {
  const nextId = createId();
  nodeIdMap.set(node.id, nextId);

  if (node.type === 'frame') {
    return { ...node, id: nextId, child: cloneNodeIds(node.child, nodeIdMap) };
  }

  if (node.type === 'split') {
    return {
      ...node,
      id: nextId,
      first: cloneNodeIds(node.first, nodeIdMap),
      second: cloneNodeIds(node.second, nodeIdMap),
    };
  }

  return { ...node, id: nextId, accessories: [] };
}

function remapAccessories(
  cloned: DesignNode,
  original: DesignNode,
  nodeIdMap: Map<string, string>,
): DesignNode {
  if (cloned.type === 'frame' && original.type === 'frame') {
    return { ...cloned, child: remapAccessories(cloned.child, original.child, nodeIdMap) };
  }

  if (cloned.type === 'split' && original.type === 'split') {
    return {
      ...cloned,
      first: remapAccessories(cloned.first, original.first, nodeIdMap),
      second: remapAccessories(cloned.second, original.second, nodeIdMap),
    };
  }

  if (cloned.type === 'panel' && original.type === 'panel') {
    return {
      ...cloned,
      accessories: original.accessories.map((accessory) => cloneAccessory(accessory, nodeIdMap)),
    };
  }

  return cloned;
}

export function cloneTemplateTree(rootNode: DesignNode): DesignNode {
  const nodeIdMap = new Map<string, string>();
  const cloned = cloneNodeIds(rootNode, nodeIdMap);
  return remapAccessories(cloned, rootNode, nodeIdMap);
}
