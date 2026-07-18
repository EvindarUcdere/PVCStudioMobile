import { FrameNode } from '../entities/FrameNode';

export function isArchTopFrame(frame: FrameNode): boolean {
  return (
    frame.shape === 'arch-top' ||
    (typeof frame.shape === 'object' && frame.shape.type === 'arch-top')
  );
}

export function getArchHeight(frame: FrameNode, designHeight: number): number {
  if (frame.shape && typeof frame.shape === 'object') {
    return frame.shape.archHeight;
  }

  return Math.round(designHeight * 0.32);
}

export function withArchHeight(frame: FrameNode, archHeight: number): FrameNode {
  return {
    ...frame,
    shape: {
      type: 'arch-top',
      archHeight,
    },
  };
}
