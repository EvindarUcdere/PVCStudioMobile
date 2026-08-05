import { Rect } from 'react-native-svg';

import { RectMm } from './profileGeometry';

type GasketProps = {
  rect: RectMm;
};

export function Gasket({ rect }: GasketProps) {
  return (
    <Rect
      x={rect.x - 3}
      y={rect.y - 3}
      width={rect.width + 6}
      height={rect.height + 6}
      fill="none"
      stroke="#1d2a26"
      strokeOpacity={0.6}
      strokeWidth={1.2}
    />
  );
}

