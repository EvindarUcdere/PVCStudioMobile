import { G, Rect } from 'react-native-svg';

import { ReferenceWindowGeometry, mmToPx, toPx } from './profileGeometry';

type MountingFrameLayerProps = {
  geometry: ReferenceWindowGeometry;
};

export function MountingFrameLayer({ geometry }: MountingFrameLayerProps) {
  const outer = toPx(geometry.wallOpening, geometry);
  const frameOuter = toPx(geometry.frameOuter, geometry);
  const reveal = mmToPx(24, geometry);
  const tapeInset = mmToPx(10, geometry);

  return (
    <G>
      <Rect
        x={outer.x}
        y={outer.y}
        width={outer.width}
        height={outer.height}
        fill="#d8ddd9"
        stroke="#a8b0ac"
        strokeWidth={1}
      />
      <Rect
        x={frameOuter.x - reveal}
        y={frameOuter.y - reveal}
        width={frameOuter.width + reveal * 2}
        height={frameOuter.height + reveal * 2}
        fill="#303735"
        stroke="#111816"
        strokeWidth={1.2}
      />
      <Rect
        x={frameOuter.x - tapeInset}
        y={frameOuter.y - tapeInset}
        width={frameOuter.width + tapeInset * 2}
        height={frameOuter.height + tapeInset * 2}
        fill="#151c1a"
        stroke="#5b6460"
        strokeWidth={0.8}
      />
    </G>
  );
}

