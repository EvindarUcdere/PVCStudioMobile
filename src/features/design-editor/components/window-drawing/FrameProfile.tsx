import { G, Line, Polygon, Rect } from 'react-native-svg';

import { ReferenceWindowGeometry, mmToPx, toPx } from './profileGeometry';

type FrameProfileProps = {
  geometry: ReferenceWindowGeometry;
  color: string;
};

export function FrameProfile({ geometry, color }: FrameProfileProps) {
  const outer = toPx(geometry.frameOuter, geometry);
  const inner = toPx(geometry.frameInner, geometry);
  const chamberInset = mmToPx(18, geometry);
  const reinforcementWidth = mmToPx(18, geometry);
  const stroke = '#4d5753';
  const light = '#f8fbf9';
  const mid = color;
  const shadow = '#b8c1bd';

  return (
    <G>
      <Polygon
        points={`${outer.x},${outer.y} ${outer.x + outer.width},${outer.y} ${inner.x + inner.width},${inner.y} ${inner.x},${inner.y}`}
        fill={light}
        stroke={stroke}
        strokeWidth={1.1}
      />
      <Polygon
        points={`${outer.x + outer.width},${outer.y} ${outer.x + outer.width},${outer.y + outer.height} ${inner.x + inner.width},${inner.y + inner.height} ${inner.x + inner.width},${inner.y}`}
        fill={shadow}
        stroke={stroke}
        strokeWidth={1.1}
      />
      <Polygon
        points={`${outer.x},${outer.y + outer.height} ${outer.x + outer.width},${outer.y + outer.height} ${inner.x + inner.width},${inner.y + inner.height} ${inner.x},${inner.y + inner.height}`}
        fill={shadow}
        stroke={stroke}
        strokeWidth={1.1}
      />
      <Polygon
        points={`${outer.x},${outer.y} ${inner.x},${inner.y} ${inner.x},${inner.y + inner.height} ${outer.x},${outer.y + outer.height}`}
        fill={mid}
        stroke={stroke}
        strokeWidth={1.1}
      />
      <Rect
        x={inner.x}
        y={inner.y}
        width={inner.width}
        height={inner.height}
        fill="#f6faf7"
        stroke="#8d9894"
        strokeWidth={1}
      />
      <Rect
        x={inner.x + chamberInset}
        y={inner.y + chamberInset}
        width={Math.max(0, inner.width - chamberInset * 2)}
        height={Math.max(0, inner.height - chamberInset * 2)}
        fill="none"
        stroke="#9aa5a1"
        strokeWidth={0.8}
      />
      <Line
        x1={outer.x + outer.width / 2 - reinforcementWidth}
        y1={outer.y + chamberInset}
        x2={outer.x + outer.width / 2 + reinforcementWidth}
        y2={outer.y + chamberInset}
        stroke="#b34032"
        strokeWidth={2}
      />
      <Line
        x1={outer.x + outer.width / 2 - reinforcementWidth}
        y1={outer.y + outer.height - chamberInset}
        x2={outer.x + outer.width / 2 + reinforcementWidth}
        y2={outer.y + outer.height - chamberInset}
        stroke="#b34032"
        strokeWidth={2}
      />
    </G>
  );
}

