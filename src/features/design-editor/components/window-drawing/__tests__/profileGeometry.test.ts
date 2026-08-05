import { describe, expect, it } from 'vitest';

import {
  createReferenceWindowGeometry,
  defaultFrameProfile,
  defaultMullionProfile,
  insetRect,
} from '../profileGeometry';

describe('reference PVC window geometry', () => {
  it('calculates module area from frame inner opening', () => {
    const geometry = createReferenceWindowGeometry(320, 320);

    expect(geometry.frameInner).toEqual(insetRect(geometry.frameOuter, defaultFrameProfile.faceWidthMm));
    expect(geometry.moduleArea.x).toBeGreaterThan(geometry.frameInner.x);
    expect(geometry.moduleArea.y).toBeGreaterThan(geometry.frameInner.y);
  });

  it('subtracts real T mullion width before splitting modules', () => {
    const geometry = createReferenceWindowGeometry(320, 320);
    const moduleTotal = geometry.leftModule.width + geometry.mullion.width + geometry.rightModule.width;

    expect(geometry.mullion.width).toBe(defaultMullionProfile.faceWidthMm);
    expect(moduleTotal).toBe(geometry.moduleArea.width);
    expect(geometry.leftModule.x + geometry.leftModule.width).toBe(geometry.mullion.x);
    expect(geometry.mullion.x + geometry.mullion.width).toBe(geometry.rightModule.x);
  });

  it('keeps fixed glass and sash glass inside their own modules', () => {
    const geometry = createReferenceWindowGeometry(320, 320);

    expect(geometry.leftGlass.x).toBeGreaterThan(geometry.leftModule.x);
    expect(geometry.leftGlass.x + geometry.leftGlass.width).toBeLessThan(
      geometry.leftModule.x + geometry.leftModule.width,
    );
    expect(geometry.rightSashOuter.x).toBeGreaterThan(geometry.rightModule.x);
    expect(geometry.rightGlass.x).toBeGreaterThan(geometry.rightSashInner.x);
    expect(geometry.rightGlass.x + geometry.rightGlass.width).toBeLessThan(
      geometry.rightSashInner.x + geometry.rightSashInner.width,
    );
  });
});

