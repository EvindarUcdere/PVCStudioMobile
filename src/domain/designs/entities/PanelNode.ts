import { AccessorySelection } from './AccessorySelection';
import { GlassSelection } from './GlassSelection';
import { OpeningType } from '../enums/OpeningType';

export type PanelNode = {
  id: string;
  type: 'panel';
  openingType: OpeningType;
  glass: GlassSelection | null;
  accessories: AccessorySelection[];
  notes: string | null;
};
