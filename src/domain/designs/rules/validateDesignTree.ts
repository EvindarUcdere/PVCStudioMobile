import { AccessorySelection } from '../entities/AccessorySelection';
import { DesignNode } from '../entities/DesignNode';
import { openingTypes } from '../enums/OpeningType';

export type ValidationResult = {
  isValid: boolean;
  errors: string[];
};

function validatePanelAccessories(
  panelId: string,
  accessories: AccessorySelection[],
  errors: string[],
): void {
  for (const accessory of accessories) {
    if (accessory.quantity <= 0 || !Number.isInteger(accessory.quantity)) {
      errors.push(`Accessory ${accessory.id} quantity must be a positive integer.`);
    }

    if (accessory.scope === 'panel' && accessory.targetNodeId !== panelId) {
      errors.push(`Panel accessory ${accessory.id} must target panel ${panelId}.`);
    }

    if (accessory.scope === 'design' && accessory.targetNodeId !== null) {
      errors.push(`Design accessory ${accessory.id} cannot target a panel.`);
    }
  }
}

export function validateDesignTree(rootNode: DesignNode): ValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();
  const visiting = new Set<string>();

  if (rootNode.type !== 'frame') {
    errors.push('Root node must be a frame.');
  }

  function visit(node: DesignNode | null | undefined): void {
    if (!node) {
      errors.push('Design tree contains an empty node.');
      return;
    }

    if (visiting.has(node.id)) {
      errors.push(`Design tree contains a cycle at node ${node.id}.`);
      return;
    }

    if (ids.has(node.id)) {
      errors.push(`Duplicate node id found: ${node.id}.`);
      return;
    }

    ids.add(node.id);
    visiting.add(node.id);

    if (node.type === 'frame') {
      if (!node.child) {
        errors.push(`Frame node ${node.id} must have a child.`);
      } else {
        visit(node.child);
      }
    } else if (node.type === 'split') {
      if (node.ratio < 0.05 || node.ratio > 0.95) {
        errors.push(`Split node ${node.id} ratio must be between 0.05 and 0.95.`);
      }

      visit(node.first);
      visit(node.second);
    } else if (node.type === 'panel') {
      if (!openingTypes.includes(node.openingType)) {
        errors.push(`Panel node ${node.id} has an invalid opening type.`);
      }

      validatePanelAccessories(node.id, node.accessories, errors);
    } else {
      errors.push('Design tree contains an unknown node type.');
    }

    visiting.delete(node.id);
  }

  visit(rootNode);

  return {
    isValid: errors.length === 0,
    errors,
  };
}
