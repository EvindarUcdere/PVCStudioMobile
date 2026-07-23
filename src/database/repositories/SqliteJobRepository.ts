import { EntityNotFoundError, RepositoryError } from '../../domain/designs/errors';
import { createIsoTimestamp } from '../../domain/designs/utils/date';
import { createId } from '../../domain/designs/utils/id';
import { JobProject } from '../../domain/jobs/entities/JobProject';
import { JobRepository, ListJobProjectsOptions, SaveJobProjectInput } from './JobRepository';
import { SqliteDatabaseLike } from './SqliteDesignRepository';

type JobProjectRow = {
  id: string;
  name: string;
  customer_id: string | null;
  status: JobProject['status'];
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: JobProject['syncStatus'];
  version: number;
};

export class SqliteJobRepository implements JobRepository {
  constructor(private readonly database: SqliteDatabaseLike) {}

  async save(input: SaveJobProjectInput): Promise<JobProject> {
    const id = input.id ?? createId();
    const name = input.name.trim();

    if (!name) {
      throw new RepositoryError('Job project name is required.');
    }

    const existing = await this.getById(id);
    const now = createIsoTimestamp();
    const createdAt = existing?.createdAt ?? now;
    const version = input.version ?? (existing ? existing.version + 1 : 1);

    await this.database.runAsync(
      `
        INSERT OR REPLACE INTO job_projects
        (id, name, customer_id, status, notes, created_at, updated_at, deleted_at, sync_status, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        id,
        name,
        input.customerId ?? null,
        input.status ?? existing?.status ?? 'draft',
        normalizeOptionalText(input.notes),
        createdAt,
        now,
        input.deletedAt ?? existing?.deletedAt ?? null,
        input.syncStatus ?? 'pending',
        version,
      ],
    );

    const saved = await this.getById(id);
    if (!saved) {
      throw new RepositoryError('Saved job project could not be read.');
    }

    return saved;
  }

  async getById(id: string): Promise<JobProject | null> {
    const row = await this.database.getFirstAsync<JobProjectRow>(
      'SELECT * FROM job_projects WHERE id = ? AND deleted_at IS NULL LIMIT 1;',
      [id],
    );

    return row ? toDomain(row) : null;
  }

  async list(options: ListJobProjectsOptions = {}): Promise<JobProject[]> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (!options.includeDeleted) {
      where.push('deleted_at IS NULL');
    }

    if (options.customerId) {
      where.push('customer_id = ?');
      params.push(options.customerId);
    }

    if (options.status) {
      where.push('status = ?');
      params.push(options.status);
    }

    if (options.search) {
      where.push('name LIKE ?');
      params.push(`%${options.search}%`);
    }

    params.push(options.limit ?? 100, options.offset ?? 0);

    const rows = await this.database.getAllAsync<JobProjectRow>(
      `
        SELECT * FROM job_projects
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?;
      `,
      params,
    );

    return rows.map(toDomain);
  }

  async updateStatus(id: string, status: JobProject['status']): Promise<JobProject> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new EntityNotFoundError('JobProject', id);
    }

    return this.save({ ...existing, status, syncStatus: 'pending' });
  }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toDomain(row: JobProjectRow): JobProject {
  return {
    id: row.id,
    name: row.name,
    customerId: row.customer_id,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status,
    version: row.version,
  };
}
