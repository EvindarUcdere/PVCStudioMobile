import { Rect } from 'react-native-svg';

type WallOpeningLayerProps = {
  width: number;
  height: number;
};

export function WallOpeningLayer({ width, height }: WallOpeningLayerProps) {
  return <Rect x={0} y={0} width={width} height={height} fill="#eef2ef" />;
}

