import { DesignNode } from '../entities/DesignNode';
import { SplitNode } from '../entities/SplitNode';
import { SplitDirection } from '../enums/SplitDirection';
import { createId } from '../utils/id';

type CreateSplitNodeInput = {
  direction: SplitDirection;
  first: DesignNode;
  second: DesignNode;
  ratio?: number;
};

export function createSplitNode({
  direction,
  first,
  second,
  ratio = 0.5,
}: CreateSplitNodeInput): SplitNode {
  return {
    id: createId(),
    type: 'split',
    direction,
    ratio,
    first,
    second,
  };
}
