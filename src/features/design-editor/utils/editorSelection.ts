import { DesignNode } from '../../../domain/designs/entities/DesignNode';
import { findNodeById } from '../../../domain/designs/utils/findNodeById';
import { EditorSelection } from '../types/editorTypes';

export function selectPanel(rootNode: DesignNode, panelId: string): EditorSelection {
  const node = findNodeById(rootNode, panelId);

  if (node?.type !== 'panel') {
    return null;
  }

  return { nodeId: panelId, nodeType: 'panel' };
}

export function clearSelection(): EditorSelection {
  return null;
}
