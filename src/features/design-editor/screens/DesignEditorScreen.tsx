import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { routes } from '../../../constants/routes';
import { OpeningType } from '../../../domain/designs/enums/OpeningType';
import {
  createCustomColorId,
  getDesignProfileColor,
  isValidHexColor,
  profileColorOptions,
} from '../../../domain/designs/colors/profileColorOptions';
import { isArchTopFrame } from '../../../domain/designs/utils/frameShape';
import { colors, radius, spacing, typography } from '../../../theme';
import { DesignCanvas } from '../components/DesignCanvas';
import { SelectedPanelSheet } from '../components/SelectedPanelSheet';
import { useDesignEditor } from '../hooks/useDesignEditor';

export function DesignEditorScreen() {
  const { designId } = useLocalSearchParams<{ designId: string }>();
  const {
    design,
    selectedNodeId,
    isLoading,
    isSaving,
    isDirty,
    canUndo,
    canRedo,
    error,
    saveMessage,
    reload,
    selectPanelById,
    clearEditorSelection,
    splitSelectedPanel,
    removeSelectedPanel,
    updateSelectedOpening,
    addPanelAtEdge,
    mergeSelectedPanel,
    adjustSelectedArchHeight,
    updateSelectedProfileColor,
    saveDesign,
    undoLastChange,
    redoLastChange,
  } = useDesignEditor(designId);
  const [customColor, setCustomColor] = useState('#87552F');
  const canAdjustArch = design?.rootNode.type === 'frame' && isArchTopFrame(design.rootNode);

  if (isLoading) {
    return (
      <AppScreen centered scroll={false}>
        <ActivityIndicator color={colors.primary} />
      </AppScreen>
    );
  }

  if (!design) {
    return (
      <AppScreen centered>
        <EmptyState
          title="Tasarim acilamadi"
          description={error ?? 'Tasarim bulunamadi.'}
          action={<AppButton label="Tekrar Dene" onPress={() => void reload()} />}
        />
        <AppButton label="Tasarimlara Don" variant="ghost" onPress={() => router.replace(routes.designs)} />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false} contentStyle={styles.content}>
      <AppHeader
        title={design.name}
        subtitle={isDirty ? 'Degisiklikler kaydedilmedi' : 'Tasarim editoru'}
        rightAction={<AppButton label="Geri" variant="ghost" onPress={() => router.back()} />}
      />
      <View style={styles.editorBody}>
        <View style={styles.canvasWrap}>
          <DesignCanvas
            design={design}
            selectedNodeId={selectedNodeId}
            onPanelPress={selectPanelById}
            onClearSelection={clearEditorSelection}
          />
        </View>
        <ScrollView
          style={styles.sidePanel}
          contentContainerStyle={styles.sidePanelContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.meta}>
            Toplam olcu: {design.width} x {design.height} mm
          </Text>
          <View style={styles.tools}>
            <View style={styles.row}>
              <AppButton
                label="Geri al"
                variant="secondary"
                disabled={!canUndo}
                onPress={undoLastChange}
                style={styles.flexButton}
              />
              <AppButton
                label="Kaydet"
                disabled={!isDirty}
                loading={isSaving}
                onPress={() => void saveDesign()}
                style={styles.flexButton}
              />
            </View>
            <AppButton
              label="Ileri al"
              variant="secondary"
              disabled={!canRedo}
              onPress={redoLastChange}
            />
            <Text style={styles.toolTitle}>Yapilandirma</Text>
            <View style={styles.row}>
              <AppButton
                label="Dikey bol"
                variant="secondary"
                disabled={!selectedNodeId}
                onPress={() => splitSelectedPanel('vertical')}
                style={styles.flexButton}
              />
              <AppButton
                label="Yatay bol"
                variant="secondary"
                disabled={!selectedNodeId}
                onPress={() => splitSelectedPanel('horizontal')}
                style={styles.flexButton}
              />
            </View>
            <AppButton
              label="Secili alani kaldir"
              variant="ghost"
              disabled={!selectedNodeId}
              onPress={removeSelectedPanel}
            />
            <Text style={styles.toolTitle}>Birlestir</Text>
            <View style={styles.row}>
              <AppButton
                label="Solla"
                variant="secondary"
                disabled={!selectedNodeId}
                onPress={() => mergeSelectedPanel('left')}
                style={styles.flexButton}
              />
              <AppButton
                label="Sagla"
                variant="secondary"
                disabled={!selectedNodeId}
                onPress={() => mergeSelectedPanel('right')}
                style={styles.flexButton}
              />
            </View>
            <View style={styles.row}>
              <AppButton
                label="Ustle"
                variant="secondary"
                disabled={!selectedNodeId}
                onPress={() => mergeSelectedPanel('top')}
                style={styles.flexButton}
              />
              <AppButton
                label="Altla"
                variant="secondary"
                disabled={!selectedNodeId}
                onPress={() => mergeSelectedPanel('bottom')}
                style={styles.flexButton}
              />
            </View>
            <Text style={styles.toolTitle}>Alan ekle</Text>
            <View style={styles.row}>
              <AppButton
                label="Sola ekle"
                variant="secondary"
                disabled={!selectedNodeId}
                onPress={() => addPanelAtEdge('left')}
                style={styles.flexButton}
              />
              <AppButton
                label="Saga ekle"
                variant="secondary"
                disabled={!selectedNodeId}
                onPress={() => addPanelAtEdge('right')}
                style={styles.flexButton}
              />
            </View>
            <View style={styles.row}>
              <AppButton
                label="Uste ekle"
                variant="secondary"
                disabled={!selectedNodeId}
                onPress={() => addPanelAtEdge('top')}
                style={styles.flexButton}
              />
              <AppButton
                label="Alta ekle"
                variant="secondary"
                disabled={!selectedNodeId}
                onPress={() => addPanelAtEdge('bottom')}
                style={styles.flexButton}
              />
            </View>
            {canAdjustArch ? (
              <>
                <Text style={styles.toolTitle}>Kavis</Text>
                <View style={styles.row}>
                  <AppButton
                    label="Kavis -150"
                    variant="secondary"
                    onPress={() => adjustSelectedArchHeight(-150)}
                    style={styles.flexButton}
                  />
                  <AppButton
                    label="Kavis +150"
                    variant="secondary"
                    onPress={() => adjustSelectedArchHeight(150)}
                    style={styles.flexButton}
                  />
                </View>
              </>
            ) : null}
            <Text style={styles.toolTitle}>Acilim tipi</Text>
            <View style={styles.optionGrid}>
              {openingOptions.map((option) => (
                <AppButton
                  key={option.value}
                  label={option.label}
                  variant="secondary"
                  disabled={!selectedNodeId}
                  onPress={() => updateSelectedOpening(option.value)}
                  style={styles.optionButton}
                />
              ))}
            </View>
            {saveMessage ? <Text style={styles.success}>{saveMessage}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
          <ProfileColorPicker
            customColor={customColor}
            selectedColorId={getDesignProfileColor(design.profileSystem).id}
            onChangeCustomColor={setCustomColor}
            onSelectColor={updateSelectedProfileColor}
          />
          <SelectedPanelSheet design={design} selectedNodeId={selectedNodeId} />
        </ScrollView>
      </View>
    </AppScreen>
  );
}

function ProfileColorPicker({
  selectedColorId,
  customColor,
  onChangeCustomColor,
  onSelectColor,
}: {
  selectedColorId: string;
  customColor: string;
  onChangeCustomColor: (value: string) => void;
  onSelectColor: (colorId: string) => void;
}) {
  const customColorIsValid = isValidHexColor(customColor);

  return (
    <View style={styles.colorPanel}>
      <Text style={styles.toolTitle}>Cerceve rengi</Text>
      <View style={styles.colorGrid}>
        {profileColorOptions.map((option) => (
          <Pressable
            accessibilityLabel={`${option.name} cerceve rengini sec`}
            accessibilityRole="button"
            key={option.id}
            onPress={() => onSelectColor(option.id)}
            style={[
              styles.colorSwatch,
              selectedColorId === option.id ? styles.colorSwatchSelected : null,
            ]}
          >
            <View style={[styles.colorDot, { backgroundColor: option.hexValue }]} />
            <Text numberOfLines={1} style={styles.colorLabel}>
              {option.name}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.customColorRow}>
        <View style={[styles.customColorPreview, { backgroundColor: customColorIsValid ? customColor : '#FFFFFF' }]} />
        <TextInput
          accessibilityLabel="Ozel cerceve rengi"
          autoCapitalize="characters"
          maxLength={7}
          onChangeText={onChangeCustomColor}
          placeholder="#87552F"
          placeholderTextColor={colors.textSecondary}
          style={[styles.customColorInput, !customColorIsValid ? styles.inputError : null]}
          value={customColor}
        />
        <AppButton
          label="Ekle"
          variant="secondary"
          disabled={!customColorIsValid}
          onPress={() => onSelectColor(createCustomColorId(customColor))}
          style={styles.customColorButton}
        />
      </View>
    </View>
  );
}

const openingOptions: { label: string; value: OpeningType }[] = [
  { label: 'Sabit', value: 'fixed' },
  { label: 'Sol', value: 'open-left' },
  { label: 'Sag', value: 'open-right' },
  { label: 'Vasistas alt', value: 'tilt-top' },
  { label: 'Vasistas ust', value: 'tilt-bottom' },
  { label: 'Sol cift', value: 'tilt-turn-left' },
  { label: 'Sag cift', value: 'tilt-turn-right' },
  { label: 'Surme sol', value: 'sliding-left' },
  { label: 'Surme sag', value: 'sliding-right' },
];

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
  editorBody: {
    flex: 1,
    gap: spacing.md,
  },
  canvasWrap: {
    flex: 1,
    minHeight: 280,
  },
  sidePanel: {
    maxHeight: 360,
  },
  sidePanelContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  tools: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexButton: {
    flex: 1,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionButton: {
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  toolTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  colorPanel: {
    gap: spacing.sm,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorSwatch: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 4,
    minHeight: 58,
    padding: spacing.xs,
    width: '30.5%',
  },
  colorSwatchSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  colorDot: {
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    width: 28,
  },
  colorLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    fontSize: 11,
    textAlign: 'center',
  },
  customColorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  customColorPreview: {
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 42,
    width: 42,
  },
  customColorInput: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.textPrimary,
    flex: 1,
    minHeight: 42,
    paddingHorizontal: spacing.sm,
  },
  customColorButton: {
    minWidth: 78,
  },
  inputError: {
    borderColor: colors.error,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  success: {
    ...typography.caption,
    color: colors.success,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
});
