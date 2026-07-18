import { describe, expect, it } from 'vitest';

import { DesignNode } from '../../entities/DesignNode';
import { createPanelNode } from '../../factories/createPanelNode';
import { createSplitNode } from '../../factories/createSplitNode';
import { getPanelRealDimensions } from '../../utils/getPanelDimensions';
import { calculateDesignLayout, DesignLayoutError } from '../calculateDesignLayout';

function frame(child: DesignNode): DesignNode {
  return { id: 'frame', type: 'frame', child };
}

function layout(rootNode: DesignNode, designWidth = 1000, designHeight = 1000) {
  return calculateDesignLayout({
    rootNode,
    designWidth,
    designHeight,
    canvasWidth: 1200,
    canvasHeight: 900,
    padding: 50,
  });
}

describe('calculateDesignLayout', () => {
  it('places a single panel across the full frame area', () => {
    const rootNode = frame(createPanelNode());
    const result = layout(rootNode);
    const panel = result.panelBounds[0]!;

    expect(result.panelBounds).toHaveLength(1);
    expect(panel.x).toBeCloseTo(result.frameBounds.x);
    expect(panel.y).toBeCloseTo(result.frameBounds.y);
    expect(panel.width).toBeCloseTo(result.frameBounds.width);
    expect(panel.height).toBeCloseTo(result.frameBounds.height);
  });

  it('calculates 50/50 vertical split with equal widths', () => {
    const rootNode = frame(
      createSplitNode({ direction: 'vertical', first: createPanelNode(), second: createPanelNode() }),
    );
    const result = layout(rootNode);

    expect(result.panelBounds[0]?.width).toBeCloseTo(result.panelBounds[1]!.width);
    expect(result.panelBounds[0]?.realWidth).toBeCloseTo(500);
    expect(result.panelBounds[1]?.realWidth).toBeCloseTo(500);
  });

  it('calculates 40/60 vertical split dimensions', () => {
    const rootNode = frame(
      createSplitNode({
        direction: 'vertical',
        ratio: 0.4,
        first: createPanelNode(),
        second: createPanelNode(),
      }),
    );
    const result = layout(rootNode, 1700, 1400);

    expect(result.panelBounds[0]?.realWidth).toBeCloseTo(680);
    expect(result.panelBounds[1]?.realWidth).toBeCloseTo(1020);
  });

  it('calculates 30/70 horizontal split dimensions', () => {
    const rootNode = frame(
      createSplitNode({
        direction: 'horizontal',
        ratio: 0.3,
        first: createPanelNode(),
        second: createPanelNode(),
      }),
    );
    const result = layout(rootNode, 1000, 1500);

    expect(result.panelBounds[0]?.realHeight).toBeCloseTo(450);
    expect(result.panelBounds[1]?.realHeight).toBeCloseTo(1050);
  });

  it('calculates three nested vertical panels', () => {
    const rootNode = frame(
      createSplitNode({
        direction: 'vertical',
        ratio: 1 / 3,
        first: createPanelNode(),
        second: createSplitNode({
          direction: 'vertical',
          ratio: 0.5,
          first: createPanelNode(),
          second: createPanelNode(),
        }),
      }),
    );
    const result = layout(rootNode, 1800, 1200);

    expect(result.panelBounds).toHaveLength(3);
    expect(result.panelBounds.map((panel) => Math.round(panel.realWidth))).toEqual([600, 600, 600]);
  });

  it('calculates four nested panels', () => {
    const rootNode = frame(
      createSplitNode({
        direction: 'vertical',
        first: createSplitNode({
          direction: 'horizontal',
          first: createPanelNode(),
          second: createPanelNode(),
        }),
        second: createSplitNode({
          direction: 'horizontal',
          first: createPanelNode(),
          second: createPanelNode(),
        }),
      }),
    );

    expect(layout(rootNode).panelBounds).toHaveLength(4);
  });

  it('keeps panel bounds inside frame bounds', () => {
    const rootNode = frame(
      createSplitNode({
        direction: 'horizontal',
        ratio: 0.35,
        first: createPanelNode(),
        second: createSplitNode({
          direction: 'vertical',
          ratio: 0.45,
          first: createPanelNode(),
          second: createPanelNode(),
        }),
      }),
    );
    const result = layout(rootNode);

    expect(
      result.panelBounds.every(
        (panel) =>
          panel.x >= result.frameBounds.x &&
          panel.y >= result.frameBounds.y &&
          panel.x + panel.width <= result.frameBounds.x + result.frameBounds.width + 0.001 &&
          panel.y + panel.height <= result.frameBounds.y + result.frameBounds.height + 0.001,
      ),
    ).toBe(true);
  });

  it('preserves aspect ratio while fitting horizontal and vertical designs', () => {
    const rootNode = frame(createPanelNode());
    const horizontal = calculateDesignLayout({
      rootNode,
      designWidth: 2400,
      designHeight: 900,
      canvasWidth: 500,
      canvasHeight: 700,
      padding: 40,
    });
    const vertical = calculateDesignLayout({
      rootNode,
      designWidth: 700,
      designHeight: 2100,
      canvasWidth: 500,
      canvasHeight: 700,
      padding: 40,
    });

    expect(horizontal.frameBounds.width / horizontal.frameBounds.height).toBeCloseTo(2400 / 900);
    expect(vertical.frameBounds.width / vertical.frameBounds.height).toBeCloseTo(700 / 2100);
    expect(horizontal.frameBounds.width).toBeLessThanOrEqual(420);
    expect(vertical.frameBounds.height).toBeLessThanOrEqual(620);
  });

  it('returns real panel dimensions by panel id', () => {
    const first = createPanelNode();
    const second = createPanelNode();
    const rootNode = frame(
      createSplitNode({ direction: 'vertical', ratio: 0.4, first, second }),
    );

    expect(
      getPanelRealDimensions({
        rootNode,
        panelId: first.id,
        designWidth: 1700,
        designHeight: 1400,
      }),
    ).toEqual({ width: 680, height: 1400 });
  });

  it('rejects invalid ratio and excessive recursion', () => {
    const invalidRatio = frame(
      createSplitNode({
        direction: 'vertical',
        ratio: 1,
        first: createPanelNode(),
        second: createPanelNode(),
      }),
    );
    let deepNode: DesignNode = createPanelNode();
    for (let index = 0; index < 55; index += 1) {
      deepNode = { id: `frame-${index}`, type: 'frame', child: deepNode };
    }

    expect(() => layout(invalidRatio)).toThrow(DesignLayoutError);
    expect(() => layout(deepNode)).toThrow(DesignLayoutError);
  });
});
