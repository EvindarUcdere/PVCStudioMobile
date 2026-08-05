import { G } from 'react-native-svg';

import { ReferenceWindowGeometry, toPx } from './profileGeometry';
import { Gasket } from './Gasket';
import { GlassUnit } from './GlassUnit';
import { GlazingBead } from './GlazingBead';

type FixedGlassModuleProps = {
  geometry: ReferenceWindowGeometry;
};

export function FixedGlassModule({ geometry }: FixedGlassModuleProps) {
  const glass = toPx(geometry.leftGlass, geometry);

  return (
    <G>
      <GlazingBead rect={glass} inset={5} />
      <Gasket rect={glass} />
      <GlassUnit rect={glass} />
    </G>
  );
}

