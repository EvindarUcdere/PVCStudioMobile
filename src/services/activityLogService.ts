import {
  createActivityLogRepository,
} from '../database/repositories/createRepositories';
import { SaveActivityLogInput } from '../database/repositories/ActivityLogRepository';
import { logger } from './logger';

export async function recordActivity(input: SaveActivityLogInput): Promise<void> {
  try {
    const repository = await createActivityLogRepository();
    await repository.save(input);
  } catch (error) {
    logger.error('Activity log save failed', error);
  }
}
