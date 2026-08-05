import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ReactNode, useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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
import { InsectScreenType } from '../../../domain/designs/entities/PanelNode';
import {
  createCustomColorId,
  getDesignProfileColor,
  isValidHexColor,
  profileColorOptions,
} from '../../../domain/designs/colors/profileColorOptions';
import { OpeningType } from '../../../domain/designs/enums/OpeningType';
import { JobStatus } from '../../../domain/designs/enums/JobStatus';
import { AddPanelInfillType } from '../../../domain/designs/utils/editDesignTree';
import { calculateDesignMaterialSummary } from '../../../domain/designs/measurement/calculateDesignMaterialSummary';
import {
  defaultPriceEstimateRates,
  PriceEstimateRates,
} from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
import { findNodeById } from '../../../domain/designs/utils/findNodeById';
import { isArchTopFrame } from '../../../domain/designs/utils/frameShape';
import { consumeDesignStock } from '../../../domain/inventory/consumeDesignStock';
import { JobProject } from '../../../domain/jobs/entities/JobProject';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';
import {
  maxDesignMeasurementMm,
  maxDesignQuantity,
  sanitizeIntegerInput,
} from '../../../utils/inputValidation';
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
    updateSelectedInsectScreen,
    toggleDesignRollerShutter,
    addPanelAtEdge,
    mergeSelectedPanel,
    adjustSelectedArchHeight,
    updateSelectedProfileColor,
    updateProfileSystem,
    updateDefaultGlass,
    updateCustomerId,
    updateJobStatus,
    updateJobName,
    updateQuantity,
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
  const [addPanelInfillType, setAddPanelInfillType] = useState<AddPanelInfillType>('glass');
  const sidePanelRef = useRef<ScrollView>(null);
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

  async function saveAndGoHome() {
    if (!design || isSaving) {
      return;
    }

    await saveDesign();
    router.replace(routes.home);
  }

  function handleBack() {
    if (!isDirty) {
      router.back();
      return;
    }

    Alert.alert(
      'Kaydedilmemis degisiklik var',
      'Cikarsaniz degisiklikler taslak olarak korunur. Yine de cikmak istiyor musunuz?',
      [
        { text: 'Vazgec', style: 'cancel' },
        { text: 'Cik', onPress: () => router.back() },
      ],
    );
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

  const selectedNode = selectedNodeId ? findNodeById(design.rootNode, selectedNodeId) : null;
  const selectedOpeningType = selectedNode?.type === 'panel' ? selectedNode.openingType : null;
  const selectedInsectScreen = selectedNode?.type === 'panel' ? (selectedNode.insectScreen ?? null) : null;
  const hasRollerShutter = design.rootNode.type === 'frame' && Boolean(design.rootNode.rollerShutter?.enabled);
  const profileInfo = getEditorProfileInfo(design);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
    <AppScreen scroll={false} contentStyle={styles.content}>
      <AppHeader
        title={design.name}
        subtitle={isDirty ? 'Degisiklikler kaydedilmedi' : 'Tasarim editoru'}
        rightAction={
          <View style={styles.headerActions}>
            <AppButton
              label="Kaydet"
              disabled={!isDirty}
              loading={isSaving}
              onPress={() => void saveAndGoHome()}
              style={styles.headerSaveButton}
            />
            <AppButton label="Geri" variant="ghost" onPress={handleBack} style={styles.headerBackButton} />
          </View>
        }
      />
      <View style={styles.editorBody}>
        <View style={styles.canvasWrap}>
          <DesignCanvas
            design={design}
            selectedNodeId={selectedNodeId}
            onPanelPress={selectPanelById}
            onClearSelection={clearEditorSelection}
          />
          <View pointerEvents="none" style={styles.canvasProfileBadge}>
            <Text numberOfLines={1} style={styles.canvasProfileTitle}>
              {profileInfo.system}
            </Text>
            <Text numberOfLines={1} style={styles.canvasProfileSubtitle}>
              Ana kasa: {profileInfo.frame}
            </Text>
          </View>
        </View>
        <ScrollView
          ref={sidePanelRef}
          style={styles.sidePanel}
          contentContainerStyle={styles.sidePanelContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.meta}>
            Toplam olcu: {design.width} x {design.height} mm
          </Text>
          <View style={styles.profileInfoCard}>
            <View style={styles.profileInfoRow}>
              <Text style={styles.profileInfoLabel}>Profil sistemi</Text>
              <Text numberOfLines={1} style={styles.profileInfoValue}>
                {profileInfo.system}
              </Text>
            </View>
            <View style={styles.profileInfoRow}>
              <Text style={styles.profileInfoLabel}>Ana kasa</Text>
              <Text numberOfLines={1} style={styles.profileInfoValue}>
                {profileInfo.frame}
              </Text>
            </View>
          </View>
          <View style={styles.tools}>
            <ToolSection title="Is, musteri ve adet">
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
              <TextInput
                accessibilityLabel="Adet"
                keyboardType="numeric"
                onChangeText={(value) => {
                  const parsed = Number(sanitizeIntegerInput(value));
                  if (Number.isInteger(parsed) && parsed > 0 && parsed <= maxDesignQuantity) {
                    updateQuantity(parsed);
                  }
                }}
                placeholder="Adet"
                placeholderTextColor={colors.textSecondary}
                style={styles.jobNameInput}
                value={String(design.quantity)}
              />
              <Text style={styles.caption}>
                Ayni tasarimdan kac adet uretilecekse buraya yazin. Ornek: bu pencereden 5 tane varsa adet 5.
              </Text>
              <JobStatusSelector value={design.jobStatus} onChange={handleJobStatusChange} />
              <AppButton
                label={hasRollerShutter ? 'Panjur alanini kaldir' : 'Panjur alani ekle'}
                variant="secondary"
                onPress={toggleDesignRollerShutter}
              />
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
                label="Teklif / Odeme Olustur"
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
                  onChangeText={(value) => setAddPanelSize(sanitizeIntegerInput(value))}
                  placeholder="Secili alan kadar"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.addSizeInput}
                  value={addPanelSize}
                />
                <Text style={styles.addSizeSuffix}>mm</Text>
              </View>
              <Text style={styles.caption}>
                Yeni alan dis olcuyu buyutmaz; mevcut toplam olcu icinde pay acilir.
              </Text>
              <View style={styles.row}>
                <AppButton
                  label="Cam"
                  variant={addPanelInfillType === 'glass' ? 'primary' : 'secondary'}
                  onPress={() => setAddPanelInfillType('glass')}
                  style={styles.flexButton}
                />
                <AppButton
                  label="PVC dolgu"
                  variant={addPanelInfillType === 'pvc_panel' ? 'primary' : 'secondary'}
                  onPress={() => setAddPanelInfillType('pvc_panel')}
                  style={styles.flexButton}
                />
              </View>
              <View style={styles.row}>
                <AppButton
                  label="Sola ekle"
                  variant="secondary"
                  disabled={!selectedNodeId}
                  onPress={() => addPanelAtEdge('left', parsedAddPanelSize, addPanelInfillType)}
                  style={styles.flexButton}
                />
                <AppButton
                  label="Saga ekle"
                  variant="secondary"
                  disabled={!selectedNodeId}
                  onPress={() => addPanelAtEdge('right', parsedAddPanelSize, addPanelInfillType)}
                  style={styles.flexButton}
                />
              </View>
              <View style={styles.row}>
                <AppButton
                  label="Uste ekle"
                  variant="secondary"
                  disabled={!selectedNodeId}
                  onPress={() => addPanelAtEdge('top', parsedAddPanelSize, addPanelInfillType)}
                  style={styles.flexButton}
                />
                <AppButton
                  label="Alta ekle"
                  variant="secondary"
                  disabled={!selectedNodeId}
                  onPress={() => addPanelAtEdge('bottom', parsedAddPanelSize, addPanelInfillType)}
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
                    variant={selectedOpeningType === option.value ? 'primary' : 'secondary'}
                    disabled={!selectedNodeId}
                    onPress={() => updateSelectedOpening(option.value)}
                    style={styles.optionButton}
                  />
                ))}
              </View>
            </ToolSection>
            <ToolSection title="Sineklik">
              <Text style={styles.caption}>
                Once cizimden bir panel secin. Sabit sineklik her panelde, surme sineklik acilir panellerde kullanilir.
              </Text>
              <View style={styles.optionGrid}>
                {insectScreenOptions.map((option) => (
                  <AppButton
                    key={option.value ?? 'none'}
                    label={option.label}
                    variant={selectedInsectScreen === option.value ? 'primary' : 'secondary'}
                    disabled={!selectedOpeningType || !canUseInsectScreenOption(selectedOpeningType, option.value)}
                    onPress={() => updateSelectedInsectScreen(option.value)}
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
            onCustomColorFocus={() => {
              setTimeout(() => sidePanelRef.current?.scrollToEnd({ animated: true }), 120);
            }}
            onSelectColor={updateSelectedProfileColor}
          />
          <DesignMaterialSummaryCard design={design} />
          <DesignPriceEstimateCard design={design} />
          <DesignStockNeedsCard design={design} rates={pricingRates} />
          <SelectedPanelSheet design={design} selectedNodeId={selectedNodeId} />
        </ScrollView>
      </View>
    </AppScreen>
    </KeyboardAvoidingView>
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
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR');
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;
  const filteredJobs = normalizedSearch
    ? jobs
        .filter((job) => job.name.toLocaleLowerCase('tr-TR').includes(normalizedSearch))
        .slice(0, 5)
    : [];

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
      <TextInput
        accessibilityLabel="Bagli is ara"
        onChangeText={setSearch}
        placeholder={selectedJob ? selectedJob.name : 'Is ara ve bagla'}
        placeholderTextColor={colors.textSecondary}
        style={styles.jobNameInput}
        value={search}
      />
      {selectedJob ? (
        <View style={styles.selectedJobRow}>
          <Text numberOfLines={1} style={styles.selectedJobText}>
            {selectedJob.name}
          </Text>
          <AppButton label="Kaldir" variant="ghost" onPress={() => onSelectJob(null)} />
        </View>
      ) : null}
      {filteredJobs.length > 0 ? (
        <View style={styles.searchResults}>
          {filteredJobs.map((job) => (
            <Pressable
              accessibilityRole="button"
              key={`job-search-${job.id}`}
              onPress={() => {
                onSelectJob(job.id);
                setSearch('');
              }}
              style={styles.searchResult}
            >
              <Text numberOfLines={1} style={styles.searchResultText}>
                {job.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {!normalizedSearch ? null : filteredJobs.length === 0 ? (
        <Text style={styles.caption}>Eslesen is bulunamadi.</Text>
      ) : null}
    </View>
  );
}

function ProfileColorPicker({
  selectedColorId,
  customColor,
  onChangeCustomColor,
  onCustomColorFocus,
  onSelectColor,
}: {
  selectedColorId: string;
  customColor: string;
  onChangeCustomColor: (value: string) => void;
  onCustomColorFocus: () => void;
  onSelectColor: (colorId: string) => void;
}) {
  const customColorIsValid = isValidHexColor(customColor);
  const selectedPreset = profileColorOptions.find((option) => option.id === selectedColorId);

  return (
    <View style={styles.colorPanel}>
      <Text style={styles.toolTitle}>Cerceve rengi</Text>
      <Text style={styles.caption}>
        Secili renk kodu: {selectedPreset?.hexValue ?? customColor.toUpperCase()}
      </Text>
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
            <Text numberOfLines={1} style={styles.colorCode}>
              {option.hexValue}
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
          onFocus={onCustomColorFocus}
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

const insectScreenOptions: { label: string; value: InsectScreenType | null }[] = [
  { label: 'Yok', value: null },
  { label: 'Sabit', value: 'fixed' },
  { label: 'Surme sag/sol', value: 'sliding-horizontal' },
  { label: 'Surme yukari', value: 'sliding-vertical' },
];

function canUseInsectScreenOption(openingType: OpeningType, insectScreen: InsectScreenType | null): boolean {
  if (insectScreen === null || insectScreen === 'fixed') {
    return true;
  }

  return openingType !== 'fixed';
}

function parseOptionalPositiveNumber(value: string): number | undefined {
  const normalized = value.replace(',', '.').trim();

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= maxDesignMeasurementMm ? parsed : undefined;
}

function nullableTrim(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function shouldOfferStockConsumption(jobStatus: JobStatus): boolean {
  return jobStatus === 'production' || jobStatus === 'installation' || jobStatus === 'done';
}

function getEditorProfileInfo(design: NonNullable<ReturnType<typeof useDesignEditor>['design']>) {
  const summary = calculateDesignMaterialSummary(design);
  const profileSystem = design.profileSystem;
  const system = profileSystem?.productionProfileSystemId
    ? `${profileSystem.productionProfileSystemName ?? profileSystem.productionProfileSystemId} v${
        profileSystem.productionProfileSystemVersion ?? '-'
      }`
    : `${summary.profileName} (yaklasik)`;
  const frameCode = profileSystem?.productionFrameProfileCode?.trim();

  return {
    system,
    frame: frameCode ? `${frameCode} / ${summary.frameWidth} mm` : `Kasa ${summary.frameWidth} mm; kod secilmedi`,
  };
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
  },
  editorBody: {
    flex: 1,
    gap: spacing.md,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  headerSaveButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerBackButton: {
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  canvasWrap: {
    flex: 1,
    minHeight: 280,
    position: 'relative',
  },
  sidePanel: {
    maxHeight: 360,
  },
  sidePanelContent: {
    gap: spacing.sm,
    paddingBottom: 180,
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
    minHeight: 72,
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
  colorCode: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
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
  profileInfoCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  profileInfoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  profileInfoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  profileInfoValue: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '800',
    textAlign: 'right',
  },
  canvasProfileBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    bottom: spacing.sm,
    left: spacing.sm,
    maxWidth: '82%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    position: 'absolute',
  },
  canvasProfileTitle: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  canvasProfileSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
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
  selectedJobRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  selectedJobText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '700',
  },
  searchResults: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  searchResult: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  searchResultText: {
    ...typography.body,
    color: colors.textPrimary,
  },
});
