import { G, Line, Rect } from 'react-native-svg';

import { RectMm } from './profileGeometry';

type GlassUnitProps = {
  rect: RectMm;
};

export function GlassUnit({ rect }: GlassUnitProps) {
  const edge = Math.max(3, Math.min(7, Math.min(rect.width, rect.height) * 0.04));

  return (
    <G>
      <Rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill="url(#referenceGlassGradient)"
        stroke="#89a7af"
        strokeWidth={1.2}
      />
      <Rect
        x={rect.x + edge}
        y={rect.y + edge}
        width={Math.max(0, rect.width - edge * 2)}
        height={Math.max(0, rect.height - edge * 2)}
        fill="none"
        stroke="#48635f"
        strokeOpacity={0.42}
        strokeWidth={0.8}
      />
      <Line
        x1={rect.x + rect.width * 0.18}
        y1={rect.y + edge}
        x2={rect.x + rect.width - edge}
        y2={rect.y + rect.height * 0.74}
        stroke="#ffffff"
        strokeOpacity={0.65}
        strokeWidth={1.2}
      />
    </G>
  );
}

