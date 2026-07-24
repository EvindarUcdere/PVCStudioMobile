import { Fragment, memo, ReactNode, useMemo } from 'react';
import Svg, { ClipPath, Defs, G, Line, Path, Rect } from 'react-native-svg';

import { DesignNode } from '../../../domain/designs/entities/DesignNode';
import { getArchHeight, isArchTopFrame } from '../../../domain/designs/utils/frameShape';
import { colors } from '../../../theme';
import { calculateNodeLayout, PanelLayout } from '../utils/calculateNodeLayout';

type TemplatePreviewProps = {
  rootNode: DesignNode;
  aspectRatio: number;
  designHeight?: number;
  profileColorHex?: string;
  compact?: boolean;
};

const viewBoxWidth = 240;
const padding = 10;

function getFramePath(x: number, y: number, width: number, height: number, archHeight: number): string {
  const safeArchHeight = Math.min(height * 0.46, width / 2, Math.max(14, archHeight));
  const bodyTop = y + safeArchHeight;
  const centerX = x + width / 2;

  return [
    `M ${x} ${y + height}`,
    `L ${x} ${bodyTop}`,
    `C ${x} ${y + safeArchHeight * 0.45} ${x + width * 0.24} ${y} ${centerX} ${y}`,
    `C ${x + width * 0.76} ${y} ${x + width} ${y + safeArchHeight * 0.45} ${x + width} ${bodyTop}`,
    `L ${x + width} ${y + height}`,
    'Z',
  ].join(' ');
}

function getInsetFramePath(
  x: number,
  y: number,
  width: number,
  height: number,
  archHeight: number,
  inset: number,
): string {
  return getFramePath(
    x + inset,
    y + inset,
    Math.max(1, width - inset * 2),
    Math.max(1, height - inset * 2),
    Math.max(14, archHeight - inset),
  );
}

function renderOpeningSymbol(panel: PanelLayout, compact: boolean): ReactNode {
  const stroke = colors.primary;
  const x1 = panel.x;
  const y1 = panel.y;
  const x2 = panel.x + panel.width;
  const y2 = panel.y + panel.height;
  const midX = panel.x + panel.width / 2;
  const midY = panel.y + panel.height / 2;

  if (panel.openingType === 'open-left' || panel.openingType === 'door-left') {
    return (
      <>
        <Line x1={x2} y1={y1} x2={x1} y2={midY} stroke={stroke} strokeWidth={1.8} />
        <Line x1={x2} y1={y2} x2={x1} y2={midY} stroke={stroke} strokeWidth={1.8} />
        {renderPreviewHandle(panel, 'right', compact)}
      </>
    );
  }

  if (panel.openingType === 'open-right' || panel.openingType === 'door-right') {
    return (
      <>
        <Line x1={x1} y1={y1} x2={x2} y2={midY} stroke={stroke} strokeWidth={1.8} />
        <Line x1={x1} y1={y2} x2={x2} y2={midY} stroke={stroke} strokeWidth={1.8} />
        {renderPreviewHandle(panel, 'left', compact)}
      </>
    );
  }

  if (panel.openingType === 'tilt' || panel.openingType === 'tilt-top') {
    return (
      <>
        <Path
          d={`M ${x1} ${y2} L ${midX} ${y1} L ${x2} ${y2}`}
          stroke={stroke}
          strokeWidth={1.8}
          fill="none"
        />
        {renderPreviewHandle(panel, 'bottom', compact)}
      </>
    );
  }

  if (panel.openingType === 'tilt-bottom') {
    return (
      <>
        <Path
          d={`M ${x1} ${y1} L ${midX} ${y2} L ${x2} ${y1}`}
          stroke={stroke}
          strokeWidth={1.8}
          fill="none"
        />
        {renderPreviewHandle(panel, 'top', compact)}
      </>
    );
  }

  if (panel.openingType === 'tilt-turn-left' || panel.openingType === 'tilt-turn-right') {
    return (
      <>
        {renderOpeningSymbol(
          {
            ...panel,
            openingType: panel.openingType.endsWith('left') ? 'open-left' : 'open-right',
          },
          compact,
        )}
        {renderPreviewTiltSymbol(panel)}
      </>
    );
  }

  if (panel.openingType === 'sliding-left' || panel.openingType === 'sliding-right') {
    const arrowStart = panel.openingType === 'sliding-left' ? x2 - 14 : x1 + 14;
    const arrowEnd = panel.openingType === 'sliding-left' ? x1 + 14 : x2 - 14;
    const head = panel.openingType === 'sliding-left' ? 6 : -6;
    return (
      <Path
        d={`M ${arrowStart} ${midY} L ${arrowEnd} ${midY} M ${arrowEnd + head} ${midY - 5} L ${arrowEnd} ${midY} L ${arrowEnd + head} ${midY + 5}`}
        stroke={stroke}
        strokeWidth={compact ? 1.6 : 2}
        fill="none"
      />
    );
  }

  if (panel.openingType === 'double-sash') {
    return <Line x1={midX} y1={y1} x2={midX} y2={y2} stroke={stroke} strokeWidth={1.5} />;
  }

  return null;
}

