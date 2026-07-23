import { router } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { routes } from '../../../constants/routes';
import { colors, spacing } from '../../../theme';
import { TemplateCard } from '../components/TemplateCard';
import { TemplateCategoryTabs } from '../components/TemplateCategoryTabs';
import { TemplateSearchBar } from '../components/TemplateSearchBar';
import { useTemplates } from '../hooks/useTemplates';

type TemplateCatalogScreenProps = {
  customerId?: string | null;
  jobId?: string | null;
};

export function TemplateCatalogScreen({ customerId = null, jobId = null }: TemplateCatalogScreenProps) {
  const { width } = useWindowDimensions();
  const columns = width < 390 ? 1 : 2;
  const {
    templates,
    filter,
    search,
    isLoading,
    error,
    setFilter,
    setSearch,
    reload,
    toggleFavorite,
  } = useTemplates();

  return (
    <AppScreen scroll={false}>
      <AppHeader title="Yeni Tasarım" subtitle="Hazır bir model seçerek başlayın" />
      <View style={styles.controls}>
        <TemplateSearchBar value={search} onChangeText={setSearch} />
        <TemplateCategoryTabs selected={filter} onSelect={setFilter} />
      </View>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <EmptyState
          title="Hazır modeller yüklenemedi."
          description={error}
          action={<AppButton label="Tekrar Dene" onPress={reload} />}
        />
      ) : (
        <FlatList
          data={templates}
          key={columns}
          keyExtractor={(item) => item.id}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? styles.row : undefined}
          contentContainerStyle={templates.length === 0 ? styles.emptyList : styles.list}
          renderItem={({ item }) => (
            <View style={columns > 1 ? styles.gridItem : styles.singleItem}>
              <TemplateCard
                template={item}
                onPress={() =>
                  router.push(
                    jobId
                      ? routes.templateDetailsForJob(item.id, jobId, customerId)
                      : customerId
                      ? routes.templateDetailsForCustomer(item.id, customerId)
                      : routes.templateDetails(item.id),
                  )
                }
                onToggleFavorite={() => void toggleFavorite(item)}
              />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              title="Bu filtreye uygun model bulunamadı."
              description="Arama metnini temizleyerek veya farklı bir kategori seçerek tekrar deneyin."
            />
          }
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
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
  row: {
    gap: spacing.md,
  },
  gridItem: {
    flex: 1,
    marginBottom: spacing.md,
  },
  singleItem: {
    marginBottom: spacing.md,
  },
});
