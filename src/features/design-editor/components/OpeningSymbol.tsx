import { ReactNode } from 'react';
import { Line, Path, Rect } from 'react-native-svg';

import { OpeningType } from '../../../domain/designs/enums/OpeningType';
import { LayoutBounds } from '../../../domain/designs/layout/layoutTypes';
import { colors } from '../../../theme';

type OpeningSymbolProps = {
  bounds: LayoutBounds;
  openingType: OpeningType;
};

export function OpeningSymbol({ bounds, openingType }: OpeningSymbolProps) {
  return <>{renderOpeningSymbol(bounds, openingType)}</>;
}

function renderOpeningSymbol(bounds: LayoutBounds, openingType: OpeningType): ReactNode {
  const x1 = bounds.x;
  const y1 = bounds.y;
  const x2 = bounds.x + bounds.width;
  const y2 = bounds.y + bounds.height;
  const midX = bounds.x + bounds.width / 2;
  const midY = bounds.y + bounds.height / 2;
  const stroke = colors.textPrimary;

  if (openingType === 'open-left' || openingType === 'door-left') {
    return (
      <>
        <Line x1={x2} y1={y1} x2={x1} y2={midY} stroke={stroke} strokeWidth={1.6} />
        <Line x1={x2} y1={y2} x2={x1} y2={midY} stroke={stroke} strokeWidth={1.6} />
        {renderHandle(bounds, 'right')}
      </>
    );
  }

  if (openingType === 'open-right' || openingType === 'door-right') {
    return (
      <>
        <Line x1={x1} y1={y1} x2={x2} y2={midY} stroke={stroke} strokeWidth={1.6} />
        <Line x1={x1} y1={y2} x2={x2} y2={midY} stroke={stroke} strokeWidth={1.6} />
        {renderHandle(bounds, 'left')}
      </>
    );
  }

  if (openingType === 'tilt' || openingType === 'tilt-top') {
    return (
      <>
        <Path d={`M ${x1} ${y2} L ${midX} ${y1} L ${x2} ${y2}`} stroke={stroke} strokeWidth={1.6} fill="none" />
        {renderHandle(bounds, 'bottom')}
      </>
    );
  }

  if (openingType === 'tilt-bottom') {
    return (
      <>
        <Path d={`M ${x1} ${y1} L ${midX} ${y2} L ${x2} ${y1}`} stroke={stroke} strokeWidth={1.6} fill="none" />
        {renderHandle(bounds, 'top')}
      </>
    );
  }

  if (openingType === 'tilt-turn-left' || openingType === 'tilt-turn-right') {
    return (
      <>
        {renderOpeningSymbol(bounds, openingType.endsWith('left') ? 'open-left' : 'open-right')}
        {renderTiltSymbol(bounds, 'top')}
      </>
    );
  }

  if (openingType === 'sliding-left' || openingType === 'sliding-right') {
    const arrowStart = openingType === 'sliding-left' ? x2 - 14 : x1 + 14;
    const arrowEnd = openingType === 'sliding-left' ? x1 + 14 : x2 - 14;
    const head = openingType === 'sliding-left' ? 6 : -6;
    return (
      <Path
        d={`M ${arrowStart} ${midY} L ${arrowEnd} ${midY} M ${arrowEnd + head} ${midY - 5} L ${arrowEnd} ${midY} L ${arrowEnd + head} ${midY + 5}`}
        stroke={stroke}
        strokeWidth={1.7}
        fill="none"
      />
    );
  }

  if (openingType === 'double-sash') {
    return <Line x1={midX} y1={y1} x2={midX} y2={y2} stroke={stroke} strokeWidth={1.3} />;
  }

  return null;
}

function renderTiltSymbol(bounds: LayoutBounds, side: 'top' | 'bottom'): ReactNode {
  const x1 = bounds.x;
  const y1 = bounds.y;
  const x2 = bounds.x + bounds.width;
  const y2 = bounds.y + bounds.height;
  const midX = bounds.x + bounds.width / 2;
  const stroke = colors.textPrimary;

  if (side === 'top') {
    return <Path d={`M ${x1} ${y2} L ${midX} ${y1} L ${x2} ${y2}`} stroke={stroke} strokeWidth={1.6} fill="none" />;
  }

  return <Path d={`M ${x1} ${y1} L ${midX} ${y2} L ${x2} ${y1}`} stroke={stroke} strokeWidth={1.6} fill="none" />;
}

function renderHandle(bounds: LayoutBounds, side: 'left' | 'right' | 'top' | 'bottom') {
  const handleLength = Math.max(14, Math.min(30, Math.min(bounds.width, bounds.height) * 0.24));
  const handleWidth = Math.max(4, Math.min(6, Math.min(bounds.width, bounds.height) * 0.05));
  const handleRadius = handleWidth / 2;
  const handleFill = colors.primary;

  if (side === 'left') {
    return (
      <Rect
        x={bounds.x + 7}
        y={bounds.y + bounds.height / 2 - handleLength / 2}
        width={handleWidth}
        height={handleLength}
        rx={handleRadius}
        fill={handleFill}
        stroke={colors.surface}
        strokeWidth={1}
      />
    );
  }

  if (side === 'right') {
    return (
      <Rect
        x={bounds.x + bounds.width - 7 - handleWidth}
        y={bounds.y + bounds.height / 2 - handleLength / 2}
        width={handleWidth}
        height={handleLength}
        rx={handleRadius}
        fill={handleFill}
        stroke={colors.surface}
        strokeWidth={1}
      />
    );
  }

  if (side === 'top') {
    return (
      <Rect
        x={bounds.x + bounds.width / 2 - handleLength / 2}
        y={bounds.y + 7}
        width={handleLength}
        height={handleWidth}
        rx={handleRadius}
        fill={handleFill}
        stroke={colors.surface}
        strokeWidth={1}
      />
    );
  }

  return (
    <Rect
      x={bounds.x + bounds.width / 2 - handleLength / 2}
      y={bounds.y + bounds.height - 7 - handleWidth}
      width={handleLength}
      height={handleWidth}
      rx={handleRadius}
      fill={handleFill}
      stroke={colors.surface}
      strokeWidth={1}
    />
  );
}
