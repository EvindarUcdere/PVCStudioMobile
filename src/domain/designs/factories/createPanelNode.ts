import { PanelNode } from '../entities/PanelNode';
import { GlassSelection } from '../entities/GlassSelection';
import { createId } from '../utils/id';

export function createPanelNode(options: { glass?: GlassSelection | null } = {}): PanelNode {
  return {
    id: createId(),
    type: 'panel',
    openingType: 'fixed',
    insectScreen: null,
    glass: options.glass ?? null,
    accessories: [],
    notes: null,
  };
}
