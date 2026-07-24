import { memo, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import { getDesignProfileColor } from '../../../domain/designs/colors/profileColorOptions';
import {
  calculateDesignLayout,
  DesignLayoutError,
} from '../../../domain/designs/layout/calculateDesignLayout';
import { DESIGN_FRAME_INSET, DESIGN_SPLIT_STROKE_WIDTH } from '../../../domain/designs/layout/layoutConstants';
import { PanelBounds } from '../../../domain/designs/layout/layoutTypes';
import { getArchHeight, isArchTopFrame } from '../../../domain/designs/utils/frameShape';
import { colors, radius, spacing, typography } from '../../../theme';
import { OpeningSymbol } from './OpeningSymbol';

type DesignCanvasProps = {
  design: DesignProject;
  selectedNodeId: string | null;
  onPanelPress: (panelId: string) => void;
  onClearSelection: () => void;
};

const canvasPadding = 36;

function getFramePath(x: number, y: number, width: number, height: number, archHeight: number): string {
  const safeArchHeight = Math.min(height * 0.46, width / 2, Math.max(20, archHeight));
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
    Math.max(20, archHeight - inset),
  );
}

export const DesignCanvas = memo(function DesignCanvas({
  design,
  selectedNodeId,
  onPanelPress,
  onClearSelection,
}: DesignCanvasProps) {
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setCanvasSize({ width, height });
  }

  const layoutState = useMemo(() => {
    if (canvasSize.width <= 0 || canvasSize.height <= 0) {
      return { layout: null, error: null };
    }

    try {
      return {
        layout: calculateDesignLayout({
          rootNode: design.rootNode,
          designWidth: design.width,
          designHeight: design.height,
          canvasWidth: canvasSize.width,
          canvasHeight: canvasSize.height,
          padding: canvasPadding,
        }),
        error: null,
      };
    } catch (error) {
      return {
        layout: null,
        error: error instanceof DesignLayoutError ? error.message : 'Tasarim onizlemesi olusturulamadi.',
      };
    }
  }, [canvasSize.height, canvasSize.width, design.height, design.rootNode, design.width]);
  const frameNode = design.rootNode.type === 'frame' ? design.rootNode : null;
  const frameIsArch = frameNode ? isArchTopFrame(frameNode) : false;
  const archHeight = frameIsArch
    ? getArchHeight(frameNode!, design.height) * (layoutState.layout?.scale ?? 1)
    : 0;
  const framePath = layoutState.layout
    ? getFramePath(
        layoutState.layout.frameBounds.x,
        layoutState.layout.frameBounds.y,
        layoutState.layout.frameBounds.width,
        layoutState.layout.frameBounds.height,
        archHeight,
      )
    : '';
  const innerFramePath = layoutState.layout
    ? getInsetFramePath(
        layoutState.layout.frameBounds.x,
        layoutState.layout.frameBounds.y,
        layoutState.layout.frameBounds.width,
        layoutState.layout.frameBounds.height,
        archHeight,
        DESIGN_FRAME_INSET,
      )
    : '';
  const selectedPanel = layoutState.layout?.panelBounds.find((panel) => panel.nodeId === selectedNodeId) ?? null;
  const profileColor = getDesignProfileColor(design.profileSystem);
  const profilePalette = getProfilePalette(profileColor.hexValue);
  const shutterHeight =
    layoutState.layout && frameNode?.rollerShutter?.enabled
      ? Math.min(
          layoutState.layout.frameBounds.height * 0.34,
          Math.max(16, frameNode.rollerShutter.height * layoutState.layout.scale),
        )
      : 0;

  return (
    <View onLayout={handleLayout} style={styles.container}>
      {layoutState.error ? (
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Tasarim onizlemesi olusturulamadi.</Text>
        </View>
      ) : layoutState.layout ? (
        <>
        <Pressable
          accessibilityLabel="Panel secimini kaldir"
          onPress={onClearSelection}
          style={StyleSheet.absoluteFill}
        />
        <Svg pointerEvents="none" width={canvasSize.width} height={canvasSize.height}>
          <Defs>
            <LinearGradient id="glassGradient" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#9FDCF2" stopOpacity="0.92" />
              <Stop offset="0.48" stopColor="#EAF7FB" stopOpacity="0.96" />
              <Stop offset="1" stopColor="#B8E3F5" stopOpacity="0.92" />
            </LinearGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={canvasSize.width}
            height={canvasSize.height}
            fill="#ECEFED"
          />
          <Line
            x1={layoutState.layout.frameBounds.x}
            y1={layoutState.layout.frameBounds.y + layoutState.layout.frameBounds.height + 18}
            x2={layoutState.layout.frameBounds.x + layoutState.layout.frameBounds.width}
            y2={layoutState.layout.frameBounds.y + layoutState.layout.frameBounds.height + 18}
            stroke={colors.textPrimary}
            strokeWidth={1}
          />
          <Line
            x1={layoutState.layout.frameBounds.x - 18}
            y1={layoutState.layout.frameBounds.y}
            x2={layoutState.layout.frameBounds.x - 18}
            y2={layoutState.layout.frameBounds.y + layoutState.layout.frameBounds.height}
            stroke={colors.textPrimary}
            strokeWidth={1}
          />
          <SvgText
            x={layoutState.layout.frameBounds.x + layoutState.layout.frameBounds.width / 2}
            y={layoutState.layout.frameBounds.y + layoutState.layout.frameBounds.height + 34}
            fontSize={12}
            textAnchor="middle"
            fill={colors.textPrimary}
          >
            {design.width} mm
          </SvgText>
          <SvgText
            x={Math.max(12, layoutState.layout.frameBounds.x - 30)}
            y={layoutState.layout.frameBounds.y + layoutState.layout.frameBounds.height / 2}
            fontSize={12}
            textAnchor="middle"
            fill={colors.textPrimary}
            rotation="-90"
            origin={`${Math.max(12, layoutState.layout.frameBounds.x - 30)}, ${
              layoutState.layout.frameBounds.y + layoutState.layout.frameBounds.height / 2
            }`}
          >
            {design.height} mm
          </SvgText>
          {frameIsArch ? (
            <DimensionLine
              orientation="vertical"
              x1={layoutState.layout.frameBounds.x + layoutState.layout.frameBounds.width + 18}
              y1={layoutState.layout.frameBounds.y}
              x2={layoutState.layout.frameBounds.x + layoutState.layout.frameBounds.width + 18}
              y2={layoutState.layout.frameBounds.y + Math.min(archHeight, layoutState.layout.frameBounds.height * 0.46)}
              label={`${Math.round(archHeight / Math.max(layoutState.layout.scale, 0.001))} mm`}
            />
          ) : null}
          {shutterHeight > 0 && frameNode?.rollerShutter ? (
            <DimensionLine
              orientation="vertical"
              x1={layoutState.layout.frameBounds.x + layoutState.layout.frameBounds.width + 32}
              y1={layoutState.layout.frameBounds.y}
              x2={layoutState.layout.frameBounds.x + layoutState.layout.frameBounds.width + 32}
              y2={layoutState.layout.frameBounds.y + shutterHeight}
              label={`Panjur ${frameNode.rollerShutter.height} mm`}
            />
          ) : null}
          {selectedPanel ? (
            <>
              <DimensionLine
                orientation="horizontal"
                x1={selectedPanel.x}
                y1={selectedPanel.y + selectedPanel.height + 12}
                x2={selectedPanel.x + selectedPanel.width}
                y2={selectedPanel.y + selectedPanel.height + 12}
                label={`${Math.round(selectedPanel.realWidth)} mm`}
              />
              <DimensionLine
                orientation="vertical"
                x1={selectedPanel.x - 12}
                y1={selectedPanel.y}
                x2={selectedPanel.x - 12}
                y2={selectedPanel.y + selectedPanel.height}
                label={`${Math.round(selectedPanel.realHeight)} mm`}
              />
            </>
          ) : null}
          {frameIsArch ? (
            <>
              <Defs>
                <ClipPath id="editorFrameClip">
                  <Path d={innerFramePath} />
                </ClipPath>
              </Defs>
              <Path
                d={framePath}
                fill={profilePalette.outer}
                stroke={colors.textPrimary}
                strokeWidth={2.4}
              />
              <Path
                d={innerFramePath}
                fill={colors.surface}
                stroke={profilePalette.stroke}
                strokeWidth={2.4}
              />
              <Circle
                cx={layoutState.layout.frameBounds.x + layoutState.layout.frameBounds.width / 2}
                cy={layoutState.layout.frameBounds.y}
                r={5}
                fill={colors.primary}
              />
            </>
          ) : (
            <>
              <Rect
                x={layoutState.layout.frameBounds.x}
                y={layoutState.layout.frameBounds.y}
                width={layoutState.layout.frameBounds.width}
                height={layoutState.layout.frameBounds.height}
                fill={colors.surface}
                stroke={colors.textPrimary}
                strokeWidth={2.4}
              />
              <Rect
                x={layoutState.layout.frameBounds.x + DESIGN_FRAME_INSET}
                y={layoutState.layout.frameBounds.y + DESIGN_FRAME_INSET}
                width={layoutState.layout.frameBounds.width - DESIGN_FRAME_INSET * 2}
                height={layoutState.layout.frameBounds.height - DESIGN_FRAME_INSET * 2}
                fill="none"
                stroke={colors.border}
                strokeWidth={2.4}
              />
            </>
          )}
          {shutterHeight > 0 ? (
            <RollerShutterBox
              x={layoutState.layout.frameBounds.x}
              y={layoutState.layout.frameBounds.y}
              width={layoutState.layout.frameBounds.width}
              height={shutterHeight}
            />
          ) : null}
          {layoutState.layout.panelBounds.map((panel, index) => (
            <G key={panel.nodeId} clipPath={frameIsArch ? 'url(#editorFrameClip)' : undefined}>
              <DesignPanel
                panel={panel}
                index={index}
                selected={panel.nodeId === selectedNodeId}
                profilePalette={profilePalette}
              />
            </G>
          ))}
          <G clipPath={frameIsArch ? 'url(#editorFrameClip)' : undefined}>
            {layoutState.layout.splitBounds.map((split) => (
              <Line
                key={split.nodeId}
                x1={split.dividerX1}
                y1={split.dividerY1}
                x2={split.dividerX2}
                y2={split.dividerY2}
                stroke={colors.border}
                strokeWidth={DESIGN_SPLIT_STROKE_WIDTH}
              />
            ))}
            {layoutState.layout.panelBounds.map((panel) => (
              <OpeningSymbol key={`${panel.nodeId}-opening`} bounds={panel} openingType={panel.openingType} />
            ))}
          </G>
          {frameIsArch ? (
            <>
              <Path d={framePath} fill="none" stroke={colors.textPrimary} strokeWidth={2.4} />
              <Path d={innerFramePath} fill="none" stroke={profilePalette.stroke} strokeWidth={2.2} />
            </>
          ) : null}
        </Svg>
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {layoutState.layout.panelBounds.map((panel, index) => (
            <PanelPressTarget
              key={`${panel.nodeId}-press`}
              panel={panel}
              index={index}
              selected={panel.nodeId === selectedNodeId}
              onPress={onPanelPress}
            />
          ))}
        </View>
        </>
      ) : null}
    </View>
  );
});

