import { G, Line, Rect } from 'react-native-svg';

import { ReferenceWindowGeometry, mmToPx, toPx } from './profileGeometry';

type MullionProfileProps = {
  geometry: ReferenceWindowGeometry;
  color: string;
};

export function MullionProfile({ geometry, color }: MullionProfileProps) {
  const rect = toPx(geometry.mullion, geometry);
  const lip = mmToPx(15, geometry);

  return (
    <G>
      <Rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={color} stroke="#4d5753" strokeWidth={1.1} />
      <Rect
        x={rect.x + lip}
        y={rect.y + lip}
        width={Math.max(0, rect.width - lip * 2)}
        height={Math.max(0, rect.height - lip * 2)}
        fill="#eef3f0"
        stroke="#8d9894"
        strokeWidth={0.8}
      />
      <Line x1={rect.x + 4} y1={rect.y + 5} x2={rect.x + 4} y2={rect.y + rect.height - 5} stroke="#ffffff" strokeWidth={1} />
      <Line
        x1={rect.x + rect.width - 4}
        y1={rect.y + 5}
        x2={rect.x + rect.width - 4}
        y2={rect.y + rect.height - 5}
        stroke="#9aa5a1"
        strokeWidth={1}
      />
    </G>
  );
}
