import { G, Path, Rect } from 'react-native-svg';

import { ReferenceWindowGeometry, mmToPx, toPx } from './profileGeometry';

type HardwareLayerProps = {
  geometry: ReferenceWindowGeometry;
};

export function HardwareLayer({ geometry }: HardwareLayerProps) {
  const sash = offsetRect(toPx(geometry.rightSashOuter, geometry), mmToPx(14, geometry), mmToPx(8, geometry));
  const x = sash.x + 8;
  const y = sash.y + sash.height / 2 - 18;

  return (
    <G>
      <Path
        d={`M ${sash.x + sash.width - 8} ${sash.y + 8} L ${sash.x + 10} ${sash.y + sash.height / 2} L ${
          sash.x + sash.width - 8
        } ${sash.y + sash.height - 8}`}
        fill="none"
        stroke="#1747ff"
        strokeWidth={1.8}
      />
      <Rect x={x} y={y} width={5} height={36} rx={2.5} fill="#6f7b78" stroke="#e6efeb" strokeWidth={0.8} />
    </G>
  );
}

function offsetRect(rect: { x: number; y: number; width: number; height: number }, x: number, y: number) {
  return {
    ...rect,
    x: rect.x + x,
    y: rect.y + y,
  };
}
