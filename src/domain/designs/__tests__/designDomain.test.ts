import { describe, expect, it } from 'vitest';

import { createEmptyDesignProject } from '../factories/createEmptyDesignProject';
import { createPanelNode } from '../factories/createPanelNode';
import { createSplitNode } from '../factories/createSplitNode';
import { validateDesignTree } from '../rules/validateDesignTree';
import { designProjectSchema } from '../schemas/designProjectSchema';
import { designNodeSchema } from '../schemas/designNodeSchema';
import { cloneDesignProject } from '../utils/cloneDesignProject';
import {
  addPanelToDesignEdge,
  adjustArchHeight,
  mergePanelWithAdjacent,
  removePanel,
  splitPanel,
  updatePanelOpening,
  updateProfileColor,
} from '../utils/editDesignTree';
import { collectNodeIds, collectPanels, countPanels } from '../utils/findNodeById';

describe('design domain factories', () => {
  it('creates an empty design with a root frame and fixed panel', () => {
    const project = createEmptyDesignProject({
      name: 'Salon Penceresi',
      width: 1700,
      height: 1400,
      quantity: 1,
    });

    expect(project.rootNode.type).toBe('frame');
    if (project.rootNode.type !== 'frame') {
      throw new Error('Expected root frame');
    }

    expect(project.rootNode.child.type).toBe('panel');

    if (project.rootNode.child.type === 'panel') {
      expect(project.rootNode.child.openingType).toBe('fixed');
    }

    expect(countPanels(project.rootNode)).toBe(1);
  });

  it('creates unique node ids', () => {
    const first = createPanelNode();
    const second = createPanelNode();
    const split = createSplitNode({ direction: 'vertical', first, second });
    const ids = collectNodeIds(split);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('validates a split with the default ratio', () => {
    const split = createSplitNode({
      direction: 'horizontal',
      first: createPanelNode(),
      second: createPanelNode(),
    });

    expect(split.ratio).toBe(0.5);
    expect(validateDesignTree({ id: 'root', type: 'frame', child: split }).isValid).toBe(true);
  });
});

describe('design tree validation', () => {
  it('rejects invalid split ratio', () => {
    const split = createSplitNode({
      direction: 'vertical',
      first: createPanelNode(),
      second: createPanelNode(),
      ratio: 1,
    });

    const result = validateDesignTree({ id: 'root', type: 'frame', child: split });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.includes('ratio'))).toBe(true);
  });

  it('detects duplicate node ids', () => {
    const first = createPanelNode();
    const second = { ...createPanelNode(), id: first.id };
    const split = createSplitNode({ direction: 'vertical', first, second });

    const result = validateDesignTree({ id: 'root', type: 'frame', child: split });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.includes('Duplicate node id'))).toBe(true);
  });

  it('accepts a valid tree and rejects a broken root', () => {
    const project = createEmptyDesignProject({ name: 'Valid' });

    expect(validateDesignTree(project.rootNode).isValid).toBe(true);
    expect(validateDesignTree(createPanelNode()).isValid).toBe(false);
  });
});

describe('design project clone', () => {
  it('renews project and node ids without mutating the original', () => {
    const original = createEmptyDesignProject({ name: 'Salon Penceresi' });
    const originalIds = collectNodeIds(original.rootNode);

    const copy = cloneDesignProject(original);
    const copiedIds = collectNodeIds(copy.rootNode);

    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe('Salon Penceresi - Kopya');
    expect(copy.version).toBe(1);
    expect(copy.deletedAt).toBeNull();
    expect(copiedIds.every((id) => !originalIds.includes(id))).toBe(true);
    expect(original.name).toBe('Salon Penceresi');
    expect(collectNodeIds(original.rootNode)).toEqual(originalIds);
  });

  it('remaps panel accessory target ids', () => {
    const original = createEmptyDesignProject({ name: 'Aksesuarli' });
    const originalPanel = collectPanels(original.rootNode)[0];

    if (!originalPanel) {
      throw new Error('Expected a panel');
    }

    const projectWithAccessory = {
      ...original,
      rootNode: {
        ...original.rootNode,
        child: {
          ...originalPanel,
          accessories: [
            {
              id: 'accessory-1',
              accessoryTypeId: 'standard-handle',
              scope: 'panel' as const,
              targetNodeId: originalPanel.id,
              quantity: 1,
              notes: null,
            },
          ],
        },
      },
    };

    const copy = cloneDesignProject(projectWithAccessory);
    const copiedPanel = collectPanels(copy.rootNode)[0];

    expect(copiedPanel).toBeDefined();
    expect(copiedPanel?.id).not.toBe(originalPanel.id);
    expect(copiedPanel?.accessories[0]?.targetNodeId).toBe(copiedPanel?.id);
    expect(copiedPanel?.accessories[0]?.id).not.toBe('accessory-1');
  });
});

