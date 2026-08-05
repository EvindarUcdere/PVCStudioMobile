import { Rect } from 'react-native-svg';

import { RectMm } from './profileGeometry';

type GlazingBeadProps = {
  rect: RectMm;
  inset: number;
};

export function GlazingBead({ rect, inset }: GlazingBeadProps) {
  return (
    <Rect
      x={rect.x - inset}
      y={rect.y - inset}
      width={rect.width + inset * 2}
      height={rect.height + inset * 2}
      fill="none"
      stroke="#dfe6e2"
      strokeWidth={Math.max(2, inset)}
    />
  );
}

