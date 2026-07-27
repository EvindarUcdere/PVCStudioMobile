import { DatabaseMigration } from './types';

export const activityLogActorMigration: DatabaseMigration = {
  id: '015_activity_log_actor',
  async up(database) {
    await database.execAsync(`
      ALTER TABLE activity_logs ADD COLUMN actor_user_id TEXT;
    `).catch(() => undefined);

    await database.execAsync(`
      ALTER TABLE activity_logs ADD COLUMN actor_name TEXT;
    `).catch(() => undefined);
  },
};
