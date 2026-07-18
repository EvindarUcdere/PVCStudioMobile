import { DesignNode } from './DesignNode';

export type ArchTopShape = {
  type: 'arch-top';
  archHeight: number;
};

export type FrameShape = 'rect' | 'arch-top' | ArchTopShape;

export type FrameNode = {
  id: string;
  type: 'frame';
  shape?: FrameShape;
  child: DesignNode;
};
