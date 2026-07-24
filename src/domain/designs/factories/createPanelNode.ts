import { PanelNode } from '../entities/PanelNode';
import { createId } from '../utils/id';

export function createPanelNode(): PanelNode {
  return {
    id: createId(),
    type: 'panel',
    openingType: 'fixed',
    insectScreen: null,
    glass: null,
    accessories: [],
    notes: null,
  };
}
