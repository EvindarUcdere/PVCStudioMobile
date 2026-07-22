import { z } from 'zod';

import {
  CompanyProfile,
  defaultCompanyProfile,
} from '../../domain/company/entities/CompanyProfile';
import { getDatabase } from '../client';

const companyProfileKey = 'company_profile';

const companyProfileSchema: z.ZodType<CompanyProfile> = z.object({
  companyId: z.string(),
  companyName: z.string(),
  ownerName: z.string(),
  phone: z.string(),
  address: z.string(),
  taxInfo: z.string(),
  pdfNote: z.string(),
  quoteValidityDays: z.number().int().nonnegative(),
});

type MetadataRow = {
  value: string | null;
};

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<MetadataRow>(
    'SELECT value FROM app_metadata WHERE key = ? LIMIT 1;',
    [companyProfileKey],
  );

  if (!row?.value) {
    return defaultCompanyProfile;
  }

  try {
    const parsed = companyProfileSchema.safeParse({
      ...defaultCompanyProfile,
      ...JSON.parse(row.value),
    });
    return parsed.success ? parsed.data : defaultCompanyProfile;
  } catch {
    return defaultCompanyProfile;
  }
}

export async function saveCompanyProfile(profile: CompanyProfile): Promise<CompanyProfile> {
  const parsed = companyProfileSchema.parse(profile);
  const database = await getDatabase();

  await database.runAsync(
    `
      INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
      VALUES (?, ?, ?);
    `,
    [companyProfileKey, JSON.stringify(parsed), new Date().toISOString()],
  );

  return parsed;
}
