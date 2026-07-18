import { SplitDirection } from '../enums/SplitDirection';
import { DesignNode } from './DesignNode';

export type SplitNode = {
  id: string;
  type: 'split';
  direction: SplitDirection;
  ratio: number;
  first: DesignNode;
  second: DesignNode;
};
