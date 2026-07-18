export type AccessoryScope = 'design' | 'panel';

export type AccessorySelection = {
  id: string;
  accessoryTypeId: string;
  scope: AccessoryScope;
  targetNodeId: string | null;
  quantity: number;
  notes: string | null;
};
