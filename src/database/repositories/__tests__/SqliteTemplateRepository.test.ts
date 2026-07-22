import { describe, expect, it } from 'vitest';

import { DataCorruptionError } from '../../../domain/designs/errors';
import { DesignTemplateRow, templateToRow } from '../../mappers/templateMapper';
import { seedSystemTemplates } from '../../seeds/seedSystemTemplates';
import { systemTemplates } from '../../seeds/systemTemplates';
import { SqliteDatabaseLike } from '../SqliteDesignRepository';
import { SqliteTemplateRepository } from '../SqliteTemplateRepository';

class TemplateMemoryDatabase implements SqliteDatabaseLike {
  readonly templates = new Map<string, DesignTemplateRow>();

  async execAsync(_sql: string): Promise<void> {}

  async runAsync(sql: string, params: unknown[] = []): Promise<unknown> {
    const normalized = sql.toLowerCase();

    if (normalized.includes('insert into design_templates')) {
      const row: DesignTemplateRow = {
        id: String(params[0]),
        name: String(params[1]),
        description: params[2] === null ? null : String(params[2]),
        category: String(params[3]),
        source: String(params[4]),
        root_node_json: String(params[5]),
        default_width: Number(params[6]),
        default_height: Number(params[7]),
        preview_aspect_ratio: Number(params[8]),
        is_favorite: this.templates.get(String(params[0]))?.is_favorite ?? Number(params[9]),
        sort_order: Number(params[10]),
        is_active: Number(params[11]),
        created_at: String(params[12]),
        updated_at: String(params[13]),
      };
      this.templates.set(row.id, row);
    }

    if (normalized.startsWith('update design_templates set is_favorite')) {
      const id = String(params[2]);
      const row = this.templates.get(id);
      if (row) {
        this.templates.set(id, {
          ...row,
          is_favorite: Number(params[0]),
          updated_at: String(params[1]),
        });
      }
    }

    return {};
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    if (!sql.toLowerCase().includes('from design_templates')) {
      return null;
    }

    const row = this.templates.get(String(params[0]));
    if (!row || row.is_active !== 1) {
      return null;
    }

    return row as T;
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const normalized = sql.toLowerCase();
    let rows = Array.from(this.templates.values());
    let paramIndex = 0;

    if (normalized.includes('is_active = 1')) {
      rows = rows.filter((row) => row.is_active === 1);
    }

    if (normalized.includes('category = ?')) {
      rows = rows.filter((row) => row.category === params[paramIndex]);
      paramIndex += 1;
    }

    if (normalized.includes('source = ?')) {
      rows = rows.filter((row) => row.source === params[paramIndex]);
      paramIndex += 1;
    }

    if (normalized.includes('is_favorite = 1')) {
      rows = rows.filter((row) => row.is_favorite === 1);
    }

    if (normalized.includes('lower(name) like lower(?)')) {
      const search = String(params[paramIndex]).replaceAll('%', '').toLocaleLowerCase('tr-TR');
      rows = rows.filter(
        (row) =>
          row.name.toLocaleLowerCase('tr-TR').includes(search) ||
          (row.description ?? '').toLocaleLowerCase('tr-TR').includes(search),
      );
    }

    return rows.sort((left, right) => left.sort_order - right.sort_order) as T[];
  }
}

describe('SqliteTemplateRepository', () => {
  it('seeds 31 templates without duplicates and preserves favorites', async () => {
    const database = new TemplateMemoryDatabase();
    const repository = new SqliteTemplateRepository(database);

    await seedSystemTemplates(database);
    await repository.setFavorite('tpl-double-sash-window', true);
    await seedSystemTemplates(database);

    expect(database.templates.size).toBe(31);
    expect((await repository.getById('tpl-double-sash-window'))?.isFavorite).toBe(true);
  });

  it('lists active templates with category, search and favorite filters', async () => {
    const database = new TemplateMemoryDatabase();
    const repository = new SqliteTemplateRepository(database);
    await seedSystemTemplates(database);
    await repository.setFavorite('tpl-single-balcony-door', true);

    expect(await repository.list()).toHaveLength(31);
    expect(await repository.list({ category: 'balcony' })).toHaveLength(4);
    expect(await repository.list({ search: 'kapı' })).not.toHaveLength(0);
    expect(await repository.list({ favoritesOnly: true })).toHaveLength(1);
  });

  it('throws on corrupted root JSON', async () => {
    const database = new TemplateMemoryDatabase();
    const repository = new SqliteTemplateRepository(database);
    const row = templateToRow(systemTemplates[0]!);
    database.templates.set(row.id, { ...row, root_node_json: '{broken' });

    await expect(repository.getById(row.id)).rejects.toBeInstanceOf(DataCorruptionError);
  });
});
