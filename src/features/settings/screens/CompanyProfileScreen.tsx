import { User } from 'firebase/auth';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import {
  getCompanyProfile,
  saveCompanyProfile,
} from '../../../database/repositories/CompanyProfileRepository';
import {
  CompanyProfile,
  defaultCompanyProfile,
} from '../../../domain/company/entities/CompanyProfile';
import {
  registerWithEmail,
  signInWithEmail,
  signOutFirebaseUser,
  subscribeFirebaseUser,
} from '../../../services/firebase/firebaseAuthService';
import { isFirebaseConfigured } from '../../../services/firebase/firebaseConfig';
import { createCompanyCode, normalizeCompanyId } from '../../../services/firebase/companyWorkspaceService';
import {
  backupCompanyProfileToCloud,
  restoreCompanyProfileFromCloud,
} from '../../../services/firebase/companyProfileCloudService';
import { backupAllLocalDataToCloud, restoreAllCloudDataToLocal } from '../../../services/firebase/fullSyncService';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';

type CompanyProfileForm = Record<keyof CompanyProfile, string>;

const fields: { key: keyof CompanyProfile; label: string; keyboardType?: 'default' | 'numeric' | 'phone-pad' }[] = [
  { key: 'companyId', label: 'Firma kodu' },
  { key: 'companyName', label: 'Firma adi' },
  { key: 'ownerName', label: 'Yetkili kisi' },
  { key: 'phone', label: 'Telefon', keyboardType: 'phone-pad' },
  { key: 'address', label: 'Adres' },
  { key: 'taxInfo', label: 'Vergi / firma notu' },
  { key: 'pdfNote', label: 'PDF alt notu' },
  { key: 'quoteValidityDays', label: 'Teklif gecerlilik gunu', keyboardType: 'numeric' },
];

