import { ActivityLog, ActivityLogType } from '../../domain/activity/entities/ActivityLog';

export type SaveActivityLogInput = {
  type: ActivityLogType;
  title: string;
  description?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  customerName?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
};

export interface ActivityLogRepository {
  save(input: SaveActivityLogInput): Promise<ActivityLog>;
  upsert(log: ActivityLog): Promise<ActivityLog>;
  list(options?: { limit?: number; search?: string; entityType?: string; entityId?: string }): Promise<ActivityLog[]>;
}
