import {
  createActivityLogRepository,
} from '../database/repositories/createRepositories';
import { SaveActivityLogInput } from '../database/repositories/ActivityLogRepository';
import { getLocalOperatorName } from '../database/repositories/LocalUserSettingsRepository';
import { getCurrentFirebaseActor } from './firebase/firebaseAuthService';
import { logger } from './logger';

export async function recordActivity(input: SaveActivityLogInput): Promise<void> {
  try {
    const repository = await createActivityLogRepository();
    const actor = getCurrentFirebaseActor();
    const localOperatorName = await getLocalOperatorName();
    await repository.save({
      ...input,
      actorUserId: input.actorUserId ?? actor.actorUserId,
      actorName: input.actorName ?? localOperatorName ?? actor.actorName,
    });
  } catch (error) {
    logger.error('Activity log save failed', error);
  }
}
