import { G, Polygon, Rect } from 'react-native-svg';

import { ReferenceWindowGeometry, mmToPx, toPx } from './profileGeometry';
import { Gasket } from './Gasket';
import { GlassUnit } from './GlassUnit';
import { GlazingBead } from './GlazingBead';

type SashProfileProps = {
  geometry: ReferenceWindowGeometry;
  color: string;
};

export function SashProfile({ geometry, color }: SashProfileProps) {
  const outer = toPx(geometry.rightSashOuter, geometry);
  const inner = toPx(geometry.rightSashInner, geometry);
  const glass = toPx(geometry.rightGlass, geometry);
  const groove = mmToPx(13, geometry);
  const liftX = mmToPx(14, geometry);
  const liftY = mmToPx(8, geometry);
  const liftedOuter = offsetRect(outer, liftX, liftY);
  const liftedInner = offsetRect(inner, liftX, liftY);
  const liftedGlass = offsetRect(glass, liftX, liftY);

  return (
    <G>
      <Rect
        x={outer.x + liftX * 0.35}
        y={outer.y + liftY * 0.35}
        width={outer.width}
        height={outer.height}
        fill="#101816"
        opacity={0.18}
      />
      <Polygon
        points={`${outer.x},${outer.y} ${liftedOuter.x},${liftedOuter.y} ${liftedOuter.x},${
          liftedOuter.y + liftedOuter.height
        } ${outer.x},${outer.y + outer.height}`}
        fill="#d9e0dc"
        stroke="#4d5753"
        strokeWidth={0.8}
      />
      <Polygon
        points={`${outer.x},${outer.y + outer.height} ${liftedOuter.x},${liftedOuter.y + liftedOuter.height} ${
          liftedOuter.x + liftedOuter.width
        },${liftedOuter.y + liftedOuter.height} ${outer.x + outer.width},${outer.y + outer.height}`}
        fill="#aab4b0"
        stroke="#4d5753"
        strokeWidth={0.8}
      />
      <Polygon
        points={`${liftedOuter.x},${liftedOuter.y} ${liftedOuter.x + liftedOuter.width},${liftedOuter.y} ${
          liftedInner.x + liftedInner.width
        },${liftedInner.y} ${liftedInner.x},${liftedInner.y}`}
        fill="#ffffff"
        stroke="#4d5753"
        strokeWidth={1}
      />
      <Polygon
        points={`${liftedOuter.x + liftedOuter.width},${liftedOuter.y} ${liftedOuter.x + liftedOuter.width},${
          liftedOuter.y + liftedOuter.height
        } ${liftedInner.x + liftedInner.width},${liftedInner.y + liftedInner.height} ${
          liftedInner.x + liftedInner.width
        },${liftedInner.y}`}
        fill="#c8d0cc"
        stroke="#4d5753"
        strokeWidth={1}
      />
      <Polygon
        points={`${liftedOuter.x},${liftedOuter.y + liftedOuter.height} ${liftedOuter.x + liftedOuter.width},${
          liftedOuter.y + liftedOuter.height
        } ${liftedInner.x + liftedInner.width},${liftedInner.y + liftedInner.height} ${liftedInner.x},${
          liftedInner.y + liftedInner.height
        }`}
        fill="#b9c2be"
        stroke="#4d5753"
        strokeWidth={1}
      />
      <Polygon
        points={`${liftedOuter.x},${liftedOuter.y} ${liftedInner.x},${liftedInner.y} ${liftedInner.x},${
          liftedInner.y + liftedInner.height
        } ${liftedOuter.x},${liftedOuter.y + liftedOuter.height}`}
        fill={color}
        stroke="#4d5753"
        strokeWidth={1}
      />
      <Rect
        x={liftedInner.x + groove}
        y={liftedInner.y + groove}
        width={Math.max(0, liftedInner.width - groove * 2)}
        height={Math.max(0, liftedInner.height - groove * 2)}
        fill="none"
        stroke="#8d9894"
        strokeWidth={0.8}
      />
      <GlazingBead rect={liftedGlass} inset={5} />
      <Gasket rect={liftedGlass} />
      <GlassUnit rect={liftedGlass} />
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
