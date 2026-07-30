import { router } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import {
  getPricingSettings,
  savePricingSettings,
} from '../../../database/repositories/PricingSettingsRepository';
import {
  ColorPriceOption,
  defaultPriceEstimateRates,
  GlassPriceOption,
  PriceEstimateRates,
  ProfileSystemPriceOption,
} from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
import {
  backupPricingSettingsToCloud,
  restorePricingSettingsFromCloud,
} from '../../../services/firebase/pricingSettingsCloudService';
import { isFirebaseConfigured } from '../../../services/firebase/firebaseConfig';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';

type FormValues = {
  openingPanelPrice: string;
  fixedPanelPrice: string;
  archSurcharge: string;
  serviceLaborRate: string;
  customColorMultiplier: string;
  profileSystems: Record<string, string>;
  glassTypes: Record<string, string>;
  colorMultipliers: Record<string, string>;
};

export function PricingSettingsScreen() {
  const [settings, setSettings] = useState<PriceEstimateRates>(defaultPriceEstimateRates);
  const [values, setValues] = useState<FormValues>(toFormValues(defaultPriceEstimateRates));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const loadedSettings = await getPricingSettings();
        setSettings(loadedSettings);
        setValues(toFormValues(loadedSettings));
      } catch (loadError) {
        logger.error('Pricing settings screen load failed', loadError);
        setError('Fiyat ayarları yüklenemedi.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadSettings();
  }, []);

  function updateBaseValue(
    key: keyof Pick<
      FormValues,
      'openingPanelPrice' | 'fixedPanelPrice' | 'archSurcharge' | 'serviceLaborRate' | 'customColorMultiplier'
    >,
    value: string,
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    clearStatus();
  }

  function updateNestedValue(section: 'profileSystems' | 'glassTypes' | 'colorMultipliers', id: string, value: string) {
    setValues((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [id]: value,
      },
    }));
    clearStatus();
  }

  async function save() {
    const parsed = parseFormValues(settings, values);
    if (!parsed) {
      setError('Tüm alanlar 0 veya daha büyük sayı olmalı.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const savedSettings = await savePricingSettings(parsed);
      setSettings(savedSettings);
      setValues(toFormValues(savedSettings));
      void backupPricingSettingsToCloud(savedSettings);
      setMessage('Fiyat ayarları kaydedildi.');
    } catch (saveError) {
      logger.error('Pricing settings save failed', saveError);
      setError('Fiyat ayarları kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function backupToCloud() {
    const parsed = parseFormValues(settings, values);
    if (!parsed) {
      setError('Buluta yedeklemek için önce fiyat alanlarını düzeltin.');
      return;
    }

    if (!isFirebaseConfigured()) {
      setError('Firebase ayarları eksik. .env dosyasına Firebase config değerleri girilmeli.');
      return;
    }

    setIsSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const savedSettings = await savePricingSettings(parsed);
      setSettings(savedSettings);
      setValues(toFormValues(savedSettings));
      const backedUp = await backupPricingSettingsToCloud(savedSettings);
      setMessage(backedUp ? 'Fiyat ayarları buluta yedeklendi.' : 'Bulut yedeği yapılamadı.');
    } catch (syncError) {
      logger.error('Pricing settings cloud backup failed', syncError);
      setError('Buluta yedekleme başarısız oldu.');
    } finally {
      setIsSyncing(false);
    }
  }

  async function restoreFromCloud() {
    if (!isFirebaseConfigured()) {
      setError('Firebase ayarları eksik. .env dosyasına Firebase config değerleri girilmeli.');
      return;
    }

    setIsSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const cloudSettings = await restorePricingSettingsFromCloud();
      if (!cloudSettings) {
        setError('Bulutta fiyat ayarı bulunamadı.');
        return;
      }

      const savedSettings = await savePricingSettings(cloudSettings);
      setSettings(savedSettings);
      setValues(toFormValues(savedSettings));
      setMessage('Buluttaki fiyat ayarları cihaza alındı.');
    } catch (syncError) {
      logger.error('Pricing settings cloud restore failed', syncError);
      setError('Buluttan alma başarısız oldu.');
    } finally {
      setIsSyncing(false);
    }
  }

  function resetDefaults() {
    setSettings(defaultPriceEstimateRates);
    setValues(toFormValues(defaultPriceEstimateRates));
    clearStatus();
  }

  function clearStatus() {
    setMessage(null);
    setError(null);
  }

  if (isLoading) {
    return (
      <AppScreen centered>
        <ActivityIndicator color={colors.primary} />
      </AppScreen>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
      <AppScreen scroll={false}>
        <AppHeader title="Fiyat Ayarları" subtitle="Usta, seri, renk ve cam fiyatları." />
        <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
          <Section title="Profil kalitesi">
            {settings.profileSystems.map((option) => (
              <PriceRow
                key={option.id}
                label={option.name}
                detail={`${option.profileWidth} mm profil`}
                suffix="TL / m"
                value={values.profileSystems[option.id] ?? ''}
                onChangeText={(value) => updateNestedValue('profileSystems', option.id, value)}
              />
            ))}
          </Section>

          <Section title="Cam tipleri">
            {settings.glassTypes.map((option) => (
              <PriceRow
                key={option.id}
                label={option.name}
                detail={option.formula ?? 'Özel cam'}
                suffix="TL / m2"
                value={values.glassTypes[option.id] ?? ''}
                onChangeText={(value) => updateNestedValue('glassTypes', option.id, value)}
              />
            ))}
          </Section>

          <Section title="Renk katsayıları">
            {settings.colorMultipliers.map((option) => (
              <PriceRow
                key={option.id}
                label={option.name}
                detail="Profil fiyat çarpanıdır"
                suffix="x"
                value={values.colorMultipliers[option.id] ?? ''}
                onChangeText={(value) => updateNestedValue('colorMultipliers', option.id, value)}
              />
            ))}
            <PriceRow
              label="Özel renk"
              detail="Kullanıcı paletten yeni renk eklediğinde kullanılır"
              suffix="x"
              value={values.customColorMultiplier}
              onChangeText={(value) => updateBaseValue('customColorMultiplier', value)}
            />
          </Section>

          <Section title="Aksam ve ek işler">
            <PriceRow
              label="Açılır kanat/donanım"
              detail="Açılan her panel için"
              suffix="TL / adet"
              value={values.openingPanelPrice}
              onChangeText={(value) => updateBaseValue('openingPanelPrice', value)}
            />
            <PriceRow
              label="Sabit panel payı"
              detail="Sabit her panel için"
              suffix="TL / adet"
              value={values.fixedPanelPrice}
              onChangeText={(value) => updateBaseValue('fixedPanelPrice', value)}
            />
            <PriceRow
              label="Kemer farkı"
              detail="Kemerli tasarımlarda eklenir"
              suffix="TL"
              value={values.archSurcharge}
              onChangeText={(value) => updateBaseValue('archSurcharge', value)}
            />
            <PriceRow
              label="Hizmet payı"
              detail="Malzeme karşılığı üzerine eklenecek yüzde; gider değildir"
              suffix="%"
              value={values.serviceLaborRate}
              onChangeText={(value) => updateBaseValue('serviceLaborRate', value)}
            />
          </Section>

          {message ? <Text style={styles.success}>{message}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <AppButton label="Kaydet" loading={isSaving} disabled={isSaving} onPress={() => void save()} />
          <View style={styles.cloudActions}>
            <AppButton
              label="Buluta Yedekle"
              variant="secondary"
              loading={isSyncing}
              disabled={isSyncing}
              onPress={() => void backupToCloud()}
              style={styles.cloudButton}
            />
            <AppButton
              label="Buluttan Al"
              variant="secondary"
              disabled={isSyncing}
              onPress={() => void restoreFromCloud()}
              style={styles.cloudButton}
            />
          </View>
          <AppButton label="Varsayılana Dön" variant="secondary" disabled={isSaving} onPress={resetDefaults} />
          <AppButton label="Geri" variant="ghost" disabled={isSaving} onPress={() => router.back()} />
        </ScrollView>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PriceRow({
  label,
  detail,
  suffix,
  value,
  onChangeText,
}: {
  label: string;
  detail: string;
  suffix: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelColumn}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <View style={styles.inputWrap}>
        <TextInput
          accessibilityLabel={label}
          keyboardType="numeric"
          onChangeText={onChangeText}
          style={styles.input}
          value={value}
        />
        <Text style={styles.suffix}>{suffix}</Text>
      </View>
    </View>
  );
}

function toFormValues(settings: PriceEstimateRates): FormValues {
  return {
    openingPanelPrice: String(settings.openingPanelPrice),
    fixedPanelPrice: String(settings.fixedPanelPrice),
    archSurcharge: String(settings.archSurcharge),
    serviceLaborRate: String(settings.serviceLaborRate),
    customColorMultiplier: String(settings.customColorMultiplier),
    profileSystems: Object.fromEntries(
      settings.profileSystems.map((option) => [option.id, String(option.meterPrice)]),
    ),
    glassTypes: Object.fromEntries(
      settings.glassTypes.map((option) => [option.id, String(option.squareMeterPrice)]),
    ),
    colorMultipliers: Object.fromEntries(
      settings.colorMultipliers.map((option) => [option.id, String(option.multiplier)]),
    ),
  };
}

function parseFormValues(settings: PriceEstimateRates, values: FormValues): PriceEstimateRates | null {
  const openingPanelPrice = parseNumber(values.openingPanelPrice);
  const fixedPanelPrice = parseNumber(values.fixedPanelPrice);
  const archSurcharge = parseNumber(values.archSurcharge);
  const serviceLaborRate = parseNumber(values.serviceLaborRate);
  const customColorMultiplier = parseNumber(values.customColorMultiplier);

  if (
    openingPanelPrice === null ||
    fixedPanelPrice === null ||
    archSurcharge === null ||
    serviceLaborRate === null ||
    customColorMultiplier === null
  ) {
    return null;
  }

  const profileSystems = parseProfileSystems(settings.profileSystems, values.profileSystems);
  const glassTypes = parseGlassTypes(settings.glassTypes, values.glassTypes);
  const colorMultipliers = parseColorMultipliers(settings.colorMultipliers, values.colorMultipliers);

  if (!profileSystems || !glassTypes || !colorMultipliers) {
    return null;
  }

  const defaultProfile = profileSystems.find((option) => option.id === 'standard-70') ?? profileSystems[0];
  const defaultGlass = glassTypes.find((option) => option.id === 'double-clear') ?? glassTypes[0];

  return {
    ...settings,
    profileMeterPrice: defaultProfile?.meterPrice ?? settings.profileMeterPrice,
    glassSquareMeterPrice: defaultGlass?.squareMeterPrice ?? settings.glassSquareMeterPrice,
    openingPanelPrice,
    fixedPanelPrice,
    archSurcharge,
    serviceLaborRate,
    customColorMultiplier,
    profileSystems,
    glassTypes,
    colorMultipliers,
  };
}

function parseProfileSystems(
  options: ProfileSystemPriceOption[],
  values: Record<string, string>,
): ProfileSystemPriceOption[] | null {
  const parsed = options.map((option) => {
    const meterPrice = parseNumber(values[option.id] ?? '');
    return meterPrice === null ? null : { ...option, meterPrice };
  });

  return parsed.every(Boolean) ? (parsed as ProfileSystemPriceOption[]) : null;
}

function parseGlassTypes(
  options: GlassPriceOption[],
  values: Record<string, string>,
): GlassPriceOption[] | null {
  const parsed = options.map((option) => {
    const squareMeterPrice = parseNumber(values[option.id] ?? '');
    return squareMeterPrice === null ? null : { ...option, squareMeterPrice };
  });

  return parsed.every(Boolean) ? (parsed as GlassPriceOption[]) : null;
}

function parseColorMultipliers(
  options: ColorPriceOption[],
  values: Record<string, string>,
): ColorPriceOption[] | null {
  const parsed = options.map((option) => {
    const multiplier = parseNumber(values[option.id] ?? '');
    return multiplier === null ? null : { ...option, multiplier };
  });

  return parsed.every(Boolean) ? (parsed as ColorPriceOption[]) : null;
}

function parseNumber(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  form: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
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
  field: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  labelColumn: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  detail: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  inputWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.textPrimary,
    minHeight: 42,
    paddingHorizontal: spacing.sm,
    textAlign: 'right',
    width: 86,
  },
  suffix: {
    ...typography.caption,
    color: colors.textSecondary,
    minWidth: 48,
  },
  success: {
    ...typography.caption,
    color: colors.success,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
  cloudActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cloudButton: {
    flex: 1,
  },
});
