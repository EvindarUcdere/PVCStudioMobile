import { ActivityLog, ActivityLogType } from '../../domain/activity/entities/ActivityLog';
import { createIsoTimestamp } from '../../domain/designs/utils/date';
import { createId } from '../../domain/designs/utils/id';
import { ActivityLogRepository, SaveActivityLogInput } from './ActivityLogRepository';
import { SqliteDatabaseLike } from './SqliteDesignRepository';

type ActivityLogRow = {
  id: string;
  type: ActivityLogType;
  title: string;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  customer_name: string | null;
  created_at: string;
};

export class SqliteActivityLogRepository implements ActivityLogRepository {
  constructor(private readonly database: SqliteDatabaseLike) {}

  async save(input: SaveActivityLogInput): Promise<ActivityLog> {
    const id = createId();
    const now = createIsoTimestamp();
    await this.database.runAsync(
      `
        INSERT INTO activity_logs
        (id, type, title, description, entity_type, entity_id, customer_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        id,
        input.type,
        input.title.trim(),
        normalizeOptionalText(input.description),
        normalizeOptionalText(input.entityType),
        normalizeOptionalText(input.entityId),
        normalizeOptionalText(input.customerName),
        now,
      ],
    );

    return {
      id,
      type: input.type,
      title: input.title.trim(),
      description: normalizeOptionalText(input.description),
      entityType: normalizeOptionalText(input.entityType),
      entityId: normalizeOptionalText(input.entityId),
      customerName: normalizeOptionalText(input.customerName),
      createdAt: now,
    };
  }

  async list(options: { limit?: number; search?: string; entityType?: string; entityId?: string } = {}): Promise<ActivityLog[]> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (options.entityType) {
      where.push('entity_type = ?');
      params.push(options.entityType);
    }

    if (options.entityId) {
      where.push('entity_id = ?');
      params.push(options.entityId);
    }

    if (options.search?.trim()) {
      where.push('(title LIKE ? OR description LIKE ? OR customer_name LIKE ?)');
      const query = `%${options.search.trim()}%`;
      params.push(query, query, query);
    }

    params.push(options.limit ?? 200);

    const rows = await this.database.getAllAsync<ActivityLogRow>(
      `
        SELECT * FROM activity_logs
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY created_at DESC
        LIMIT ?;
      `,
      params,
    );

    return rows.map(toDomain);
  }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toDomain(row: ActivityLogRow): ActivityLog {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    entityType: row.entity_type,
    entityId: row.entity_id,
    customerName: row.customer_name,
    createdAt: row.created_at,
  };
}
