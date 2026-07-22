export const jobStatuses = [
  'draft',
  'quoted',
  'approved',
  'production',
  'installation',
  'done',
  'canceled',
] as const;

export type JobStatus = (typeof jobStatuses)[number];

export const jobStatusLabels: Record<JobStatus, string> = {
  draft: 'Taslak',
  quoted: 'Teklif',
  approved: 'Onay',
  production: 'Uretim',
  installation: 'Montaj',
  done: 'Bitti',
  canceled: 'Iptal',
};
