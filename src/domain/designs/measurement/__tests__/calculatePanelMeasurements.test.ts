import { describe, expect, it } from 'vitest';

import { createEmptyDesignProject } from '../../factories/createEmptyDesignProject';
import { createPanelNode } from '../../factories/createPanelNode';
import { createSplitNode } from '../../factories/createSplitNode';
import { collectPanels } from '../../utils/findNodeById';
import { calculateDesignMaterialSummary } from '../calculateDesignMaterialSummary';
import { calculatePanelMeasurements } from '../calculatePanelMeasurements';

describe('calculatePanelMeasurements', () => {
  it('calculates frame-aware glass size for a fixed panel', () => {
    const project = createEmptyDesignProject({ name: 'Fixed', width: 1000, height: 1000 });
    const panel = collectPanels(project.rootNode)[0]!;
    const measurements = calculatePanelMeasurements(project, panel.id, 'fixed');

    expect(measurements?.profile.frameWidth).toBe(70);
    expect(measurements?.panelWidth).toBe(1000);
    expect(measurements?.sashClearWidth).toBe(860);
    expect(measurements?.glassWidth).toBe(824);
    expect(measurements?.estimatedCutWidth).toBe(1006);
    expect(measurements?.usesSash).toBe(false);
  });

  it('uses selected profile width and sash allowance for opening panels', () => {
    const project = {
      ...createEmptyDesignProject({ name: 'Opening', width: 1200, height: 1400 }),
      profileSystem: {
        brandId: 'brand',
        seriesId: 'premium-80',
        profileWidth: 80,
        chamberCount: 6,
        wallClass: 'A' as const,
        gasketCount: 3,
        gasketColor: null,
        steelThickness: null,
        interiorColorId: 'white',
        exteriorColorId: 'white',
      },
    };
    const panel = collectPanels(project.rootNode)[0]!;
    const measurements = calculatePanelMeasurements(project, panel.id, 'open-right');

    expect(measurements?.profile.frameWidth).toBe(80);
    expect(measurements?.profile.sashWidth).toBe(70);
    expect(measurements?.sashClearWidth).toBe(1040);
    expect(measurements?.glassWidth).toBe(864);
    expect(measurements?.estimatedCutWidth).toBe(1206);
    expect(measurements?.usesSash).toBe(true);
  });

  it('summarizes design material counts and selected profile color', () => {
    const first = createPanelNode();
    const second = { ...createPanelNode(), openingType: 'open-right' as const };
    const project = {
      ...createEmptyDesignProject({ name: 'Summary', width: 1600, height: 1400, quantity: 2 }),
      profileSystem: {
        brandId: 'sample-brand-a',
        seriesId: 'standard-70',
        profileWidth: 70,
        chamberCount: 5,
        wallClass: 'B' as const,
        gasketCount: 2,
        gasketColor: null,
        steelThickness: null,
        interiorColorId: 'walnut',
        exteriorColorId: 'walnut',
      },
      rootNode: {
        id: 'summary-frame',
        type: 'frame' as const,
        shape: { type: 'arch-top' as const, archHeight: 420 },
        child: createSplitNode({
          direction: 'vertical',
          first,
          second,
        }),
      },
    };

    const summary = calculateDesignMaterialSummary(project);

    expect(summary.panelCount).toBe(2);
    expect(summary.glassCount).toBe(2);
    expect(summary.fixedPanelCount).toBe(1);
    expect(summary.openingPanelCount).toBe(1);
    expect(summary.profileColorName).toBe('Ceviz');
    expect(summary.archHeight).toBe(420);
  });
});
