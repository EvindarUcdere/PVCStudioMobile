import { DesignNode } from './DesignNode';

export type ArchTopShape = {
  type: 'arch-top';
  archHeight: number;
};

export type FrameShape = 'rect' | 'arch-top' | ArchTopShape;

export type RollerShutterBox = {
  enabled: boolean;
  height: number;
};

export type FrameNode = {
  id: string;
  type: 'frame';
  shape?: FrameShape;
  rollerShutter?: RollerShutterBox | null;
  child: DesignNode;
};
