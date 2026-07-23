import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { createStockRepository } from '../../../database/repositories/createRepositories';
import {
  StockItem,
  StockItemType,
  StockUnit,
  stockItemTypeLabels,
  stockUnitLabels,
} from '../../../domain/inventory/entities/StockItem';
import { backupStockItemToCloud } from '../../../services/firebase/fullSyncService';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';

type StockForm = {
  name: string;
  type: StockItemType;
  quantity: string;
  unit: StockUnit;
  minimumQuantity: string;
  purchasePrice: string;
  notes: string;
};

const defaultForm: StockForm = {
  name: '',
  type: 'pvc_profile',
  quantity: '',
  unit: 'meter',
  minimumQuantity: '',
  purchasePrice: '',
  notes: '',
};

const typeOptions: StockItemType[] = ['pvc_profile', 'glass', 'accessory', 'hardware', 'consumable', 'other'];
const unitOptions: StockUnit[] = ['meter', 'square_meter', 'piece', 'set', 'kg', 'box'];

export function StockScreen() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [form, setForm] = useState<StockForm>(defaultForm);
  const [showInactive, setShowInactive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lowStockItems = useMemo(
    () => items.filter((item) => item.isActive && item.quantity <= item.minimumQuantity),
    [items],
  );

  const loadStock = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const repository = await createStockRepository();
      setItems(await repository.list({ includeInactive: showInactive, limit: 300 }));
    } catch (loadError) {
      logger.error('Stock screen load failed', loadError);
      setError('Stok bilgileri yuklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, [showInactive]);

  useFocusEffect(
    useCallback(() => {
      void loadStock();
    }, [loadStock]),
  );

  function updateForm<Key extends keyof StockForm>(key: Key, value: StockForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
    setMessage(null);
  }

  async function saveItem() {
    const quantity = parseRequiredNumber(form.quantity);
    const minimumQuantity = parseRequiredNumber(form.minimumQuantity);
    const purchasePrice = parseOptionalNumber(form.purchasePrice);

    if (!form.name.trim() || quantity === null || minimumQuantity === null || purchasePrice === undefined) {
      setError('Urun adi, miktar ve minimum stok dogru girilmeli.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const repository = await createStockRepository();
      const saved = await repository.save({
        name: form.name,
        type: form.type,
        quantity,
        unit: form.unit,
        minimumQuantity,
        purchasePrice,
        notes: nullableTrim(form.notes),
      });
      void backupStockItemToCloud(saved);
      setForm(defaultForm);
      setMessage('Stok urunu kaydedildi.');
      await loadStock();
    } catch (saveError) {
      logger.error('Stock item save failed', saveError);
      setError('Stok urunu kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleActive(item: StockItem) {
    try {
      const repository = await createStockRepository();
      const saved = await repository.setActive(item.id, !item.isActive);
      void backupStockItemToCloud(saved);
      await loadStock();
    } catch (toggleError) {
      logger.error('Stock item active toggle failed', toggleError);
      setError('Stok durumu guncellenemedi.');
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
      <AppScreen scroll={false}>
        <AppHeader
          title="Stok"
          subtitle="PVC, cam ve aksesuar takibi"
          rightAction={<AppButton label="Geri" variant="ghost" onPress={() => router.back()} />}
        />
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
            ListHeaderComponent={
              <View style={styles.headerContent}>
                <AppCard style={styles.summaryCard}>
                  <Text style={styles.sectionTitle}>Stok ozeti</Text>
                  <Text style={styles.caption}>
                    Aktif urun: {items.filter((item) => item.isActive).length} - Dusuk stok: {lowStockItems.length}
                  </Text>
                  {lowStockItems.length > 0 ? (
                    <Text style={styles.warning}>Minimum altina inen urunler var.</Text>
                  ) : (
                    <Text style={styles.success}>Dusuk stok yok.</Text>
                  )}
                </AppCard>

                <AppCard style={styles.formCard}>
                  <Text style={styles.sectionTitle}>Stok urunu ekle</Text>
                  <TextInput
                    accessibilityLabel="Urun adi"
                    onChangeText={(value) => updateForm('name', value)}
                    placeholder="Orn: 70'lik beyaz profil"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                    value={form.name}
                  />
                  <View style={styles.chips}>
                    {typeOptions.map((type) => (
                      <Chip
                        key={type}
                        label={stockItemTypeLabels[type]}
                        selected={form.type === type}
                        onPress={() => updateForm('type', type)}
                      />
                    ))}
                  </View>
                  <View style={styles.row}>
                    <TextInput
                      accessibilityLabel="Miktar"
                      keyboardType="numeric"
                      onChangeText={(value) => updateForm('quantity', value)}
                      placeholder="Miktar"
                      placeholderTextColor={colors.textSecondary}
                      style={[styles.input, styles.flexInput]}
                      value={form.quantity}
                    />
                    <TextInput
                      accessibilityLabel="Minimum stok"
                      keyboardType="numeric"
                      onChangeText={(value) => updateForm('minimumQuantity', value)}
                      placeholder="Min."
                      placeholderTextColor={colors.textSecondary}
                      style={[styles.input, styles.flexInput]}
                      value={form.minimumQuantity}
                    />
                  </View>
                  <View style={styles.chips}>
                    {unitOptions.map((unit) => (
                      <Chip
                        key={unit}
                        label={stockUnitLabels[unit]}
                        selected={form.unit === unit}
                        onPress={() => updateForm('unit', unit)}
                      />
                    ))}
                  </View>
                  <TextInput
                    accessibilityLabel="Alis fiyati"
                    keyboardType="numeric"
                    onChangeText={(value) => updateForm('purchasePrice', value)}
                    placeholder="Alis fiyati opsiyonel"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                    value={form.purchasePrice}
                  />
                  <TextInput
                    accessibilityLabel="Not"
                    multiline
                    onChangeText={(value) => updateForm('notes', value)}
                    placeholder="Not"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.input, styles.noteInput]}
                    textAlignVertical="top"
                    value={form.notes}
                  />
                  {message ? <Text style={styles.success}>{message}</Text> : null}
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <AppButton
                    label="Kaydet"
                    loading={isSaving}
                    disabled={isSaving}
                    onPress={() => void saveItem()}
                  />
                </AppCard>
                <View style={styles.listHeader}>
                  <Text style={styles.sectionTitle}>Stok listesi</Text>
                  <AppButton
                    label={showInactive ? 'Sadece Aktif' : 'Pasifleri Goster'}
                    variant="secondary"
                    onPress={() => setShowInactive((current) => !current)}
                    style={styles.smallButton}
                  />
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <StockCard item={item} onToggleActive={() => void toggleActive(item)} />
            )}
            ListEmptyComponent={
              <EmptyState
                title="Stok urunu yok"
                description="Kullanmak isterseniz PVC, cam ve aksesuar stoklarini buradan takip edebilirsiniz."
              />
            }
          />
        )}
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

function StockCard({ item, onToggleActive }: { item: StockItem; onToggleActive: () => void }) {
  const lowStock = item.isActive && item.quantity <= item.minimumQuantity;

  return (
    <AppCard style={!item.isActive ? styles.inactiveStockCard : styles.stockCard}>
      <View style={styles.cardHeader}>
        <View style={styles.titleColumn}>
          <Text style={styles.itemTitle}>{item.name}</Text>
          <Text style={styles.caption}>{stockItemTypeLabels[item.type]}</Text>
        </View>
        <View style={[styles.badge, lowStock ? styles.lowBadge : styles.okBadge]}>
          <Text style={styles.badgeText}>{lowStock ? 'Dusuk' : item.isActive ? 'Aktif' : 'Pasif'}</Text>
        </View>
      </View>
      <Info label="Miktar" value={`${formatNumber(item.quantity)} ${stockUnitLabels[item.unit]}`} />
      <Info label="Minimum" value={`${formatNumber(item.minimumQuantity)} ${stockUnitLabels[item.unit]}`} />
      {item.purchasePrice !== null ? <Info label="Alis" value={formatCurrency(item.purchasePrice)} /> : null}
      {item.notes ? <Text style={styles.caption}>{item.notes}</Text> : null}
      <AppButton
        label={item.isActive ? 'Pasife Al' : 'Aktif Yap'}
        variant="secondary"
        onPress={onToggleActive}
      />
    </AppCard>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

function parseRequiredNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseOptionalNumber(value: string): number | null | undefined {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function nullableTrim(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString('tr-TR')} TL`;
}

function formatNumber(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  headerContent: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  summaryCard: {
    gap: spacing.xs,
  },
  formCard: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  warning: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '700',
  },
  success: {
    ...typography.caption,
    color: colors.success,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.textPrimary,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  noteInput: {
    minHeight: 72,
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexInput: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: colors.surface,
  },
  pressed: {
    opacity: 0.86,
  },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  smallButton: {
    minHeight: 38,
    paddingHorizontal: spacing.sm,
  },
  stockCard: {
    gap: spacing.sm,
  },
  inactiveStockCard: {
    gap: spacing.sm,
    opacity: 0.64,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  titleColumn: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  lowBadge: {
    backgroundColor: colors.warning,
  },
  okBadge: {
    backgroundColor: colors.primary,
  },
  badgeText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'right',
  },
});
