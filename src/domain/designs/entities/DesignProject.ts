import { AccessorySelection } from './AccessorySelection';
import { DesignNode } from './DesignNode';
import { GlassSelection } from './GlassSelection';
import { ProfileSystemSelection } from './ProfileSystemSelection';
import { DesignUnit } from '../enums/DesignUnit';
import { SyncStatus } from '../enums/SyncStatus';

export type DesignProject = {
  id: string;
  name: string;
  customerId: string | null;
  templateId: string | null;
  width: number;
  height: number;
  quantity: number;
  unit: DesignUnit;
  rootNode: DesignNode;
  profileSystem: ProfileSystemSelection | null;
  defaultGlass: GlassSelection | null;
  accessories: AccessorySelection[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
  version: number;
};