function DesignPanel({
  panel,
  index,
  selected,
  profilePalette,
}: {
  panel: PanelBounds;
  index: number;
  selected: boolean;
  profilePalette: ProfilePalette;
}) {
  const profileInset = Math.max(5, Math.min(13, Math.min(panel.width, panel.height) * 0.09));
  const glassInset = profileInset + Math.max(4, Math.min(8, Math.min(panel.width, panel.height) * 0.04));
  const outerX = panel.x;
  const outerY = panel.y;
  const outerRight = panel.x + panel.width;
  const outerBottom = panel.y + panel.height;
  const innerX = panel.x + profileInset;
  const innerY = panel.y + profileInset;
  const innerRight = panel.x + panel.width - profileInset;
  const innerBottom = panel.y + panel.height - profileInset;

  return (
    <>
      <Polygon
        points={`${outerX},${outerY} ${outerRight},${outerY} ${innerRight},${innerY} ${innerX},${innerY}`}
        fill={mixHex(profilePalette.outer, '#FFFFFF', 0.6)}
        stroke={selected ? colors.primary : '#4C5753'}
        strokeWidth={selected ? 2.6 : 1.2}
      />
      <Polygon
        points={`${outerRight},${outerY} ${outerRight},${outerBottom} ${innerRight},${innerBottom} ${innerRight},${innerY}`}
        fill={mixHex(profilePalette.outer, '#17211E', 0.18)}
        stroke="#4C5753"
        strokeWidth={1.1}
      />
      <Polygon
        points={`${outerX},${outerBottom} ${outerRight},${outerBottom} ${innerRight},${innerBottom} ${innerX},${innerBottom}`}
        fill={mixHex(profilePalette.outer, '#17211E', 0.12)}
        stroke="#4C5753"
        strokeWidth={1.1}
      />
      <Polygon
        points={`${outerX},${outerY} ${innerX},${innerY} ${innerX},${innerBottom} ${outerX},${outerBottom}`}
        fill={mixHex(profilePalette.outer, '#FFFFFF', 0.38)}
        stroke="#4C5753"
        strokeWidth={1.1}
      />
      <Rect
        x={panel.x + glassInset}
        y={panel.y + glassInset}
        width={Math.max(0, panel.width - glassInset * 2)}
        height={Math.max(0, panel.height - glassInset * 2)}
        fill="url(#glassGradient)"
        stroke="#AEBBB7"
        strokeWidth={1.2}
      />
      {panel.insectScreen ? <InsectScreenOverlay panel={panel} inset={glassInset} /> : null}
      {selected ? (
        <>
          <Circle cx={panel.x + 6} cy={panel.y + 6} r={3} fill={colors.primary} />
          <Circle cx={panel.x + panel.width - 6} cy={panel.y + 6} r={3} fill={colors.primary} />
          <Circle cx={panel.x + 6} cy={panel.y + panel.height - 6} r={3} fill={colors.primary} />
          <Circle
            cx={panel.x + panel.width - 6}
            cy={panel.y + panel.height - 6}
            r={3}
            fill={colors.primary}
          />
        </>
      ) : null}
    </>
  );
}

