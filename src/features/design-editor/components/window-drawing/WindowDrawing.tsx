import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Stop } from 'react-native-svg';

import { colors } from '../../../../theme';
import { FixedGlassModule } from './FixedGlassModule';
import { FrameProfile } from './FrameProfile';
import { HardwareLayer } from './HardwareLayer';
import { MountingFrameLayer } from './MountingFrameLayer';
import { MullionProfile } from './MullionProfile';
import { SashProfile } from './SashProfile';
import { WallOpeningLayer } from './WallOpeningLayer';
import { createReferenceWindowGeometry, toPx } from './profileGeometry';

type WindowDrawingProps = {
  leftPanelId: string;
  rightPanelId: string;
  selectedNodeId: string | null;
  onPanelPress: (panelId: string) => void;
  onClearSelection: () => void;
  profileColor: string;
};

export function WindowDrawing({
  leftPanelId,
  rightPanelId,
  selectedNodeId,
  onPanelPress,
  onClearSelection,
  profileColor,
}: WindowDrawingProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const geometry = useMemo(
    () => (size.width > 0 && size.height > 0 ? createReferenceWindowGeometry(size.width, size.height) : null),
    [size.height, size.width],
  );

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }

  const leftTarget = geometry ? toPx(geometry.leftModule, geometry) : null;
  const rightTarget = geometry ? toPx(geometry.rightModule, geometry) : null;

  return (
    <View onLayout={handleLayout} style={styles.container}>
      <Pressable accessibilityLabel="Panel secimini kaldir" onPress={onClearSelection} style={StyleSheet.absoluteFill} />
      {geometry ? (
        <>
          <Svg pointerEvents="none" width={size.width} height={size.height}>
            <Defs>
              <LinearGradient id="referenceGlassGradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#A7DDF2" stopOpacity="0.9" />
                <Stop offset="0.48" stopColor="#F6FCFE" stopOpacity="0.98" />
                <Stop offset="1" stopColor="#C2EAF8" stopOpacity="0.94" />
              </LinearGradient>
            </Defs>
            <WallOpeningLayer width={size.width} height={size.height} />
            <G>
              <MountingFrameLayer geometry={geometry} />
              <FrameProfile geometry={geometry} color={profileColor} />
              <MullionProfile geometry={geometry} color={profileColor} />
              <FixedGlassModule geometry={geometry} />
              <SashProfile geometry={geometry} color={profileColor} />
              <HardwareLayer geometry={geometry} />
            </G>
          </Svg>
          {leftTarget ? (
            <Pressable
              accessibilityLabel={`Sol sabit panel${selectedNodeId === leftPanelId ? ', secildi' : ''}`}
              accessibilityRole="button"
              onPress={() => onPanelPress(leftPanelId)}
              style={[
                styles.target,
                {
                  height: leftTarget.height,
                  left: leftTarget.x,
                  top: leftTarget.y,
                  width: leftTarget.width,
                },
              ]}
            />
          ) : null}
          {rightTarget ? (
            <Pressable
              accessibilityLabel={`Sag acilir panel${selectedNodeId === rightPanelId ? ', secildi' : ''}`}
              accessibilityRole="button"
              onPress={() => onPanelPress(rightPanelId)}
              style={[
                styles.target,
                {
                  height: rightTarget.height,
                  left: rightTarget.x,
                  top: rightTarget.y,
                  width: rightTarget.width,
                },
              ]}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#eef2ef',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 280,
    overflow: 'hidden',
  },
  target: {
    position: 'absolute',
  },
});