export function CompanyProfileScreen() {
  const [values, setValues] = useState<CompanyProfileForm>(toFormValues(defaultCompanyProfile));
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    const unsubscribe = subscribeFirebaseUser(setUser);

    async function loadProfile() {
      try {
        const loadedProfile = await getCompanyProfile();
      setValues(toFormValues(loadedProfile));
      } catch (loadError) {
        logger.error('Company profile load failed', loadError);
        setError('Firma bilgileri yuklenemedi.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
    return unsubscribe;
  }, []);

  function updateValue(key: keyof CompanyProfile, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    clearStatus();
  }

  async function save() {
    const parsed = parseProfile(values);
    if (!parsed) {
      setError('Teklif gecerlilik gunu 0 veya daha buyuk sayi olmali.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const savedProfile = await saveCompanyProfile(parsed);
      setValues(toFormValues(savedProfile));
      void backupCompanyProfileToCloud(savedProfile);
      setMessage('Firma bilgileri kaydedildi.');
    } catch (saveError) {
      logger.error('Company profile save failed', saveError);
      setError('Firma bilgileri kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function register() {
    await runAuthAction(async () => {
      if (!hasCompanyCode()) {
        setError('Ortak kullanim icin once firma kodu girilmeli veya olusturulmali.');
        return;
      }

      await registerWithEmail(email, password);
      await backupAllLocalDataToCloud();
      setMessage('Hesap olusturuldu ve veriler buluta yedeklendi.');
    });
  }

  async function signIn() {
    await runAuthAction(async () => {
      if (!hasCompanyCode()) {
        setError('Buluttaki firma verilerini almak icin firma kodu girilmeli.');
        return;
      }

      await signInWithEmail(email, password);
      await restoreAllCloudDataToLocal();
      const restoredProfile = await getCompanyProfile();
      setValues(toFormValues(restoredProfile));
      setMessage('Giris yapildi. Buluttaki veriler cihaza alindi.');
    });
  }

  async function signOut() {
    await runAuthAction(async () => {
      await signOutFirebaseUser();
      setMessage('Cikis yapildi.');
    });
  }

  async function backupProfile() {
    const parsed = parseProfile(values);
    if (!parsed) {
      setError('Buluta yedeklemek icin firma alanlarini duzeltin.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const savedProfile = await saveCompanyProfile(parsed);
      const backedUp = await backupCompanyProfileToCloud(savedProfile);
      setValues(toFormValues(savedProfile));
      setMessage(backedUp ? 'Firma bilgileri buluta yedeklendi.' : 'Bulut yedegi yapilamadi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function restoreProfile() {
    if (!hasCompanyCode()) {
      setError('Buluttan almak icin firma kodu girilmeli.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const cloudProfile = await restoreCompanyProfileFromCloud();
      if (!cloudProfile) {
        setError('Bulutta firma bilgisi bulunamadi.');
        return;
      }

      const savedProfile = await saveCompanyProfile(cloudProfile);
      setValues(toFormValues(savedProfile));
      setMessage('Buluttaki firma bilgileri cihaza alindi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function runAuthAction(action: () => Promise<void>) {
    if (!firebaseReady) {
      setError('Firebase config girilmedi.');
      return;
    }

    if (!email.trim() || password.length < 6) {
      setError('E-posta ve en az 6 karakter sifre girilmeli.');
      return;
    }

    setIsAuthBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (authError) {
      logger.error('Firebase auth action failed', authError);
      setError('Hesap islemi basarisiz oldu. E-posta/sifre ve Firebase ayarlarini kontrol edin.');
    } finally {
      setIsAuthBusy(false);
    }
  }

  function clearStatus() {
    setMessage(null);
    setError(null);
  }

  function generateCompanyCode() {
    updateValue('companyId', createCompanyCode());
  }

  function hasCompanyCode(): boolean {
    return normalizeCompanyId(values.companyId).length > 0;
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
          title="Firma Bilgileri"
          subtitle="Hesap ve PDF firma bilgileri"
          rightAction={<AppButton label="Geri" variant="ghost" onPress={() => router.back()} />}
        />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Hesap</Text>
            <Text style={styles.statusCaption}>
              {firebaseReady
                ? user?.email ?? (user?.isAnonymous ? 'Anonim Firebase kullanicisi' : 'Giris yapilmadi')
                : 'Firebase config girilmedi'}
            </Text>
            <Text style={styles.statusCaption}>
              Firma kodu: {hasCompanyCode() ? normalizeCompanyId(values.companyId) : 'Girilmedi'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Giris / Kayit</Text>
            <TextInput
              accessibilityLabel="E-posta"
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="E-posta"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              value={email}
            />
            <TextInput
              accessibilityLabel="Sifre"
              onChangeText={setPassword}
              placeholder="Sifre"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              style={styles.input}
              value={password}
            />
            <View style={styles.row}>
              <AppButton
                label="Giris"
                variant="secondary"
                loading={isAuthBusy}
                disabled={isAuthBusy}
                onPress={() => void signIn()}
                style={styles.flexButton}
              />
              <AppButton
                label="Kayit Ol"
                variant="secondary"
                disabled={isAuthBusy}
                onPress={() => void register()}
                style={styles.flexButton}
              />
            </View>
            <AppButton label="Cikis Yap" variant="ghost" disabled={isAuthBusy} onPress={() => void signOut()} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Firma profili</Text>
            {fields.map((field) => (
              <View key={field.key} style={styles.field}>
                <Text style={styles.label}>{field.label}</Text>
                <TextInput
                  accessibilityLabel={field.label}
                  keyboardType={field.keyboardType ?? 'default'}
                  multiline={field.key === 'address' || field.key === 'pdfNote'}
                  onChangeText={(value) => updateValue(field.key, value)}
                  style={[
                    styles.input,
                    field.key === 'address' || field.key === 'pdfNote' ? styles.multilineInput : null,
                  ]}
                  textAlignVertical="top"
                  value={values[field.key]}
                />
              </View>
            ))}
            <AppButton
              label="Firma Kodu Olustur"
              variant="secondary"
              onPress={generateCompanyCode}
            />
          </View>

          {message ? <Text style={styles.success}>{message}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <AppButton label="Kaydet" loading={isSaving} disabled={isSaving} onPress={() => void save()} />
          <View style={styles.row}>
            <AppButton
              label="Buluta Yedekle"
              variant="secondary"
              disabled={isSaving}
              onPress={() => void backupProfile()}
              style={styles.flexButton}
            />
            <AppButton
              label="Buluttan Al"
              variant="secondary"
              disabled={isSaving}
              onPress={() => void restoreProfile()}
              style={styles.flexButton}
            />
          </View>
        </ScrollView>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

function toFormValues(profile: CompanyProfile): CompanyProfileForm {
  return {
    companyId: profile.companyId,
    companyName: profile.companyName,
    ownerName: profile.ownerName,
    phone: profile.phone,
    address: profile.address,
    taxInfo: profile.taxInfo,
    pdfNote: profile.pdfNote,
    quoteValidityDays: String(profile.quoteValidityDays),
  };
}

function parseProfile(values: CompanyProfileForm): CompanyProfile | null {
  const quoteValidityDays = Number(values.quoteValidityDays.replace(',', '.').trim());

  if (!Number.isFinite(quoteValidityDays) || quoteValidityDays < 0) {
    return null;
  }

  return {
    companyId: normalizeCompanyId(values.companyId),
    companyName: values.companyName.trim(),
    ownerName: values.ownerName.trim(),
    phone: values.phone.trim(),
    address: values.address.trim(),
    taxInfo: values.taxInfo.trim(),
    pdfNote: values.pdfNote.trim(),
    quoteValidityDays: Math.round(quoteValidityDays),
  };
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  statusTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  statusCaption: {
    ...typography.caption,
    color: colors.textSecondary,
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
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.textPrimary,
    minHeight: 46,
    paddingHorizontal: spacing.sm,
  },
  multilineInput: {
    minHeight: 78,
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexButton: {
    flex: 1,
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
