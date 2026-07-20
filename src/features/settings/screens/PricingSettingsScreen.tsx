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
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';

type FormValues = {
  openingPanelPrice: string;
  fixedPanelPrice: string;
  archSurcharge: string;
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
        setError('Fiyat ayarlari yuklenemedi.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadSettings();
  }, []);

  function updateBaseValue(key: keyof Pick<FormValues, 'openingPanelPrice' | 'fixedPanelPrice' | 'archSurcharge' | 'customColorMultiplier'>, value: string) {
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
      setError('Tum alanlar 0 veya daha buyuk sayi olmali.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const savedSettings = await savePricingSettings(parsed);
      setSettings(savedSettings);
      setValues(toFormValues(savedSettings));
      setMessage('Fiyat ayarlari kaydedildi.');
    } catch (saveError) {
      logger.error('Pricing settings save failed', saveError);
      setError('Fiyat ayarlari kaydedilemedi.');
    } finally {
      setIsSaving(false);
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
      <AppScreen scroll={false}>
        <AppHeader title="Fiyat Ayarlari" subtitle="Usta, seri, renk ve cam fiyatlari." />
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
                detail={option.formula ?? 'Ozel cam'}
                suffix="TL / m2"
                value={values.glassTypes[option.id] ?? ''}
                onChangeText={(value) => updateNestedValue('glassTypes', option.id, value)}
              />
            ))}
          </Section>

          <Section title="Renk katsayilari">
            {settings.colorMultipliers.map((option) => (
              <PriceRow
                key={option.id}
                label={option.name}
                detail="Profil fiyat carpanidir"
                suffix="x"
                value={values.colorMultipliers[option.id] ?? ''}
                onChangeText={(value) => updateNestedValue('colorMultipliers', option.id, value)}
              />
            ))}
            <PriceRow
              label="Ozel renk"
              detail="Kullanici paletten yeni renk eklediginde kullanilir"
              suffix="x"
              value={values.customColorMultiplier}
              onChangeText={(value) => updateBaseValue('customColorMultiplier', value)}
            />
          </Section>

          <Section title="Aksam ve ek isler">
            <PriceRow
              label="Acilir kanat/donanim"
              detail="Acilan her panel icin"
              suffix="TL / adet"
              value={values.openingPanelPrice}
              onChangeText={(value) => updateBaseValue('openingPanelPrice', value)}
            />
            <PriceRow
              label="Sabit panel payi"
              detail="Sabit her panel icin"
              suffix="TL / adet"
              value={values.fixedPanelPrice}
              onChangeText={(value) => updateBaseValue('fixedPanelPrice', value)}
            />
            <PriceRow
              label="Kemer farki"
              detail="Kemerli tasarimlarda eklenir"
              suffix="TL"
              value={values.archSurcharge}
              onChangeText={(value) => updateBaseValue('archSurcharge', value)}
            />
          </Section>

          {message ? <Text style={styles.success}>{message}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <AppButton label="Kaydet" loading={isSaving} disabled={isSaving} onPress={() => void save()} />
          <AppButton label="Varsayilana Don" variant="secondary" disabled={isSaving} onPress={resetDefaults} />
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
  const customColorMultiplier = parseNumber(values.customColorMultiplier);

  if (
    openingPanelPrice === null ||
    fixedPanelPrice === null ||
    archSurcharge === null ||
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
});
