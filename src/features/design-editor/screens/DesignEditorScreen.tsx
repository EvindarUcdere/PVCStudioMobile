import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { routes } from '../../../constants/routes';
import {
  createCustomerRepository,
  createJobRepository,
} from '../../../database/repositories/createRepositories';
import { getPricingSettings } from '../../../database/repositories/PricingSettingsRepository';
import { Customer } from '../../../domain/customers/entities/Customer';
import {
  createCustomColorId,
  getDesignProfileColor,
  isValidHexColor,
  profileColorOptions,
} from '../../../domain/designs/colors/profileColorOptions';
import { OpeningType } from '../../../domain/designs/enums/OpeningType';
import { JobStatus } from '../../../domain/designs/enums/JobStatus';
import {
  defaultPriceEstimateRates,
  PriceEstimateRates,
} from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
import { isArchTopFrame } from '../../../domain/designs/utils/frameShape';
import { consumeDesignStock } from '../../../domain/inventory/consumeDesignStock';
import { JobProject } from '../../../domain/jobs/entities/JobProject';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';
import { CustomerSelector } from '../../customers/components/CustomerSelector';
import { JobStatusSelector } from '../../designs/components/JobStatusSelector';
import { DesignCanvas } from '../components/DesignCanvas';
import { DesignMaterialSummaryCard } from '../components/DesignMaterialSummaryCard';
import { DesignPriceEstimateCard } from '../components/DesignPriceEstimateCard';
import { DesignStockNeedsCard } from '../components/DesignStockNeedsCard';
import { DesignSpecificationPicker } from '../components/DesignSpecificationPicker';
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
    updateProfileSystem,
    updateDefaultGlass,
    updateCustomerId,
    updateJobStatus,
    updateJobName,
    updateJobId,
    saveDesign,
    undoLastChange,
    redoLastChange,
  } = useDesignEditor(designId);
  const [customColor, setCustomColor] = useState('#87552F');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<JobProject[]>([]);
  const [pricingRates, setPricingRates] = useState<PriceEstimateRates>(defaultPriceEstimateRates);
  const [addPanelSize, setAddPanelSize] = useState('');
  const canAdjustArch = design?.rootNode.type === 'frame' && isArchTopFrame(design.rootNode);
  const parsedAddPanelSize = parseOptionalPositiveNumber(addPanelSize);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadPricingRates() {
        try {
          const settings = await getPricingSettings();
          const customerRepository = await createCustomerRepository();
          const jobRepository = await createJobRepository();
          const loadedCustomers = await customerRepository.list({ limit: 100 });
          const loadedJobs = await jobRepository.list({ limit: 100 });
          if (isActive) {
            setPricingRates(settings);
            setCustomers(loadedCustomers);
            setJobs(loadedJobs);
          }
        } catch (loadError) {
          logger.error('Editor pricing settings load failed', loadError);
        }
      }

      void loadPricingRates();

      return () => {
        isActive = false;
      };
    }, []),
  );

  async function openQuote() {
    if (!design || isSaving) {
      return;
    }

    if (isDirty) {
      await saveDesign();
    }

    router.push(routes.designQuote(design.id));
  }

  function handleJobStatusChange(jobStatus: JobStatus) {
    updateJobStatus(jobStatus);

    if (!design || !shouldOfferStockConsumption(jobStatus)) {
      return;
    }

    Alert.alert(
      'Stoktan dusulsun mu?',
      'Bu isin tahmini profil, cam ve mekanizma ihtiyaci stoktan dusulecek. Ayni is icin tekrar dusme engellenir.',
      [
        { text: 'Hayir', style: 'cancel' },
        {
          text: 'Evet, dus',
          onPress: () => {
            void consumeStockForDesign();
          },
        },
      ],
    );
  }

  async function consumeStockForDesign() {
    if (!design) {
      return;
    }

    try {
      const result = await consumeDesignStock(design, pricingRates);
      if (result.status === 'already-consumed') {
        Alert.alert('Zaten dusulmus', 'Bu is icin stok daha once dusulmus.');
        return;
      }

      if (result.status === 'missing-stock') {
        Alert.alert('Stok yetersiz', result.message);
        return;
      }

      Alert.alert('Stok dusuldu', `${result.lines.length} stok satiri guncellendi.`);
    } catch (stockError) {
      logger.error('Design stock consumption failed', stockError);
      Alert.alert('Stok dusulemedi', 'Islem tamamlanamadi. Lutfen tekrar deneyin.');
    }
  }

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
            <ToolSection title="Kayit">
              <CustomerSelector
                customers={customers}
                selectedCustomerId={design.customerId}
                onSelectCustomer={updateCustomerId}
              />
              <TextInput
                accessibilityLabel="Is adi"
                onChangeText={(value) => updateJobName(nullableTrim(value))}
                placeholder="Is adi"
                placeholderTextColor={colors.textSecondary}
                style={styles.jobNameInput}
                value={design.jobName ?? ''}
              />
              <JobSelector jobs={jobs} selectedJobId={design.jobId} onSelectJob={updateJobId} />
              <JobStatusSelector value={design.jobStatus} onChange={handleJobStatusChange} />
              <View style={styles.row}>
                <AppButton
                  label="Geri al"
                  variant="secondary"
                  disabled={!canUndo}
                  onPress={undoLastChange}
                  style={styles.flexButton}
                />
                <AppButton
                  label="Ileri al"
                  variant="secondary"
                  disabled={!canRedo}
                  onPress={redoLastChange}
                  style={styles.flexButton}
                />
              </View>
              <AppButton
                label="Kaydet"
                disabled={!isDirty}
                loading={isSaving}
                onPress={() => void saveDesign()}
              />
              <AppButton
                label="Teklif Olustur"
                variant="secondary"
                disabled={isSaving}
                onPress={() => void openQuote()}
              />
            </ToolSection>
            <ToolSection title="Bol ve kaldir">
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
            </ToolSection>
            <ToolSection title="Birlestir">
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
            </ToolSection>
            <ToolSection title="Alan ekle">
              <View style={styles.addSizeRow}>
                <TextInput
                  accessibilityLabel="Eklenecek alan olcusu"
                  keyboardType="numeric"
                  onChangeText={setAddPanelSize}
                  placeholder="Secili alan kadar"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.addSizeInput}
                  value={addPanelSize}
                />
                <Text style={styles.addSizeSuffix}>mm</Text>
              </View>
              <View style={styles.row}>
                <AppButton
                  label="Sola ekle"
                  variant="secondary"
                  disabled={!selectedNodeId}
                  onPress={() => addPanelAtEdge('left', parsedAddPanelSize)}
                  style={styles.flexButton}
                />
                <AppButton
                  label="Saga ekle"
                  variant="secondary"
                  disabled={!selectedNodeId}
                  onPress={() => addPanelAtEdge('right', parsedAddPanelSize)}
                  style={styles.flexButton}
                />
              </View>
              <View style={styles.row}>
                <AppButton
                  label="Uste ekle"
                  variant="secondary"
                  disabled={!selectedNodeId}
                  onPress={() => addPanelAtEdge('top', parsedAddPanelSize)}
                  style={styles.flexButton}
                />
                <AppButton
                  label="Alta ekle"
                  variant="secondary"
                  disabled={!selectedNodeId}
                  onPress={() => addPanelAtEdge('bottom', parsedAddPanelSize)}
                  style={styles.flexButton}
                />
              </View>
            </ToolSection>
            {canAdjustArch ? (
              <ToolSection title="Kavis">
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
              </ToolSection>
            ) : null}
            <ToolSection title="Acilim tipi">
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
            </ToolSection>
            {saveMessage ? <Text style={styles.success}>{saveMessage}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
          <DesignSpecificationPicker
            design={design}
            rates={pricingRates}
            onSelectProfileSystem={updateProfileSystem}
            onSelectGlassType={updateDefaultGlass}
          />
          <ProfileColorPicker
            customColor={customColor}
            selectedColorId={getDesignProfileColor(design.profileSystem).id}
            onChangeCustomColor={setCustomColor}
            onSelectColor={updateSelectedProfileColor}
          />
          <DesignMaterialSummaryCard design={design} />
          <DesignPriceEstimateCard design={design} />
          <DesignStockNeedsCard design={design} rates={pricingRates} />
          <SelectedPanelSheet design={design} selectedNodeId={selectedNodeId} />
        </ScrollView>
      </View>
    </AppScreen>
  );
}

function ToolSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.toolSection}>
      <Text style={styles.toolTitle}>{title}</Text>
      {children}
    </View>
  );
}

function JobSelector({
  jobs,
  selectedJobId,
  onSelectJob,
}: {
  jobs: JobProject[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string | null) => void;
}) {
  if (jobs.length === 0) {
    return (
      <View style={styles.jobSelector}>
        <Text style={styles.toolTitle}>Bagli is</Text>
        <Text style={styles.caption}>Is yok. Diger &gt; Isler ekranindan is olusturabilirsiniz.</Text>
      </View>
    );
  }

  return (
    <View style={styles.jobSelector}>
      <Text style={styles.toolTitle}>Bagli is</Text>
      <View style={styles.optionGrid}>
        <AppButton
          label="Yok"
          variant={selectedJobId === null ? 'primary' : 'secondary'}
          onPress={() => onSelectJob(null)}
          style={styles.optionButton}
        />
        {jobs.slice(0, 8).map((job) => (
          <AppButton
            key={job.id}
            label={job.name}
            variant={selectedJobId === job.id ? 'primary' : 'secondary'}
            onPress={() => onSelectJob(job.id)}
            style={styles.optionButton}
          />
        ))}
      </View>
    </View>
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

function parseOptionalPositiveNumber(value: string): number | undefined {
  const normalized = value.replace(',', '.').trim();

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function nullableTrim(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function shouldOfferStockConsumption(jobStatus: JobStatus): boolean {
  return jobStatus === 'production' || jobStatus === 'installation' || jobStatus === 'done';
}

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
    gap: spacing.md,
  },
  toolSection: {
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
  addSizeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addSizeInput: {
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
  jobNameInput: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.textPrimary,
    minHeight: 42,
    paddingHorizontal: spacing.sm,
  },
  addSizeSuffix: {
    ...typography.caption,
    color: colors.textSecondary,
    width: 28,
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
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  jobSelector: {
    gap: spacing.xs,
  },
});
