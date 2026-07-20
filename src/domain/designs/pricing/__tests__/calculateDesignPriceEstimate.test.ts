import { describe, expect, it } from 'vitest';

import { createEmptyDesignProject } from '../../factories/createEmptyDesignProject';
import { createPanelNode } from '../../factories/createPanelNode';
import { createSplitNode } from '../../factories/createSplitNode';
import { calculateDesignPriceEstimate } from '../calculateDesignPriceEstimate';

describe('calculateDesignPriceEstimate', () => {
  it('estimates a design total from profile, glass, hardware and quantity', () => {
    const first = createPanelNode();
    const second = { ...createPanelNode(), openingType: 'open-right' as const };
    const project = {
      ...createEmptyDesignProject({ name: 'Price', width: 1600, height: 1400, quantity: 2 }),
      rootNode: {
        id: 'price-frame',
        type: 'frame' as const,
        child: createSplitNode({
          direction: 'vertical',
          first,
          second,
        }),
      },
    };

    const estimate = calculateDesignPriceEstimate(project, {
      profileMeterPrice: 100,
      glassSquareMeterPrice: 200,
      openingPanelPrice: 300,
      fixedPanelPrice: 50,
      archSurcharge: 500,
    });

    expect(estimate.profileLengthMeters).toBeGreaterThan(0);
    expect(estimate.glassAreaSquareMeters).toBeGreaterThan(0);
    expect(estimate.hardwareSubtotal).toBe(350);
    expect(estimate.archSubtotal).toBe(0);
    expect(estimate.total).toBe(estimate.unitTotal * 2);
  });

  it('applies color multiplier and arch surcharge', () => {
    const project = {
      ...createEmptyDesignProject({ name: 'Arch price', width: 1000, height: 1000 }),
      profileSystem: {
        brandId: 'sample-brand-a',
        seriesId: 'standard-70',
        profileWidth: 70,
        chamberCount: 5,
        wallClass: 'B' as const,
        gasketCount: 2,
        gasketColor: null,
        steelThickness: null,
        interiorColorId: 'black',
        exteriorColorId: 'black',
      },
      rootNode: {
        ...createEmptyDesignProject({ name: 'Arch child' }).rootNode,
        shape: { type: 'arch-top' as const, archHeight: 350 },
      },
    };

    const estimate = calculateDesignPriceEstimate(project);

    expect(estimate.colorMultiplier).toBeGreaterThan(1);
    expect(estimate.archSubtotal).toBeGreaterThan(0);
  });
});
