import { DesignNode } from '../../designs/entities/DesignNode';
import { TemplateCategory } from '../enums/TemplateCategory';
import { TemplateSource } from '../enums/TemplateSource';

export type DesignTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  source: TemplateSource;
  rootNode: DesignNode;
  defaultWidth: number;
  defaultHeight: number;
  previewAspectRatio: number;
  isFavorite: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