function RollerShutterBox({
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
  const lineCount = Math.max(3, Math.floor(height / 9));
  const lines = Array.from({ length: lineCount }, (_, index) => y + ((index + 1) * height) / (lineCount + 1));

  return (
    <G>
      <Rect
        x={x + 5}
        y={y + 5}
        width={Math.max(0, width - 10)}
        height={Math.max(0, height - 10)}
        fill="#C9D0CF"
        stroke="#6F7B78"
        strokeWidth={1.5}
      />
      {lines.map((lineY) => (
        <Line
          key={`shutter-${lineY}`}
          x1={x + 12}
          y1={lineY}
          x2={x + width - 12}
          y2={lineY}
          stroke="#8A9693"
          strokeWidth={1}
        />
      ))}
    </G>
  );
}

function InsectScreenOverlay({ panel, inset }: { panel: PanelBounds; inset: number }) {
  const x = panel.x + inset + 2;
  const y = panel.y + inset + 2;
  const width = Math.max(0, panel.width - (inset + 2) * 2);
  const height = Math.max(0, panel.height - (inset + 2) * 2);
  const meshCount = Math.max(2, Math.min(7, Math.floor(width / 14)));
  const meshLines = Array.from({ length: meshCount }, (_, index) => x + ((index + 1) * width) / (meshCount + 1));
  const arrowY = y + height / 2;
  const arrowX = x + width / 2;

  return (
    <G>
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke="#166E61"
        strokeDasharray="4 3"
        strokeWidth={1.4}
      />
      {meshLines.map((lineX) => (
        <Line
          key={`screen-${panel.nodeId}-${lineX}`}
          x1={lineX}
          y1={y + 3}
          x2={lineX}
          y2={y + height - 3}
          stroke="#166E61"
          strokeOpacity={0.28}
          strokeWidth={0.8}
        />
      ))}
      {panel.insectScreen === 'sliding-horizontal' ? (
        <Path
          d={`M ${x + width * 0.25} ${arrowY} L ${x + width * 0.75} ${arrowY} M ${x + width * 0.25 + 6} ${arrowY - 5} L ${x + width * 0.25} ${arrowY} L ${x + width * 0.25 + 6} ${arrowY + 5} M ${x + width * 0.75 - 6} ${arrowY - 5} L ${x + width * 0.75} ${arrowY} L ${x + width * 0.75 - 6} ${arrowY + 5}`}
          stroke="#166E61"
          strokeWidth={1.5}
          fill="none"
        />
      ) : null}
      {panel.insectScreen === 'sliding-vertical' ? (
        <Path
          d={`M ${arrowX} ${y + height * 0.25} L ${arrowX} ${y + height * 0.75} M ${arrowX - 5} ${y + height * 0.25 + 6} L ${arrowX} ${y + height * 0.25} L ${arrowX + 5} ${y + height * 0.25 + 6} M ${arrowX - 5} ${y + height * 0.75 - 6} L ${arrowX} ${y + height * 0.75} L ${arrowX + 5} ${y + height * 0.75 - 6}`}
          stroke="#166E61"
          strokeWidth={1.5}
          fill="none"
        />
      ) : null}
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

function DimensionLine({
  orientation,
  x1,
  y1,
  x2,
  y2,
  label,
}: {
  orientation: 'horizontal' | 'vertical';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
}) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const tick = 4;

  if (orientation === 'horizontal') {
    return (
      <>
        <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.textSecondary} strokeWidth={1} />
        <Line x1={x1} y1={y1 - tick} x2={x1} y2={y1 + tick} stroke={colors.textSecondary} strokeWidth={1} />
        <Line x1={x2} y1={y2 - tick} x2={x2} y2={y2 + tick} stroke={colors.textSecondary} strokeWidth={1} />
        <Rect x={midX - 22} y={y1 - 8} width={44} height={16} rx={4} fill={colors.surface} />
        <SvgText x={midX} y={y1 + 4} fontSize={10} textAnchor="middle" fill={colors.textSecondary}>
          {label}
        </SvgText>
      </>
    );
  }

  return (
    <>
      <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.textSecondary} strokeWidth={1} />
      <Line x1={x1 - tick} y1={y1} x2={x1 + tick} y2={y1} stroke={colors.textSecondary} strokeWidth={1} />
      <Line x1={x2 - tick} y1={y2} x2={x2 + tick} y2={y2} stroke={colors.textSecondary} strokeWidth={1} />
      <Rect x={x1 - 22} y={midY - 8} width={44} height={16} rx={4} fill={colors.surface} />
      <SvgText x={x1} y={midY + 4} fontSize={10} textAnchor="middle" fill={colors.textSecondary}>
        {label}
      </SvgText>
    </>
  );
}

function PanelPressTarget({
  panel,
  index,
  selected,
  onPress,
}: {
  panel: PanelBounds;
  index: number;
  selected: boolean;
  onPress: (panelId: string) => void;
}) {
  const label = `Panel ${index + 1}, ${Math.round(panel.realWidth)} milimetre genislik, ${Math.round(
    panel.realHeight,
  )} milimetre yukseklik${selected ? ', secildi' : ''}`;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={() => onPress(panel.nodeId)}
      style={[
        styles.panelPressTarget,
        {
          height: panel.height,
          left: panel.x,
          top: panel.y,
          width: panel.width,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ECEFED',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 280,
    overflow: 'hidden',
  },
  errorState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
  },
  panelPressTarget: {
    position: 'absolute',
  },
});
