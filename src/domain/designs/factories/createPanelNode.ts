import { PanelNode } from '../entities/PanelNode';
import { createId } from '../utils/id';

export function createPanelNode(): PanelNode {
  return {
    id: createId(),
    type: 'panel',
    openingType: 'fixed',
    glass: null,
    accessories: [],
    notes: null,
  };
}
