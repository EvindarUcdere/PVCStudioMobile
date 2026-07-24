import { AccessorySelection } from './AccessorySelection';
import { GlassSelection } from './GlassSelection';
import { OpeningType } from '../enums/OpeningType';

export type InsectScreenType = 'fixed' | 'sliding-horizontal' | 'sliding-vertical';

export type PanelNode = {
  id: string;
  type: 'panel';
  openingType: OpeningType;
  insectScreen: InsectScreenType | null;
  glass: GlassSelection | null;
  accessories: AccessorySelection[];
  notes: string | null;
};
