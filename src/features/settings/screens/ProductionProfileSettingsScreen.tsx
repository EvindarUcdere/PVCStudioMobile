import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { ReactNode, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { getCompanyProfile } from '../../../database/repositories/CompanyProfileRepository';
import { calculateFixedGlassProduction } from '../../../domain/production-calculation/productionFrameCalculator';
import {
  CalculationTraceItem,
  FixedGlassPiece,
  FrameCutPiece,
  ProductionCalculationResult,
  ProductionProfileSystem,
} from '../../../domain/production-calculation/types';
import {
  listProductionProfileSystemsFromCloud,
  saveProductionProfileSystemToCloud,
} from '../../../services/firebase/productionProfileSystemCloudService';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';
import {
  AdjustmentOperation,
  canVerifyProfileSystem,
  emptyProductionProfileFormValues,
  getCompletionSummary,
  parseDecimal,
  ProductionProfileFormValues,
  shouldDowngradeVerifiedEdit,
  shouldShowWeldingAllowance,
  toProductionProfileFormValues,
  toProductionProfileSystem,
} from '../utils/productionProfileForm';

const newProfileSystemId = () => `profile-system-${Date.now()}`;

export function ProductionProfileSettingsScreen() {
  const [profiles, setProfiles] = useState<ProductionProfileSystem[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ProductionProfileSystem | null>(null);
  const [values, setValues] = useState<ProductionProfileFormValues>(emptyProductionProfileFormValues);
  const [companyId, setCompanyId] = useState('local-company');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calculationWidthMm, setCalculationWidthMm] = useState('1200');
  const [calculationHeightMm, setCalculationHeightMm] = useState('1500');
  const [calculationResult, setCalculationResult] = useState<ProductionCalculationResult | null>(null);

  const completion = useMemo(() => getCompletionSummary(values), [values]);
  const isVerified = values.markVerified && completion.missingLabels.length === 0;

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function load() {
        setIsLoading(true);
        setError(null);
        try {
          const profile = await getCompanyProfile();
          const normalizedCompanyId = profile.companyId.trim() || 'local-company';
          const savedProfiles = await listProductionProfileSystemsFromCloud(normalizedCompanyId);
          const firstProfile = savedProfiles[0] ?? null;

          if (isActive) {
            setCompanyId(normalizedCompanyId);
            setProfiles(savedProfiles);
            setSelectedProfile(firstProfile);
            setValues(firstProfile ? toProductionProfileFormValues(firstProfile) : emptyProductionProfileFormValues);
          }
        } catch (loadError) {
          logger.error('Production profile settings load failed', loadError);
          if (isActive) {
            setError('Profil sistemi ayarları yüklenemedi.');
          }
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      }

      void load();

      return () => {
        isActive = false;
      };
    }, []),
  );

  function selectProfile(profile: ProductionProfileSystem) {
    setSelectedProfile(profile);
    setValues(toProductionProfileFormValues(profile));
    setCalculationResult(null);
    setMessage(null);
    setError(null);
  }

  function startNewProfile() {
    setSelectedProfile(null);
    setValues(emptyProductionProfileFormValues);
    setCalculationResult(null);
    setMessage(null);
    setError(null);
  }

  function updateValue<K extends keyof ProductionProfileFormValues>(
    key: K,
    value: ProductionProfileFormValues[K],
  ) {
    setValues((current) => ({
      ...current,
      [key]: value,
      markVerified: current.markVerified && key !== 'markVerified' ? false : current.markVerified,
    }));
    setMessage(null);
    setError(null);
    setCalculationResult(null);
  }

  function updateAdjustment(
    key: 'horizontalFrameAdjustment' | 'verticalFrameAdjustment',
    value: ProductionProfileFormValues['horizontalFrameAdjustment'],
  ) {
    updateValue(key, value);
  }

  function toggleVerified(nextValue: boolean) {
    if (!nextValue) {
      updateValue('markVerified', false);
      return;
    }

    const verification = canVerifyProfileSystem(values);
    if (!verification.canVerify) {
      setError(`Doğrulama için eksik alanlar: ${verification.missingLabels.join(', ')}`);
      setMessage(null);
      return;
    }

    updateValue('markVerified', true);
  }

  async function save() {
    const now = new Date().toISOString();
    const id = selectedProfile?.id ?? newProfileSystemId();
    const parsed = toProductionProfileSystem(values, companyId, id, selectedProfile, now);

    if (!parsed) {
      setError('Zorunlu alanları ve sayısal teknik değerleri kontrol edin. Negatif değer kaydedilmez.');
      return;
    }

    const downgradeWarning = shouldDowngradeVerifiedEdit(selectedProfile, values);

    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await saveProductionProfileSystemToCloud(parsed);
      if (!saved) {
        setError('Profil sistemi Firebase uzerine kaydedilemedi. Firma lisansi ve internet baglantisini kontrol edin.');
        return;
      }

      const nextProfiles = await listProductionProfileSystemsFromCloud(companyId);
      setProfiles(nextProfiles);
      setSelectedProfile(saved);
      setValues(toProductionProfileFormValues(saved));
      setMessage(
        downgradeWarning
          ? 'Doğrulanmış teknik verileri değiştirdiniz. Yeni sürümleme hazır olmadığı için profil tekrar taslak durumuna alındı.'
          : saved.status === 'VERIFIED'
            ? 'Profil sistemi doğrulanmış olarak kaydedildi.'
            : 'Profil sistemi taslak olarak kaydedildi.',
      );
    } catch (saveError) {
      logger.error('Production profile settings save failed', saveError);
      setError('Profil sistemi kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveSelectedProfile() {
    if (!selectedProfile || selectedProfile.status === 'ARCHIVED') {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const archived = await saveProductionProfileSystemToCloud({
        ...selectedProfile,
        status: 'ARCHIVED',
        updatedAt: new Date().toISOString(),
      });
      if (!archived) {
        setError('Profil sistemi Firebase uzerinde pasife alinamadi.');
        return;
      }

      const nextProfiles = await listProductionProfileSystemsFromCloud(companyId);
      setProfiles(nextProfiles);
      setSelectedProfile(archived);
      setValues(toProductionProfileFormValues(archived));
      setMessage('Profil sistemi pasife alındı. Eski sipariş kayıtları korunur.');
    } catch (archiveError) {
      logger.error('Production profile archive failed', archiveError);
      setError('Profil sistemi pasife alınamadı.');
    } finally {
      setIsSaving(false);
    }
  }

  function calculateFrame() {
    const widthMm = parseDecimal(calculationWidthMm);
    const heightMm = parseDecimal(calculationHeightMm);

    if (!selectedProfile) {
      setCalculationResult(
        calculateFixedGlassProduction(
          {
            calculationMode: 'PRODUCTION',
            designId: 'manual-fixed-frame-preview',
            widthMm: widthMm ?? 0,
            heightMm: heightMm ?? 0,
            profileSystemId: 'missing',
            profileSystemVersion: values.version,
          },
          null,
        ),
      );
      return;
    }

    setCalculationResult(
      calculateFixedGlassProduction(
        {
          calculationMode: 'PRODUCTION',
          designId: 'manual-fixed-frame-preview',
          widthMm: widthMm ?? 0,
          heightMm: heightMm ?? 0,
          profileSystemId: selectedProfile.id,
          profileSystemVersion: selectedProfile.version,
        },
        selectedProfile,
      ),
    );
  }

  if (isLoading) {
    return (
      <AppScreen centered>
        <ActivityIndicator color={colors.primary} />
      </AppScreen>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
      <AppScreen scroll={false}>
        <AppHeader
          title="Profil Sistemi"
          subtitle="Kesin üretim hesabı için teknik veriler."
          rightAction={<AppButton label="Geri" variant="ghost" onPress={() => router.back()} />}
        />
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <ProfileList profiles={profiles} selectedId={selectedProfile?.id ?? null} onSelect={selectProfile} />
          <AppButton label="+ Yeni Profil Sistemi" variant="secondary" onPress={startNewProfile} />

          <StatusCard completion={completion} isVerified={isVerified} archived={selectedProfile?.status === 'ARCHIVED'} />

          <View style={styles.verifyRow}>
            <View style={styles.verifyText}>
              <Text style={styles.label}>Teknik verileri doğruladım</Text>
              <Text style={styles.caption}>
                Bu verilerin üretici belgesi, mevcut üretim föyü veya atölye makine ayarıyla
                doğrulandığını onaylıyorum.
              </Text>
            </View>
            <Switch
              value={values.markVerified}
              onValueChange={toggleVerified}
              trackColor={{ false: colors.border, true: colors.primaryPressed }}
              thumbColor={values.markVerified ? colors.primary : colors.surface}
            />
          </View>

          <Section title="Genel">
            <Field label="Profil sistemi adı" value={values.displayName} onChangeText={(value) => updateValue('displayName', value)} />
            <Field label="Marka" value={values.brand} onChangeText={(value) => updateValue('brand', value)} />
            <Field label="Seri adı" value={values.seriesName} onChangeText={(value) => updateValue('seriesName', value)} />
            <Field label="Sürüm" value={values.version} onChangeText={(value) => updateValue('version', value)} />
          </Section>

          <Section title="Profil Parcalari">
            <Field label="Ana kasa profil kodu" value={values.frameProfileCode} onChangeText={(value) => updateValue('frameProfileCode', value)} />
            <Field label="Kanat profil kodu" value={values.sashProfileCode} onChangeText={(value) => updateValue('sashProfileCode', value)} />
            <Field label="Orta kayit profil kodu" value={values.mullionProfileCode} onChangeText={(value) => updateValue('mullionProfileCode', value)} />
            <Field label="Yatay / T kayit profil kodu" value={values.transomProfileCode} onChangeText={(value) => updateValue('transomProfileCode', value)} />
            <Field label="Cam citasi profil kodu" value={values.glazingBeadProfileCode} onChangeText={(value) => updateValue('glazingBeadProfileCode', value)} />
            <Field label="Conta kodu" value={values.gasketCode} onChangeText={(value) => updateValue('gasketCode', value)} />
            <Field label="Aksesuar / donanim seti kodu" value={values.hardwareSetCode} onChangeText={(value) => updateValue('hardwareSetCode', value)} />
            <NumberField label="Profil stok boyu" suffix="mm" value={values.stockLengthMm} onChangeText={(value) => updateValue('stockLengthMm', value)} />
          </Section>

          <Section title="Kaynak Payı">
            <View style={styles.modeGrid}>
              <ModeButton
                label="Kesime ekle"
                description="Kaynak payı uygulama tarafından profil kesim ölçüsüne eklenir."
                selected={values.weldingAllowanceMode === 'ADD_TO_CUT_LENGTH'}
                onPress={() => updateValue('weldingAllowanceMode', 'ADD_TO_CUT_LENGTH')}
              />
              <ModeButton
                label="Makine ekliyor"
                description="Kaynak payını üretim makinesi otomatik uygular."
                selected={values.weldingAllowanceMode === 'INCLUDED_BY_MACHINE'}
                onPress={() => updateValue('weldingAllowanceMode', 'INCLUDED_BY_MACHINE')}
              />
              <ModeButton
                label="Uygulanmaz"
                description="Bu sistemde kaynak payı kullanılmaz."
                selected={values.weldingAllowanceMode === 'NOT_APPLICABLE'}
                onPress={() => updateValue('weldingAllowanceMode', 'NOT_APPLICABLE')}
              />
            </View>
            {shouldShowWeldingAllowance(values.weldingAllowanceMode) ? (
              <NumberField
                label="Her uç için kaynak payı"
                suffix="mm"
                value={values.weldingAllowanceMmPerEnd}
                onChangeText={(value) => updateValue('weldingAllowanceMmPerEnd', value)}
              />
            ) : null}
          </Section>

          <Pressable style={styles.accordionHeader} onPress={() => setIsAdvancedOpen((current) => !current)}>
            <Text style={styles.sectionTitle}>Gelişmiş Teknik Ayarlar</Text>
            <Ionicons
              name={isAdvancedOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
              size={22}
              color={colors.primary}
            />
          </Pressable>

          {isAdvancedOpen ? (
            <Section>
              <AdjustmentField
                label="Yatay kasa ekleme/düşüm"
                value={values.horizontalFrameAdjustment}
                onChange={(value) => updateAdjustment('horizontalFrameAdjustment', value)}
              />
              <AdjustmentField
                label="Dikey kasa ekleme/düşüm"
                value={values.verticalFrameAdjustment}
                onChange={(value) => updateAdjustment('verticalFrameAdjustment', value)}
              />
              <NumberField label="Yatay kesim açısı" suffix="derece" value={values.horizontalCutAngleDeg} onChangeText={(value) => updateValue('horizontalCutAngleDeg', value)} />
              <NumberField label="Dikey kesim açısı" suffix="derece" value={values.verticalCutAngleDeg} onChangeText={(value) => updateValue('verticalCutAngleDeg', value)} />
              <NumberField label="Testere bıçak payı" suffix="mm" value={values.sawKerfMm} onChangeText={(value) => updateValue('sawKerfMm', value)} />
              <NumberField label="Başlangıç kırpma payı" suffix="mm" value={values.startTrimMm} onChangeText={(value) => updateValue('startTrimMm', value)} />
              <NumberField label="Bitiş kırpma payı" suffix="mm" value={values.endTrimMm} onChangeText={(value) => updateValue('endTrimMm', value)} />
              <Text style={styles.subsectionTitle}>Cam Kuralları</Text>
              <NumberField label="Sabit cam sol düşüm" suffix="mm" value={values.fixedGlassDeductionLeftMm} onChangeText={(value) => updateValue('fixedGlassDeductionLeftMm', value)} />
              <NumberField label="Sabit cam sağ düşüm" suffix="mm" value={values.fixedGlassDeductionRightMm} onChangeText={(value) => updateValue('fixedGlassDeductionRightMm', value)} />
              <NumberField label="Sabit cam üst düşüm" suffix="mm" value={values.fixedGlassDeductionTopMm} onChangeText={(value) => updateValue('fixedGlassDeductionTopMm', value)} />
              <NumberField label="Sabit cam alt düşüm" suffix="mm" value={values.fixedGlassDeductionBottomMm} onChangeText={(value) => updateValue('fixedGlassDeductionBottomMm', value)} />
              <Field label="Kaynak belge" value={values.source} onChangeText={(value) => updateValue('source', value)} />
              <Field label="Not" value={values.note} onChangeText={(value) => updateValue('note', value)} multiline />
            </Section>
          ) : null}

          <ProductionCalculationCard
            widthMm={calculationWidthMm}
            heightMm={calculationHeightMm}
            result={calculationResult}
            onChangeWidth={setCalculationWidthMm}
            onChangeHeight={setCalculationHeightMm}
            onCalculate={calculateFrame}
          />

          {message ? <Text style={styles.success}>{message}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <AppButton label="Kaydet" loading={isSaving} disabled={isSaving} onPress={() => void save()} />
          {selectedProfile ? (
            <AppButton
              label="Pasife Al"
              variant="secondary"
              disabled={isSaving || selectedProfile.status === 'ARCHIVED'}
              onPress={() => void archiveSelectedProfile()}
            />
          ) : null}
        </ScrollView>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

function ProductionCalculationCard({
  widthMm,
  heightMm,
  result,
  onChangeWidth,
  onChangeHeight,
  onCalculate,
}: {
  widthMm: string;
  heightMm: string;
  result: ProductionCalculationResult | null;
  onChangeWidth: (value: string) => void;
  onChangeHeight: (value: string) => void;
  onCalculate: () => void;
}) {
  return (
    <View style={styles.calculationCard}>
      <View style={styles.calculationHeader}>
        <View style={styles.calculationTitleWrap}>
          <Text style={styles.sectionTitle}>Sabit Tek Göz Kasa ve Cam Hesabı</Text>
          <Text style={styles.caption}>
            Seçili profil sistemindeki doğrulanmış teknik verilerle sadece dış kasa kesim listesi oluşur.
          </Text>
        </View>
        <Ionicons name="cut-outline" size={22} color={colors.primary} />
      </View>
      <View style={styles.dimensionGrid}>
        <NumberField label="Genişlik" suffix="mm" value={widthMm} onChangeText={onChangeWidth} />
        <NumberField label="Yükseklik" suffix="mm" value={heightMm} onChangeText={onChangeHeight} />
      </View>
      <AppButton label="Kasa Hesabını Oluştur" onPress={onCalculate} />
      {result ? <ProductionCalculationResultView result={result} /> : null}
    </View>
  );
}

function ProductionCalculationResultView({ result }: { result: ProductionCalculationResult }) {
  if (!result.ok) {
    return (
      <View style={styles.calculationError}>
        <Text style={styles.errorTitle}>Kesin üretim hesabı oluşturulamadı.</Text>
        <Text style={styles.caption}>
          Bu profil sistemi için doğrulanmış üretim verileri eksik. Yaklaşık teklif hazırlanabilir
          ancak kesin kesim listesi oluşturulamaz.
        </Text>
        {result.issues.map((issue) => (
          <Text key={`${issue.code}-${issue.field ?? 'general'}`} style={styles.error}>
            - {issue.message}
          </Text>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.calculationResult}>
      <Text style={styles.resultTitle}>Kesim Parçaları</Text>
      {result.frameCuts.map((piece) => (
        <FrameCutView key={piece.orientation} piece={piece} />
      ))}
      {result.fixedGlass ? <FixedGlassView glass={result.fixedGlass} /> : null}
      <Text style={styles.snapshotText}>
        Snapshot: {result.profileSystemSnapshot.displayName} v{result.profileSystemSnapshot.version} -
        motor {result.engineVersion}
      </Text>
    </View>
  );
}

function FixedGlassView({ glass }: { glass: FixedGlassPiece }) {
  return (
    <View style={styles.cutPiece}>
      <View style={styles.cutPieceHeader}>
        <Text style={styles.cutPieceTitle}>Sabit cam</Text>
        <Text style={styles.cutPieceValue}>
          {glass.quantity} adet x {glass.widthMm} x {glass.heightMm} mm
        </Text>
      </View>
      <Text style={styles.caption}>Cam alanı: {glass.areaSquareMeters} m²</Text>
      <View style={styles.traceList}>
        {glass.calculationTrace.map((trace, index) => (
          <TraceRow key={`${trace.label}-${index}`} trace={trace} />
        ))}
      </View>
    </View>
  );
}

function FrameCutView({ piece }: { piece: FrameCutPiece }) {
  return (
    <View style={styles.cutPiece}>
      <View style={styles.cutPieceHeader}>
        <Text style={styles.cutPieceTitle}>{piece.orientation === 'HORIZONTAL' ? 'Yatay kasa' : 'Dikey kasa'}</Text>
        <Text style={styles.cutPieceValue}>
          {piece.quantity} adet x {piece.cutLengthMm} mm
        </Text>
      </View>
      <Text style={styles.caption}>
        Profil {piece.profileCode} - {piece.angleStartDeg}° / {piece.angleEndDeg}°
      </Text>
      <View style={styles.traceList}>
        {piece.calculationTrace.map((trace, index) => (
          <TraceRow key={`${trace.label}-${index}`} trace={trace} />
        ))}
      </View>
    </View>
  );
}

function TraceRow({ trace }: { trace: CalculationTraceItem }) {
  return (
    <View style={styles.traceRow}>
      <Text style={styles.traceLabel}>{trace.label}</Text>
      <Text style={styles.traceValue}>
        {trace.operation}: {trace.value}
        {trace.unit && trace.unit !== 'TEXT' ? ` ${trace.unit.toLowerCase()}` : ''}
      </Text>
    </View>
  );
}

function ProfileList({
  profiles,
  selectedId,
  onSelect,
}: {
  profiles: ProductionProfileSystem[];
  selectedId: string | null;
  onSelect: (profile: ProductionProfileSystem) => void;
}) {
  if (profiles.length === 0) {
    return null;
  }

  return (
    <View style={styles.profileList}>
      <Text style={styles.sectionTitle}>Kayıtlı Profil Sistemleri</Text>
      {profiles.map((profile) => (
        <AppCard
          key={profile.id}
          onPress={() => onSelect(profile)}
          {...(selectedId === profile.id ? { style: styles.selectedCard } : {})}
        >
          <View style={styles.profileRow}>
            <View style={styles.profileInfo}>
              <Text style={styles.profileTitle}>{profile.displayName}</Text>
              <Text style={styles.caption}>
                {profile.brand} / {profile.seriesName} - v{profile.version}
              </Text>
            </View>
            <Text style={[styles.badge, profile.status === 'VERIFIED' ? styles.verifiedBadge : styles.draftBadge]}>
              {profile.status === 'ARCHIVED' ? 'PASİF' : profile.status}
            </Text>
          </View>
        </AppCard>
      ))}
    </View>
  );
}

function StatusCard({
  completion,
  isVerified,
  archived,
}: {
  completion: { completed: number; total: number; missingLabels: string[] };
  isVerified: boolean;
  archived: boolean;
}) {
  const title = archived
    ? 'Pasif Profil Sistemi'
    : isVerified
      ? 'Doğrulanmış Profil Sistemi'
      : 'Taslak Profil Sistemi';
  const description = archived
    ? 'Bu profil sistemi yeni üretim hesaplarında kullanılmamalı.'
    : isVerified
      ? 'Bu profil sistemi kesin üretim hesabında kullanılabilir.'
      : 'Bu teknik veriler henüz doğrulanmadı. Kesin üretim hesabında kullanılamaz.';

  return (
    <View style={styles.statusCard}>
      <View style={styles.statusHeader}>
        <Ionicons
          name={isVerified ? 'checkmark-circle-outline' : 'alert-circle-outline'}
          size={24}
          color={isVerified ? colors.success : colors.warning}
        />
        <View style={styles.statusText}>
          <Text style={styles.statusTitle}>{title}</Text>
          <Text style={styles.caption}>{description}</Text>
        </View>
      </View>
      <Text style={styles.completion}>
        Temel kasa verileri: {completion.completed}/{completion.total} tamamlandı
      </Text>
      {completion.missingLabels.length > 0 ? (
        <View style={styles.missingList}>
          {completion.missingLabels.slice(0, 4).map((label) => (
            <Text key={label} style={styles.caption}>
              - {label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        multiline={multiline}
        onChangeText={onChangeText}
        style={[styles.input, multiline ? styles.multilineInput : null]}
        value={value}
      />
    </View>
  );
}

function NumberField({
  label,
  suffix,
  value,
  onChangeText,
}: {
  label: string;
  suffix: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.numberRow}>
        <TextInput
          accessibilityLabel={label}
          keyboardType="numeric"
          onChangeText={onChangeText}
          style={[styles.input, styles.numberInput]}
          value={value}
        />
        <Text style={styles.suffix}>{suffix}</Text>
      </View>
    </View>
  );
}

function AdjustmentField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { operation: AdjustmentOperation; valueMm: string };
  onChange: (value: { operation: AdjustmentOperation; valueMm: string }) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segmented}>
        {(['ADD', 'SUBTRACT', 'NONE'] as const).map((operation) => (
          <Pressable
            key={operation}
            accessibilityRole="button"
            onPress={() => onChange({ operation, valueMm: operation === 'NONE' ? '' : value.valueMm })}
            style={[styles.segment, value.operation === operation ? styles.segmentSelected : null]}
          >
            <Text style={[styles.segmentText, value.operation === operation ? styles.segmentTextSelected : null]}>
              {operationLabel(operation)}
            </Text>
          </Pressable>
        ))}
      </View>
      {value.operation !== 'NONE' ? (
        <View style={styles.numberRow}>
          <TextInput
            accessibilityLabel={label}
            keyboardType="numeric"
            onChangeText={(text) => onChange({ ...value, valueMm: text })}
            style={[styles.input, styles.numberInput]}
            value={value.valueMm}
          />
          <Text style={styles.suffix}>mm</Text>
        </View>
      ) : null}
    </View>
  );
}

function ModeButton({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.modeButton, selected ? styles.modeButtonSelected : null]}
    >
      <Text style={[styles.modeTitle, selected ? styles.modeTitleSelected : null]}>{label}</Text>
      <Text style={[styles.caption, selected ? styles.modeCaptionSelected : null]}>{description}</Text>
    </Pressable>
  );
}

function operationLabel(operation: AdjustmentOperation): string {
  if (operation === 'ADD') {
    return 'Ekle';
  }

  if (operation === 'SUBTRACT') {
    return 'Düş';
  }

  return 'Yok';
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  form: {
    gap: spacing.md,
    paddingBottom: 160,
  },
  calculationCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  calculationHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  calculationTitleWrap: {
    flex: 1,
    gap: 2,
  },
  dimensionGrid: {
    gap: spacing.sm,
  },
  calculationError: {
    backgroundColor: '#FFF4F2',
    borderColor: '#F3C9C3',
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  errorTitle: {
    ...typography.body,
    color: colors.error,
    fontWeight: '800',
  },
  calculationResult: {
    gap: spacing.sm,
  },
  resultTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  cutPiece: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  cutPieceHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  cutPieceTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  cutPieceValue: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '800',
    textAlign: 'right',
  },
  traceList: {
    gap: 4,
    marginTop: spacing.xs,
  },
  traceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  traceLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  traceValue: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'right',
  },
  snapshotText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  profileList: {
    gap: spacing.sm,
  },
  profileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  selectedCard: {
    borderColor: colors.primary,
  },
  badge: {
    ...typography.caption,
    borderRadius: radius.sm,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  verifiedBadge: {
    backgroundColor: '#E6F4EA',
    color: colors.success,
  },
  draftBadge: {
    backgroundColor: '#FFF4E5',
    color: colors.warning,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  statusHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusText: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
  },
  completion: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  missingList: {
    gap: 2,
  },
  verifyRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  verifyText: {
    flex: 1,
    gap: 2,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
  },
  subsectionTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  field: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.textPrimary,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  multilineInput: {
    minHeight: 78,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  numberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  numberInput: {
    flex: 1,
  },
  suffix: {
    ...typography.caption,
    color: colors.textSecondary,
    width: 58,
  },
  modeGrid: {
    gap: spacing.sm,
  },
  modeButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
    padding: spacing.md,
  },
  modeButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  modeTitleSelected: {
    color: colors.surface,
  },
  modeCaptionSelected: {
    color: colors.surface,
  },
  accordionHeader: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  segmented: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  segmentSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  segmentTextSelected: {
    color: colors.surface,
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
