export const syncStatuses = ['local', 'pending', 'synced', 'conflict'] as const;

export type SyncStatus = (typeof syncStatuses)[number];
