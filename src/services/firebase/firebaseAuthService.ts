import { User, onAuthStateChanged, signInAnonymously } from 'firebase/auth';

import { logger } from '../logger';
import { getFirebaseServices } from './firebaseConfig';

export async function ensureFirebaseUser(): Promise<User | null> {
  const services = getFirebaseServices();

  if (!services) {
    return null;
  }

  if (services.auth.currentUser) {
    return services.auth.currentUser;
  }

  try {
    const credential = await signInAnonymously(services.auth);
    return credential.user;
  } catch (error) {
    logger.error('Firebase anonymous sign-in failed', error);
    return null;
  }
}

export function subscribeFirebaseUser(callback: (user: User | null) => void): () => void {
  const services = getFirebaseServices();

  if (!services) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(services.auth, callback);
}
