import { DesignTemplate } from '../../domain/templates/entities/DesignTemplate';
import { TemplateCategory } from '../../domain/templates/enums/TemplateCategory';
import { TemplateSource } from '../../domain/templates/enums/TemplateSource';

export type ListTemplatesOptions = {
  category?: TemplateCategory;
  source?: TemplateSource;
  favoritesOnly?: boolean;
  search?: string;
  includeInactive?: boolean;
};

export interface TemplateRepository {
  getById(id: string): Promise<DesignTemplate | null>;
  list(options?: ListTemplatesOptions): Promise<DesignTemplate[]>;
  setFavorite(id: string, isFavorite: boolean): Promise<void>;
}
