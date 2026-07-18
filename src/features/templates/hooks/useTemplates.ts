import { useCallback, useEffect, useMemo, useState } from 'react';

import { DesignTemplate } from '../../../domain/templates/entities/DesignTemplate';
import { TemplateCategory } from '../../../domain/templates/enums/TemplateCategory';
import { initializeDatabase } from '../../../database/initializeDatabase';
import { createTemplateRepository } from '../../../database/repositories/createRepositories';
import { ListTemplatesOptions } from '../../../database/repositories/TemplateRepository';
import { logger } from '../../../services/logger';

export type TemplateFilter = TemplateCategory | 'all' | 'favorites';

export function useTemplates() {
  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [filter, setFilter] = useState<TemplateFilter>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await initializeDatabase();
      const repository = await createTemplateRepository();
      const options: ListTemplatesOptions = {
        favoritesOnly: filter === 'favorites',
      };
      if (filter !== 'all' && filter !== 'favorites') {
        options.category = filter;
      }
      if (search.trim().length > 0) {
        options.search = search.trim();
      }
      setTemplates(await repository.list(options));
    } catch (loadError) {
      logger.error('Template list load failed', loadError);
      setError('Hazır modeller yüklenemedi. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const toggleFavorite = useCallback(async (template: DesignTemplate) => {
    const nextFavorite = !template.isFavorite;
    setTemplates((current) =>
      current.map((item) =>
        item.id === template.id ? { ...item, isFavorite: nextFavorite } : item,
      ),
    );

    try {
      const repository = await createTemplateRepository();
      await repository.setFavorite(template.id, nextFavorite);
    } catch (favoriteError) {
      logger.error('Template favorite update failed', favoriteError);
      setTemplates((current) =>
        current.map((item) =>
          item.id === template.id ? { ...item, isFavorite: template.isFavorite } : item,
        ),
      );
      setError('Favori durumu güncellenemedi. Lütfen tekrar deneyin.');
    }
  }, []);

  return useMemo(
    () => ({
      templates,
      filter,
      search,
      isLoading,
      error,
      setFilter,
      setSearch,
      reload: loadTemplates,
      toggleFavorite,
    }),
    [templates, filter, search, isLoading, error, loadTemplates, toggleFavorite],
  );
}
