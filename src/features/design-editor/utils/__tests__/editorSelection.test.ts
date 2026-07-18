import { describe, expect, it } from 'vitest';

import { createPanelNode } from '../../../../domain/designs/factories/createPanelNode';
import { createSplitNode } from '../../../../domain/designs/factories/createSplitNode';
import { clearSelection, selectPanel } from '../editorSelection';

describe('editor selection', () => {
  it('starts and clears as null', () => {
    expect(clearSelection()).toBeNull();
  });

  it('selects a panel by id', () => {
    const panel = createPanelNode();
    const rootNode = { id: 'frame', type: 'frame' as const, child: panel };

    expect(selectPanel(rootNode, panel.id)).toEqual({ nodeId: panel.id, nodeType: 'panel' });
  });

  it('changes selection when another panel is selected', () => {
    const first = createPanelNode();
    const second = createPanelNode();
    const rootNode = {
      id: 'frame',
      type: 'frame' as const,
      child: createSplitNode({ direction: 'vertical', first, second }),
    };

    expect(selectPanel(rootNode, first.id)?.nodeId).toBe(first.id);
    expect(selectPanel(rootNode, second.id)?.nodeId).toBe(second.id);
  });

  it('does not select missing or non-panel nodes', () => {
    const first = createPanelNode();
    const second = createPanelNode();
    const split = createSplitNode({ direction: 'vertical', first, second });
    const rootNode = { id: 'frame', type: 'frame' as const, child: split };

    expect(selectPanel(rootNode, 'missing')).toBeNull();
    expect(selectPanel(rootNode, split.id)).toBeNull();
  });
});
