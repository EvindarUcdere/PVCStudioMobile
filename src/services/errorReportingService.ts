import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

import { configureRemoteErrorReporter } from './logger';
import { getFirebaseServices } from './firebase/firebaseConfig';
import { getCloudWorkspacePath } from './firebase/companyWorkspaceService';

let isInstalled = false;
let isReporting = false;

export function installRemoteErrorReporting(): void {
  if (isInstalled) {
    return;
  }

  isInstalled = true;
  configureRemoteErrorReporter((message, error) => {
    void reportError(message, error);
  });
}

async function reportError(message: string, error?: unknown): Promise<void> {
  if (isReporting) {
    return;
  }

  const services = getFirebaseServices();
  if (!services) {
    return;
  }

  isReporting = true;
  try {
    const workspace = await getCloudWorkspacePath();
    if (!workspace) {
      return;
    }

    await addDoc(collection(services.firestore, workspace.rootCollection, workspace.rootId, 'errorReports'), {
      message,
      errorMessage: getErrorMessage(error),
      stack: getErrorStack(error),
      createdAt: serverTimestamp(),
    });
  } catch {
    // Remote error reporting must never break the user flow.
  } finally {
    isReporting = false;
  }
}

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return null;
}

function getErrorStack(error: unknown): string | null {
  return error instanceof Error ? error.stack ?? null : null;
}
