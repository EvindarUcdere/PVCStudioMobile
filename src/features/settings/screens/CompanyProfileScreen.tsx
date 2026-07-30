import { User } from 'firebase/auth';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { routes } from '../../../constants/routes';
import {
  getCompanyProfile,
  saveCompanyProfile,
} from '../../../database/repositories/CompanyProfileRepository';
import {
  getLocalOperatorName,
  saveLocalOperatorName,
} from '../../../database/repositories/LocalUserSettingsRepository';
import {
  CompanyProfile,
  defaultCompanyProfile,
} from '../../../domain/company/entities/CompanyProfile';
import {
  registerWithEmail,
  sendPasswordReset,
  signInWithEmail,
  signOutFirebaseUser,
  subscribeFirebaseUser,
} from '../../../services/firebase/firebaseAuthService';
import { isFirebaseConfigured } from '../../../services/firebase/firebaseConfig';
import { normalizeCompanyId } from '../../../services/firebase/companyWorkspaceService';
import {
  backupCompanyProfileToCloud,
  restoreCompanyProfileFromCloud,
} from '../../../services/firebase/companyProfileCloudService';
import { backupAllLocalDataToCloud, restoreAllCloudDataToLocal } from '../../../services/firebase/fullSyncService';
import {
  getLicenseSeatSummary,
  LicenseSeatSummary,
  releaseCurrentLicenseSeat,
  validateAndJoinLicense,
} from '../../../services/firebase/licenseService';
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
  const [operatorName, setOperatorName] = useState('');
  const [savedCompanyId, setSavedCompanyId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [isLicenseBusy, setIsLicenseBusy] = useState(false);
  const [licenseSummary, setLicenseSummary] = useState<LicenseSeatSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firebaseReady = isFirebaseConfigured();

  const loadLicenseSummary = useCallback(
    async (companyId = normalizeCompanyId(values.companyId)) => {
      if (!firebaseReady || !companyId) {
        setLicenseSummary(null);
        return;
      }

      setIsLicenseBusy(true);
      try {
        setLicenseSummary(await getLicenseSeatSummary(companyId));
      } finally {
        setIsLicenseBusy(false);
      }
    },
    [firebaseReady, values.companyId],
  );

  useEffect(() => {
    const unsubscribe = subscribeFirebaseUser(setUser);

    async function loadProfile() {
      try {
        const [loadedProfile, loadedOperatorName] = await Promise.all([
          getCompanyProfile(),
          getLocalOperatorName(),
        ]);
        setValues(toFormValues(loadedProfile));
        const normalizedCompanyId = normalizeCompanyId(loadedProfile.companyId);
        setSavedCompanyId(normalizedCompanyId);
        setOperatorName(loadedOperatorName ?? '');
        void loadLicenseSummary(normalizedCompanyId);
      } catch (loadError) {
        logger.error('Company profile load failed', loadError);
        setError('Firma bilgileri yüklenemedi.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
    return unsubscribe;
  }, [loadLicenseSummary]);

  function updateValue(key: keyof CompanyProfile, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    clearStatus();
  }

  async function save() {
    const parsed = parseProfile(values);
    if (!parsed) {
      setError('Teklif geçerlilik günü 0 veya daha büyük sayı olmalı.');
      return;
    }

    if (!canUseCompanyCode(parsed.companyId)) {
      return;
    }

    if (!parsed.companyId) {
      setError('Uygulamayı kullanmak için firma kodu girilmeli.');
      return;
    }

    if (!savedCompanyId) {
      if (!firebaseReady) {
        setError('Firma kodunu doğrulamak için Firebase config girilmeli.');
        return;
      }

      const license = await validateAndJoinLicense(parsed.companyId);
      if (!license.ok) {
        setError(license.message);
        return;
      }
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const savedProfile = await saveCompanyProfile(parsed);
      await saveLocalOperatorName(operatorName);
      setValues(toFormValues(savedProfile));
      const normalizedCompanyId = normalizeCompanyId(savedProfile.companyId);
      setSavedCompanyId(normalizedCompanyId);
      void loadLicenseSummary(normalizedCompanyId);
      void backupCompanyProfileToCloud(savedProfile);
      setMessage('Firma bilgileri kaydedildi.');
      router.replace(routes.home);
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
        setError('Ortak kullanım için önce firma kodu girilmeli.');
        return;
      }

      const companyId = normalizeCompanyId(values.companyId);
      if (!canUseCompanyCode(companyId)) {
        return;
      }

      const license = await validateAndJoinLicense(companyId);
      if (!license.ok) {
        setError(license.message);
        return;
      }

      await saveLocalOperatorName(operatorName);
      await registerWithEmail(email, password);
      setPassword('');
      await backupAllLocalDataToCloud();
      setMessage('Hesap oluşturuldu ve veriler buluta yedeklendi.');
    });
  }

  async function signIn() {
    await runAuthAction(async () => {
      if (!hasCompanyCode()) {
        setError('Buluttaki firma verilerini almak için firma kodu girilmeli.');
        return;
      }

      const companyId = normalizeCompanyId(values.companyId);
      if (!canUseCompanyCode(companyId)) {
        return;
      }

      const license = await validateAndJoinLicense(companyId);
      if (!license.ok) {
        setError(license.message);
        return;
      }

      await saveLocalOperatorName(operatorName);
      await signInWithEmail(email, password);
      setPassword('');
      await restoreAllCloudDataToLocal();
      const restoredProfile = await getCompanyProfile();
      setValues(toFormValues(restoredProfile));
      void loadLicenseSummary(normalizeCompanyId(restoredProfile.companyId));
      setMessage('Giriş yapıldı. Buluttaki veriler cihaza alındı.');
      router.replace(routes.home);
    });
  }

  async function signOut() {
    await runAuthAction(async () => {
      await signOutFirebaseUser();
      setPassword('');
      setMessage('Çıkış yapıldı.');
    });
  }

  async function resetPassword() {
    if (!firebaseReady) {
      setError('Firebase config girilmedi.');
      return;
    }

    if (!email.trim()) {
      setError('Şifre sıfırlama için e-posta girilmeli.');
      return;
    }

    setIsAuthBusy(true);
    setError(null);
    setMessage(null);
    try {
      await sendPasswordReset(email);
      setMessage('Şifre sıfırlama bağlantısı e-posta adresine gönderildi.');
    } catch (resetError) {
      logger.error('Firebase password reset failed', resetError);
      setError('Şifre sıfırlama e-postası gönderilemedi. E-posta adresini kontrol edin.');
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function releaseThisDeviceSeat() {
    const companyId = normalizeCompanyId(values.companyId);
    if (!firebaseReady || !companyId) {
      setError('Cihaz lisansını boşaltmak için firma kodu ve Firebase gerekli.');
      return;
    }

    setIsLicenseBusy(true);
    setError(null);
    setMessage(null);
    try {
      const released = await releaseCurrentLicenseSeat(companyId);
      if (!released) {
        setError('Bu cihaz lisans koltuğundan çıkarılamadı.');
        return;
      }

      await loadLicenseSummary(companyId);
      setMessage('Bu cihaz lisans koltuğundan çıkarıldı. Firma verileri silinmedi.');
    } finally {
      setIsLicenseBusy(false);
    }
  }

  async function joinCompanyByCode() {
    if (!firebaseReady) {
      setError('Firebase config girilmedi.');
      return;
    }

    if (!hasCompanyCode()) {
      setError('Ortak veriye bağlanmak için firma kodu girilmeli.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const parsed = parseProfile(values);
      if (!parsed) {
        setError('Firma koduyla katılmak için firma alanlarını düzeltin.');
        return;
      }

      if (!canUseCompanyCode(parsed.companyId)) {
        return;
      }

      await saveCompanyProfile(parsed);
      await saveLocalOperatorName(operatorName);
      const license = await validateAndJoinLicense(parsed.companyId);
      if (!license.ok) {
        setError(license.message);
        return;
      }

      const result = await restoreAllCloudDataToLocal();
      if (!result) {
        setError('Firma kodu ile bulut verisine bağlanılamadı. Kod ve internet bağlantısını kontrol edin.');
        return;
      }

      const restoredProfile = await getCompanyProfile();
      setValues(toFormValues(restoredProfile));
      const normalizedCompanyId = normalizeCompanyId(restoredProfile.companyId);
      setSavedCompanyId(normalizedCompanyId);
      void loadLicenseSummary(normalizedCompanyId);
      setMessage(
        `Lisans doğrulandı. Artık ${result.companyId} kodlu ortak alandasınız.${
          license.maxUsers ? ` Kullanıcı: ${license.activeUserCount}/${license.maxUsers}` : ''
        }`,
      );
      router.replace(routes.home);
    } finally {
      setIsSaving(false);
    }
  }

  async function backupProfile() {
    const parsed = parseProfile(values);
    if (!parsed) {
      setError('Buluta yedeklemek için firma alanlarını düzeltin.');
      return;
    }

    if (!canUseCompanyCode(parsed.companyId)) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const savedProfile = await saveCompanyProfile(parsed);
      await saveLocalOperatorName(operatorName);
      const backedUp = await backupCompanyProfileToCloud(savedProfile);
      setValues(toFormValues(savedProfile));
      const normalizedCompanyId = normalizeCompanyId(savedProfile.companyId);
      setSavedCompanyId(normalizedCompanyId);
      void loadLicenseSummary(normalizedCompanyId);
      setMessage(backedUp ? 'Firma bilgileri buluta yedeklendi.' : 'Bulut yedeği yapılamadı.');
    } finally {
      setIsSaving(false);
    }
  }

  async function restoreProfile() {
    if (!hasCompanyCode()) {
      setError('Buluttan almak için firma kodu girilmeli.');
      return;
    }

    if (!canUseCompanyCode(values.companyId)) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const cloudProfile = await restoreCompanyProfileFromCloud();
      if (!cloudProfile) {
        setError('Bulutta firma bilgisi bulunamadı.');
        return;
      }

      const savedProfile = await saveCompanyProfile(cloudProfile);
      setValues(toFormValues(savedProfile));
      const normalizedCompanyId = normalizeCompanyId(savedProfile.companyId);
      setSavedCompanyId(normalizedCompanyId);
      void loadLicenseSummary(normalizedCompanyId);
      setMessage('Buluttaki firma bilgileri cihaza alındı.');
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
      setError('E-posta ve en az 6 karakter şifre girilmeli.');
      return;
    }

    setIsAuthBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (authError) {
      logger.error('Firebase auth action failed', authError);
      setError('Hesap işlemi başarısız oldu. E-posta/şifre ve Firebase ayarlarını kontrol edin.');
    } finally {
      setIsAuthBusy(false);
    }
  }

  function clearStatus() {
    setMessage(null);
    setError(null);
  }

  function hasCompanyCode(): boolean {
    return normalizeCompanyId(values.companyId).length > 0;
  }

  function canUseCompanyCode(nextCompanyId: string): boolean {
    const normalizedNext = normalizeCompanyId(nextCompanyId);

    if (!savedCompanyId || savedCompanyId === normalizedNext) {
      return true;
    }

    setError(
      `Bu cihaz ${savedCompanyId} firmasına bağlı. Farklı firmaya geçiş normal kullanımda kapalı. Test için uygulamayı kaldırıp temiz kurulum yapın.`,
    );
    return false;
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
        <AppHeader
          title="Firma Bilgileri"
          subtitle="Firma kodu, ortak kullanım ve PDF bilgileri"
          rightAction={
            savedCompanyId ? <AppButton label="Geri" variant="ghost" onPress={() => router.back()} /> : null
          }
        />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Hesap</Text>
            <Text style={styles.statusCaption}>
              {firebaseReady
                ? user?.email ?? (user?.isAnonymous ? 'Anonim Firebase kullanıcısı' : 'Giriş yapılmadı')
                : 'Firebase config girilmedi'}
            </Text>
            <Text style={styles.statusCaption}>
              Firma kodu: {hasCompanyCode() ? normalizeCompanyId(values.companyId) : 'Girilmedi'}
            </Text>
            <Text style={styles.statusCaption}>
              Kullanıcı: {operatorName.trim() || user?.email || 'Belirtilmedi'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Giriş / Kayıt</Text>
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
              accessibilityLabel="Şifre"
              onChangeText={setPassword}
              placeholder="Şifre"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              style={styles.input}
              value={password}
            />
            <View style={styles.row}>
              <AppButton
                label="Giriş"
                variant="secondary"
                loading={isAuthBusy}
                disabled={isAuthBusy}
                onPress={() => void signIn()}
                style={styles.flexButton}
              />
              <AppButton
                label="Kayıt Ol"
                variant="secondary"
                disabled={isAuthBusy}
                onPress={() => void register()}
                style={styles.flexButton}
              />
            </View>
            <AppButton
              label="Şifremi Unuttum"
              variant="ghost"
              disabled={isAuthBusy}
              onPress={() => void resetPassword()}
            />
            <AppButton label="Çıkış Yap" variant="ghost" disabled={isAuthBusy} onPress={() => void signOut()} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Firma profili</Text>
            <Text style={styles.statusCaption}>
              Aynı firma kodunu giren cihazlar aynı bulut verilerine bağlanır. Kullanıcı adı hareket kayıtlarında
              işlemi yapan kişi olarak görünür. Firma kodunun Firebase lisans kaydında aktif olması gerekir.
            </Text>
            <View style={styles.field}>
              <Text style={styles.label}>Bu cihazdaki kullanıcı adı</Text>
              <TextInput
                accessibilityLabel="Bu cihazdaki kullanıcı adı"
                onChangeText={(value) => {
                  setOperatorName(value);
                  clearStatus();
                }}
                placeholder="Örn: Ali Usta, Mehmet Çırak"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                value={operatorName}
              />
            </View>
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
              label="Firma Koduyla Katil"
              disabled={isSaving}
              onPress={() => void joinCompanyByCode()}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lisans cihazlari</Text>
            <Text style={styles.statusCaption}>
              Bu alan sadece lisans koltugunu yonetir; musteri, tasarim, teklif veya stok verisi silmez.
            </Text>
            {licenseSummary ? (
              <View style={styles.statusCard}>
                <Text style={styles.statusTitle}>
                  Kullanici: {licenseSummary.activeUserCount}
                  {licenseSummary.maxUsers ? `/${licenseSummary.maxUsers}` : ''}
                </Text>
                {licenseSummary.seats.map((seat, index) => (
                  <Text key={seat.userId} style={styles.statusCaption}>
                    {index + 1}. {seat.userId.slice(0, 10)}... {seat.isCurrentDevice ? '(bu cihaz)' : ''}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.statusCaption}>Lisans cihaz bilgisi henuz yuklenmedi.</Text>
            )}
            <View style={styles.row}>
              <AppButton
                label="Yenile"
                variant="secondary"
                loading={isLicenseBusy}
                disabled={isLicenseBusy}
                onPress={() => void loadLicenseSummary()}
                style={styles.flexButton}
              />
              <AppButton
                label="Bu Cihazı Çıkar"
                variant="secondary"
                loading={isLicenseBusy}
                disabled={isLicenseBusy}
                onPress={() => void releaseThisDeviceSeat()}
                style={styles.flexButton}
              />
            </View>
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
