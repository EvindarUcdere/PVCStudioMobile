import { RepositoryError } from '../../domain/designs/errors';
import { DesignTemplateRow, templateToDomain } from '../mappers/templateMapper';
import { ListTemplatesOptions, TemplateRepository } from './TemplateRepository';
import { SqliteDatabaseLike } from './SqliteDesignRepository';

function mapTemplateRepositoryError(error: unknown, message: string): RepositoryError {
  if (error instanceof RepositoryError) {
    return error;
  }

  return new RepositoryError(message, { cause: error });
}

export class SqliteTemplateRepository implements TemplateRepository {
  constructor(private readonly database: SqliteDatabaseLike) {}

  async getById(id: string) {
    try {
      const row = await this.database.getFirstAsync<DesignTemplateRow>(
        'SELECT * FROM design_templates WHERE id = ? AND is_active = 1 LIMIT 1;',
        [id],
      );
      return row ? templateToDomain(row) : null;
    } catch (error) {
      throw mapTemplateRepositoryError(error, 'Template read failed.');
    }
  }

  async list(options: ListTemplatesOptions = {}) {
    try {
      const where: string[] = [];
      const params: unknown[] = [];

      if (!options.includeInactive) {
        where.push('is_active = 1');
      }

      if (options.category) {
        where.push('category = ?');
        params.push(options.category);
      }

      if (options.source) {
        where.push('source = ?');
        params.push(options.source);
      }

      if (options.favoritesOnly) {
        where.push('is_favorite = 1');
      }

      if (options.search) {
        where.push('(LOWER(name) LIKE LOWER(?) OR LOWER(COALESCE(description, "")) LIKE LOWER(?))');
        params.push(`%${options.search}%`, `%${options.search}%`);
      }

      const rows = await this.database.getAllAsync<DesignTemplateRow>(
        `
          SELECT * FROM design_templates
          ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
          ORDER BY sort_order ASC;
        `,
        params,
      );

      return rows.map((row) => templateToDomain(row));
    } catch (error) {
      throw mapTemplateRepositoryError(error, 'Template list failed.');
    }
  }

  async setFavorite(id: string, isFavorite: boolean): Promise<void> {
    try {
      await this.database.runAsync(
        'UPDATE design_templates SET is_favorite = ?, updated_at = ? WHERE id = ? AND is_active = 1;',
        [isFavorite ? 1 : 0, new Date().toISOString(), id],
      );
    } catch (error) {
      throw mapTemplateRepositoryError(error, 'Template favorite update failed.');
    }
  }
}
