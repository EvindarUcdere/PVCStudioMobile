export type ActivityLogType =
  | 'job_created'
  | 'quote_accepted'
  | 'payment_saved'
  | 'workshop_status_changed'
  | 'stock_consumed';

export type ActivityLog = {
  id: string;
  type: ActivityLogType;
  title: string;
  description: string | null;
  entityType: string | null;
  entityId: string | null;
  customerName: string | null;
  createdAt: string;
};

export const activityLogTypeLabels: Record<ActivityLogType, string> = {
  job_created: 'Is olusturuldu',
  quote_accepted: 'Teklif onaylandi',
  payment_saved: 'Odeme kaydedildi',
  workshop_status_changed: 'Atolye durumu degisti',
  stock_consumed: 'Stok dusuldu',
};