function renderPreviewTiltSymbol(panel: PanelLayout): ReactNode {
  const stroke = colors.primary;
  const x1 = panel.x;
  const y1 = panel.y;
  const x2 = panel.x + panel.width;
  const y2 = panel.y + panel.height;
  const midX = panel.x + panel.width / 2;

  return (
    <Path
      d={`M ${x1} ${y2} L ${midX} ${y1} L ${x2} ${y2}`}
      stroke={stroke}
      strokeWidth={1.8}
      fill="none"
    />
  );
}

function renderPreviewHandle(
  panel: PanelLayout,
  side: 'left' | 'right' | 'top' | 'bottom',
  compact: boolean,
): ReactNode {
  const handleLength = Math.max(compact ? 9 : 12, Math.min(compact ? 18 : 24, Math.min(panel.width, panel.height) * 0.24));
  const handleWidth = compact ? 3.5 : 4.5;
  const radius = handleWidth / 2;

  if (side === 'left') {
    return (
      <Rect
        x={panel.x + 7}
        y={panel.y + panel.height / 2 - handleLength / 2}
        width={handleWidth}
        height={handleLength}
        rx={radius}
        fill={colors.primary}
        stroke={colors.surface}
        strokeWidth={0.8}
      />
    );
  }

  if (side === 'right') {
    return (
      <Rect
        x={panel.x + panel.width - 7 - handleWidth}
        y={panel.y + panel.height / 2 - handleLength / 2}
        width={handleWidth}
        height={handleLength}
        rx={radius}
        fill={colors.primary}
        stroke={colors.surface}
        strokeWidth={0.8}
      />
    );
  }

  if (side === 'top') {
    return (
      <Rect
        x={panel.x + panel.width / 2 - handleLength / 2}
        y={panel.y + 7}
        width={handleLength}
        height={handleWidth}
        rx={radius}
        fill={colors.primary}
        stroke={colors.surface}
        strokeWidth={0.8}
      />
    );
  }

  return (
    <Rect
      x={panel.x + panel.width / 2 - handleLength / 2}
      y={panel.y + panel.height - 7 - handleWidth}
      width={handleLength}
      height={handleWidth}
      rx={radius}
      fill={colors.primary}
      stroke={colors.surface}
      strokeWidth={0.8}
    />
  );
}

export const TemplatePreview = memo(function TemplatePreview({
  rootNode,
  aspectRatio,
  designHeight,
  profileColorHex = '#FFFFFF',
  compact = false,
}: TemplatePreviewProps) {
  const viewBoxHeight = Math.max(90, viewBoxWidth / aspectRatio);
  const frameIsArch = rootNode.type === 'frame' && isArchTopFrame(rootNode);
  const archHeight =
    frameIsArch && rootNode.type === 'frame'
      ? getArchHeight(rootNode, designHeight ?? viewBoxHeight) *
        (viewBoxHeight / Math.max(designHeight ?? viewBoxHeight, 1))
      : 0;
  const framePath = getFramePath(
    padding,
    padding,
    viewBoxWidth - padding * 2,
    viewBoxHeight - padding * 2,
    archHeight,
  );
  const profilePalette = getProfilePalette(profileColorHex);
  const frameInset = compact ? 6 : 8;
  const shutterHeight =
    rootNode.type === 'frame' && rootNode.rollerShutter?.enabled
      ? Math.min(
          (viewBoxHeight - padding * 2) * 0.34,
          Math.max(
            12,
            rootNode.rollerShutter.height *
              (viewBoxHeight / Math.max(designHeight ?? viewBoxHeight, 1)),
          ),
        )
      : 0;
  const innerFramePath = getInsetFramePath(
    padding,
    padding,
    viewBoxWidth - padding * 2,
    viewBoxHeight - padding * 2,
    archHeight,
    frameInset,
  );
  const panels = useMemo(
    () =>
      calculateNodeLayout(rootNode, {
        x: padding,
        y: padding,
        width: viewBoxWidth - padding * 2,
        height: viewBoxHeight - padding * 2,
      }),
    [rootNode, viewBoxHeight],
  );

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}>
      {frameIsArch ? (
        <Path
          d={framePath}
          fill={profilePalette.outer}
          stroke={colors.textPrimary}
          strokeWidth={2.4}
        />
      ) : (
        <Rect
          x={padding}
          y={padding}
          width={viewBoxWidth - padding * 2}
          height={viewBoxHeight - padding * 2}
          fill={colors.surface}
          stroke={colors.textPrimary}
          strokeWidth={2.4}
        />
      )}
      {frameIsArch ? (
        <Defs>
          <ClipPath id="templateFrameClip">
            <Path d={innerFramePath} />
          </ClipPath>
        </Defs>
      ) : null}
      {frameIsArch ? (
        <Path
          d={innerFramePath}
          fill={colors.surface}
          stroke={profilePalette.stroke}
          strokeWidth={2}
        />
      ) : null}
      <G clipPath={frameIsArch ? 'url(#templateFrameClip)' : undefined}>
        {panels.map((panel) => (
          <PreviewPanel key={panel.id} panel={panel} profilePalette={profilePalette} />
        ))}
        {panels.map((panel) => (
          <Fragment key={`${panel.id}-symbol`}>{renderOpeningSymbol(panel, compact)}</Fragment>
        ))}
      </G>
      {shutterHeight > 0 ? (
        <PreviewRollerShutter
          x={padding}
          y={padding}
          width={viewBoxWidth - padding * 2}
          height={shutterHeight}
        />
      ) : null}
      {frameIsArch ? (
        <>
          <Path d={framePath} fill="none" stroke={colors.textPrimary} strokeWidth={2.4} />
          <Path d={innerFramePath} fill="none" stroke={profilePalette.stroke} strokeWidth={2} />
        </>
      ) : null}
    </Svg>
  );
});

