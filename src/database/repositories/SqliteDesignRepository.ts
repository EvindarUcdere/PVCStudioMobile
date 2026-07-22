import { z } from 'zod';

import {
  DataCorruptionError,
  DomainValidationError,
  EntityNotFoundError,
  RepositoryError,
} from '../../domain/designs/errors';
import { DesignProject } from '../../domain/designs/entities/DesignProject';
import { validateDesignTree } from '../../domain/designs/rules/validateDesignTree';
import { designProjectSchema } from '../../domain/designs/schemas/designProjectSchema';
import { cloneDesignProject } from '../../domain/designs/utils/cloneDesignProject';
import { createIsoTimestamp } from '../../domain/designs/utils/date';
import { DesignProjectRow, toDatabaseRow, toDomain } from '../mappers/designMapper';
import { DesignRepository, ListDesignsOptions } from './DesignRepository';

export type SqliteDatabaseLike = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
};

function validateProject(project: DesignProject): void {
  try {
    designProjectSchema.parse(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new DomainValidationError(
        'Design project validation failed.',
        error.issues.map((issue) => issue.message),
      );
    }

    throw error;
  }

  const treeValidation = validateDesignTree(project.rootNode);

  if (!treeValidation.isValid) {
    throw new DomainValidationError('Design tree validation failed.', treeValidation.errors);
  }
}

function mapRepositoryError(error: unknown, message: string): RepositoryError {
  if (
    error instanceof RepositoryError ||
    error instanceof DomainValidationError ||
    error instanceof DataCorruptionError
  ) {
    return error;
  }

  return new RepositoryError(message, { cause: error });
}

export class SqliteDesignRepository implements DesignRepository {
  constructor(private readonly database: SqliteDatabaseLike) {}

  async create(project: DesignProject): Promise<DesignProject> {
    try {
      validateProject(project);
      const row = toDatabaseRow(project);

      await this.database.execAsync('BEGIN TRANSACTION;');
      try {
        await this.database.runAsync(
          `INSERT INTO design_projects
           (id, name, customer_id, template_id, width, height, quantity, job_status, job_name, unit, root_node_json,
            profile_system_json, default_glass_json, accessories_json, notes, created_at,
            updated_at, deleted_at, sync_status, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            row.id,
            row.name,
            row.customer_id,
            row.template_id,
            row.width,
            row.height,
            row.quantity,
            row.job_status,
            row.job_name,
            row.unit,
            row.root_node_json,
            row.profile_system_json,
            row.default_glass_json,
            row.accessories_json,
            row.notes,
            row.created_at,
            row.updated_at,
            row.deleted_at,
            row.sync_status,
            row.version,
          ],
        );
        await this.database.execAsync('COMMIT;');
      } catch (error) {
        await this.database.execAsync('ROLLBACK;');
        throw error;
      }

      const saved = await this.getById(row.id);
      if (!saved) {
        throw new RepositoryError('Created design project could not be read.');
      }

      return saved;
    } catch (error) {
      throw mapRepositoryError(error, 'Design project create failed.');
    }
  }

  async getById(id: string): Promise<DesignProject | null> {
    try {
      const row = await this.database.getFirstAsync<DesignProjectRow>(
        'SELECT * FROM design_projects WHERE id = ? AND deleted_at IS NULL LIMIT 1;',
        [id],
      );

      return row ? toDomain(row) : null;
    } catch (error) {
      throw mapRepositoryError(error, 'Design project read failed.');
    }
  }

  async list(options: ListDesignsOptions = {}): Promise<DesignProject[]> {
    try {
      const where: string[] = [];
      const params: unknown[] = [];

      if (!options.includeDeleted) {
        where.push('deleted_at IS NULL');
      }

      if (options.customerId) {
        where.push('customer_id = ?');
        params.push(options.customerId);
      }

      if (options.jobStatus) {
        where.push('job_status = ?');
        params.push(options.jobStatus);
      }

      if (options.search) {
        where.push('name LIKE ?');
        params.push(`%${options.search}%`);
      }

      const limit = options.limit ?? 100;
      const offset = options.offset ?? 0;
      params.push(limit, offset);

      const sql = `
        SELECT * FROM design_projects
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?;
      `;

      const rows = await this.database.getAllAsync<DesignProjectRow>(sql, params);
      return rows.map((row) => toDomain(row));
    } catch (error) {
      throw mapRepositoryError(error, 'Design project list failed.');
    }
  }

  async update(project: DesignProject): Promise<DesignProject> {
    try {
      const existing = await this.getById(project.id);
      if (!existing) {
        throw new EntityNotFoundError('DesignProject', project.id);
      }

      const nextProject: DesignProject = {
        ...project,
        updatedAt: createIsoTimestamp(),
        version: existing.version + 1,
      };
      validateProject(nextProject);
      const row = toDatabaseRow(nextProject);

      await this.database.execAsync('BEGIN TRANSACTION;');
      try {
        await this.database.runAsync(
          `UPDATE design_projects SET
            name = ?,
            customer_id = ?,
            template_id = ?,
            width = ?,
            height = ?,
            quantity = ?,
            job_status = ?,
            job_name = ?,
            unit = ?,
            root_node_json = ?,
            profile_system_json = ?,
            default_glass_json = ?,
            accessories_json = ?,
            notes = ?,
            updated_at = ?,
            sync_status = ?,
            version = ?
           WHERE id = ? AND deleted_at IS NULL;`,
          [
            row.name,
            row.customer_id,
            row.template_id,
            row.width,
            row.height,
            row.quantity,
            row.job_status,
            row.job_name,
            row.unit,
            row.root_node_json,
            row.profile_system_json,
            row.default_glass_json,
            row.accessories_json,
            row.notes,
            row.updated_at,
            row.sync_status,
            row.version,
            row.id,
          ],
        );
        await this.database.execAsync('COMMIT;');
      } catch (error) {
        await this.database.execAsync('ROLLBACK;');
        throw error;
      }

      const saved = await this.getById(project.id);
      if (!saved) {
        throw new RepositoryError('Updated design project could not be read.');
      }

      return saved;
    } catch (error) {
      throw mapRepositoryError(error, 'Design project update failed.');
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.markDeleted(id, true);
  }

  async restore(id: string): Promise<void> {
    await this.markDeleted(id, false);
  }

  async duplicate(id: string, newName?: string): Promise<DesignProject> {
    const original = await this.getById(id);
    if (!original) {
      throw new EntityNotFoundError('DesignProject', id);
    }

    return this.create(cloneDesignProject(original, newName));
  }

  private async markDeleted(id: string, deleted: boolean): Promise<void> {
    try {
      const row = await this.database.getFirstAsync<Pick<DesignProjectRow, 'id' | 'version'>>(
        'SELECT id, version FROM design_projects WHERE id = ? LIMIT 1;',
        [id],
      );

      if (!row) {
        throw new EntityNotFoundError('DesignProject', id);
      }

      const now = createIsoTimestamp();
      await this.database.runAsync(
        `UPDATE design_projects
         SET deleted_at = ?, updated_at = ?, version = ?
         WHERE id = ?;`,
        [deleted ? now : null, now, row.version + 1, id],
      );
    } catch (error) {
      throw mapRepositoryError(error, 'Design project delete state change failed.');
    }
  }
}