describe('design tree editing', () => {
  it('splits a selected panel and keeps the tree valid', () => {
    const project = createEmptyDesignProject({ name: 'Editor' });
    const panel = collectPanels(project.rootNode)[0];

    if (!panel) {
      throw new Error('Expected a panel');
    }

    const nextRoot = splitPanel(project.rootNode, panel.id, 'vertical');

    expect(countPanels(nextRoot)).toBe(2);
    expect(validateDesignTree(nextRoot).isValid).toBe(true);
  });

  it('updates panel opening type', () => {
    const project = createEmptyDesignProject({ name: 'Opening' });
    const panel = collectPanels(project.rootNode)[0];

    if (!panel) {
      throw new Error('Expected a panel');
    }

    const nextRoot = updatePanelOpening(project.rootNode, panel.id, 'open-right');
    const updatedPanel = collectPanels(nextRoot).find((item) => item.id === panel.id);

    expect(updatedPanel?.openingType).toBe('open-right');
  });

  it('removes a selected panel by promoting its sibling', () => {
    const project = createEmptyDesignProject({ name: 'Remove' });
    const panel = collectPanels(project.rootNode)[0];

    if (!panel) {
      throw new Error('Expected a panel');
    }

    const splitRoot = splitPanel(project.rootNode, panel.id, 'horizontal');
    const secondPanel = collectPanels(splitRoot).find((item) => item.id !== panel.id);

    if (!secondPanel) {
      throw new Error('Expected a second panel');
    }

    const nextRoot = removePanel(splitRoot, secondPanel.id);

    expect(countPanels(nextRoot)).toBe(1);
    expect(validateDesignTree(nextRoot).isValid).toBe(true);
  });

  it('rebalances remaining sibling panels after removing the middle panel from a triple split', () => {
    const left = createPanelNode();
    const middle = createPanelNode();
    const right = createPanelNode();
    const rootNode = {
      id: 'triple-frame',
      type: 'frame' as const,
      child: createSplitNode({
        direction: 'vertical',
        ratio: 1 / 3,
        first: left,
        second: createSplitNode({
          direction: 'vertical',
          ratio: 0.5,
          first: middle,
          second: right,
        }),
      }),
    };

    const nextRoot = removePanel(rootNode, middle.id);

    expect(countPanels(nextRoot)).toBe(2);
    expect(validateDesignTree(nextRoot).isValid).toBe(true);

    if (nextRoot.type !== 'frame' || nextRoot.child.type !== 'split') {
      throw new Error('Expected a frame with a split child');
    }

    expect(nextRoot.child.ratio).toBe(0.5);
  });

  it('keeps the parent height ratio when removing a panel inside one horizontal row', () => {
    const topLeft = createPanelNode();
    const topMiddle = createPanelNode();
    const topRight = createPanelNode();
    const bottomLeft = createPanelNode();
    const bottomRight = createPanelNode();
    const rootNode = {
      id: 'two-row-frame',
      type: 'frame' as const,
      child: createSplitNode({
        direction: 'horizontal',
        ratio: 0.38,
        first: createSplitNode({
          direction: 'vertical',
          ratio: 1 / 3,
          first: topLeft,
          second: createSplitNode({
            direction: 'vertical',
            ratio: 0.5,
            first: topMiddle,
            second: topRight,
          }),
        }),
        second: createSplitNode({
          direction: 'vertical',
          ratio: 0.5,
          first: bottomLeft,
          second: bottomRight,
        }),
      }),
    };

    const nextRoot = removePanel(rootNode, topMiddle.id);

    expect(validateDesignTree(nextRoot).isValid).toBe(true);
    if (nextRoot.type !== 'frame' || nextRoot.child.type !== 'split') {
      throw new Error('Expected a frame with a split child');
    }

    expect(nextRoot.child.ratio).toBe(0.38);
    expect(nextRoot.child.first.type).toBe('split');
    if (nextRoot.child.first.type === 'split') {
      expect(nextRoot.child.first.ratio).toBe(0.5);
    }
  });

  it('merges the selected middle panel with its right neighbor', () => {
    const left = createPanelNode();
    const middle = createPanelNode();
    const right = createPanelNode();
    const rootNode = {
      id: 'merge-right-frame',
      type: 'frame' as const,
      child: createSplitNode({
        direction: 'vertical',
        ratio: 1 / 3,
        first: left,
        second: createSplitNode({
          direction: 'vertical',
          ratio: 0.5,
          first: middle,
          second: right,
        }),
      }),
    };

    const nextRoot = mergePanelWithAdjacent(rootNode, middle.id, 'right');

    expect(countPanels(nextRoot)).toBe(2);
    expect(validateDesignTree(nextRoot).isValid).toBe(true);
    expect(collectPanels(nextRoot).some((panel) => panel.id === middle.id)).toBe(true);
    expect(collectPanels(nextRoot).some((panel) => panel.id === right.id)).toBe(false);
  });

  it('merges the selected middle panel with its left neighbor without changing the parent row height', () => {
    const topLeft = createPanelNode();
    const topMiddle = createPanelNode();
    const topRight = createPanelNode();
    const bottom = createPanelNode();
    const rootNode = {
      id: 'merge-left-frame',
      type: 'frame' as const,
      child: createSplitNode({
        direction: 'horizontal',
        ratio: 0.4,
        first: createSplitNode({
          direction: 'vertical',
          ratio: 1 / 3,
          first: topLeft,
          second: createSplitNode({
            direction: 'vertical',
            ratio: 0.5,
            first: topMiddle,
            second: topRight,
          }),
        }),
        second: bottom,
      }),
    };

    const nextRoot = mergePanelWithAdjacent(rootNode, topMiddle.id, 'left');

    expect(countPanels(nextRoot)).toBe(3);
    expect(validateDesignTree(nextRoot).isValid).toBe(true);
    if (nextRoot.type !== 'frame' || nextRoot.child.type !== 'split') {
      throw new Error('Expected a frame with a split child');
    }

    expect(nextRoot.child.ratio).toBe(0.4);
    expect(collectPanels(nextRoot).some((panel) => panel.id === topMiddle.id)).toBe(true);
    expect(collectPanels(nextRoot).some((panel) => panel.id === topLeft.id)).toBe(false);
  });

  it('adds a new panel to the design right edge without shrinking the project width', () => {
    const project = createEmptyDesignProject({ name: 'Add right', width: 1000, height: 1200 });
    const panel = collectPanels(project.rootNode)[0];

    if (!panel) {
      throw new Error('Expected a panel');
    }

    const nextProject = addPanelToDesignEdge(project, panel.id, 'right');

    expect(nextProject.width).toBe(2000);
    expect(nextProject.height).toBe(1200);
    expect(countPanels(nextProject.rootNode)).toBe(2);
    expect(validateDesignTree(nextProject.rootNode).isValid).toBe(true);
  });

  it('adds a new panel to the design bottom edge and grows height', () => {
    const project = createEmptyDesignProject({ name: 'Add bottom', width: 1000, height: 900 });
    const panel = collectPanels(project.rootNode)[0];

    if (!panel) {
      throw new Error('Expected a panel');
    }

    const nextProject = addPanelToDesignEdge(project, panel.id, 'bottom');

    expect(nextProject.width).toBe(1000);
    expect(nextProject.height).toBe(1800);
    expect(countPanels(nextProject.rootNode)).toBe(2);
    expect(validateDesignTree(nextProject.rootNode).isValid).toBe(true);
  });

  it('adjusts arch height for arched frame designs', () => {
    const project = {
      ...createEmptyDesignProject({ name: 'Arch', width: 1800, height: 1800 }),
      rootNode: {
        ...createEmptyDesignProject({ name: 'Arch child' }).rootNode,
        shape: { type: 'arch-top' as const, archHeight: 520 },
      },
    };

    const nextProject = adjustArchHeight(project, 50);

    expect(nextProject.rootNode.type).toBe('frame');
    if (nextProject.rootNode.type === 'frame' && typeof nextProject.rootNode.shape === 'object') {
      expect(nextProject.rootNode.shape.archHeight).toBe(570);
    }
    expect(validateDesignTree(nextProject.rootNode).isValid).toBe(true);
  });

  it('updates profile colors and creates a default profile selection when needed', () => {
    const project = createEmptyDesignProject({ name: 'Color' });

    const nextProject = updateProfileColor(project, 'black');

    expect(nextProject.profileSystem?.seriesId).toBe('standard-70');
    expect(nextProject.profileSystem?.interiorColorId).toBe('black');
    expect(nextProject.profileSystem?.exteriorColorId).toBe('black');
    expect(() => designProjectSchema.parse(nextProject)).not.toThrow();
  });
});

describe('design zod schemas', () => {
  it('accepts a valid design project', () => {
    const project = createEmptyDesignProject({ name: 'Valid' });

    expect(() => designProjectSchema.parse(project)).not.toThrow();
  });

  it('rejects invalid dimensions and quantity', () => {
    const project = createEmptyDesignProject({ name: 'Invalid' });

    expect(() => designProjectSchema.parse({ ...project, width: -1 })).toThrow();
    expect(() => designProjectSchema.parse({ ...project, height: 0 })).toThrow();
    expect(() => designProjectSchema.parse({ ...project, quantity: 0 })).toThrow();
  });

  it('rejects invalid opening type and invalid json shape', () => {
    const panel = createPanelNode();

    expect(() => designNodeSchema.parse({ ...panel, openingType: 'sideways' })).toThrow();
    expect(() => designNodeSchema.parse({ type: 'split', ratio: 0.5 })).toThrow();
  });
});
