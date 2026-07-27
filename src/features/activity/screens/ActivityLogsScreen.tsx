import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { createActivityLogRepository } from '../../../database/repositories/createRepositories';
import { ActivityLog, activityLogTypeLabels } from '../../../domain/activity/entities/ActivityLog';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';

export function ActivityLogsScreen() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const repository = await createActivityLogRepository();
      setLogs(await repository.list({ limit: 200, search }));
    } catch (loadError) {
      logger.error('Activity logs screen load failed', loadError);
      setError('Hareketler yuklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      void loadLogs();
    }, [loadLogs]),
  );

  return (
    <AppScreen scroll={false}>
      <AppHeader
        title="Hareketler"
        subtitle="Islem gecmisi ve sistem kayitlari"
        rightAction={<AppButton label="Geri" variant="ghost" onPress={() => router.back()} />}
      />
      <TextInput
        accessibilityLabel="Hareket ara"
        onChangeText={setSearch}
        placeholder="Musteri, islem veya aciklama ara"
        placeholderTextColor={colors.textSecondary}
        style={styles.searchInput}
        value={search}
      />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <EmptyState
          title="Hareketler yuklenemedi"
          description={error}
          action={<AppButton label="Tekrar Dene" onPress={() => void loadLogs()} />}
        />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={logs.length === 0 ? styles.emptyList : styles.list}
          renderItem={({ item }) => <ActivityLogCard log={item} />}
          ListEmptyComponent={
            <EmptyState
              title="Henuz hareket yok"
              description="Yeni is, odeme, teklif ve atolye islemleri burada gorunecek."
            />
          }
        />
      )}
    </AppScreen>
  );
}

function ActivityLogCard({ log }: { log: ActivityLog }) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.titleColumn}>
          <Text style={styles.title}>{log.title}</Text>
          <Text style={styles.caption}>{activityLogTypeLabels[log.type]}</Text>
        </View>
        <Text style={styles.date}>{formatDateTime(log.createdAt)}</Text>
      </View>
      {log.customerName ? <Info label="Musteri" value={log.customerName} /> : null}
      {log.actorName ? <Info label="Islemi yapan" value={log.actorName} /> : null}
      {log.description ? <Text style={styles.description}>{log.description}</Text> : null}
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

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  searchInput: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    gap: spacing.sm,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  titleColumn: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  date: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  description: {
    ...typography.caption,
    color: colors.textPrimary,
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