function PreviewPanel({
  panel,
  profilePalette,
}: {
  panel: PanelLayout;
  profilePalette: ProfilePalette;
}) {
  const profileInset = Math.max(3, Math.min(8, Math.min(panel.width, panel.height) * 0.08));
  const glassInset = profileInset + Math.max(2, Math.min(6, Math.min(panel.width, panel.height) * 0.04));

  return (
    <>
      <Rect
        x={panel.x}
        y={panel.y}
        width={panel.width}
        height={panel.height}
        fill={profilePalette.outer}
        stroke="#96A5A0"
        strokeWidth={1.8}
      />
      <Rect
        x={panel.x + profileInset}
        y={panel.y + profileInset}
        width={Math.max(0, panel.width - profileInset * 2)}
        height={Math.max(0, panel.height - profileInset * 2)}
        fill={profilePalette.inner}
        stroke={profilePalette.stroke}
        strokeWidth={1.2}
      />
      <Rect
        x={panel.x + glassInset}
        y={panel.y + glassInset}
        width={Math.max(0, panel.width - glassInset * 2)}
        height={Math.max(0, panel.height - glassInset * 2)}
        fill="#D8E6F5"
        stroke="#AEBBB7"
        strokeWidth={1}
      />
      {panel.insectScreen ? <PreviewInsectScreen panel={panel} inset={glassInset} /> : null}
    </>
  );
}

function PreviewRollerShutter({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const lineCount = Math.max(3, Math.floor(height / 8));
  const lines = Array.from(
    { length: lineCount },
    (_, index) => y + ((index + 1) * height) / (lineCount + 1),
  );

  return (
    <G>
      <Rect
        x={x + 4}
        y={y + 4}
        width={Math.max(0, width - 8)}
        height={Math.max(0, height - 8)}
        fill="#C9D0CF"
        stroke="#6F7B78"
        strokeWidth={1.2}
      />
      {lines.map((lineY) => (
        <Line
          key={`preview-shutter-${lineY}`}
          x1={x + 10}
          y1={lineY}
          x2={x + width - 10}
          y2={lineY}
          stroke="#8A9693"
          strokeWidth={0.8}
        />
      ))}
    </G>
  );
}

function PreviewInsectScreen({ panel, inset }: { panel: PanelLayout; inset: number }) {
  const x = panel.x + inset + 1;
  const y = panel.y + inset + 1;
  const width = Math.max(0, panel.width - (inset + 1) * 2);
  const height = Math.max(0, panel.height - (inset + 1) * 2);

  return (
    <G>
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke="#166E61"
        strokeDasharray="3 3"
        strokeWidth={1}
      />
      <Line
        x1={x + width / 3}
        y1={y + 2}
        x2={x + width / 3}
        y2={y + height - 2}
        stroke="#166E61"
        strokeOpacity={0.3}
        strokeWidth={0.8}
      />
      <Line
        x1={x + (width * 2) / 3}
        y1={y + 2}
        x2={x + (width * 2) / 3}
        y2={y + height - 2}
        stroke="#166E61"
        strokeOpacity={0.3}
        strokeWidth={0.8}
      />
    </G>
  );
}

type ProfilePalette = {
  outer: string;
  inner: string;
  stroke: string;
};

function getProfilePalette(hexValue: string): ProfilePalette {
  return {
    outer: hexValue,
    inner: mixHex(hexValue, '#FFFFFF', 0.22),
    stroke: mixHex(hexValue, '#17211E', 0.35),
  };
}

function mixHex(firstHex: string, secondHex: string, ratio: number): string {
  const first = parseHex(firstHex);
  const second = parseHex(secondHex);
  const clampRatio = Math.max(0, Math.min(1, ratio));

  return toHex({
    r: Math.round(first.r * (1 - clampRatio) + second.r * clampRatio),
    g: Math.round(first.g * (1 - clampRatio) + second.g * clampRatio),
    b: Math.round(first.b * (1 - clampRatio) + second.b * clampRatio),
  });
}

function parseHex(hexValue: string): { r: number; g: number; b: number } {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(hexValue) ? hexValue.slice(1) : 'FFFFFF';

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}
