import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { configureRemoteErrorReporter, ErrorLogContext } from './logger';
import { getFirebaseServices } from './firebase/firebaseConfig';
import { getCloudWorkspacePath } from './firebase/companyWorkspaceService';

let isInstalled = false;
let isReporting = false;
const recentReports = new Map<string, number>();
const duplicateWindowMs = 30_000;

export function installRemoteErrorReporting(): void {
  if (isInstalled) {
    return;
  }

  isInstalled = true;
  installGlobalErrorHandlers();
  configureRemoteErrorReporter((message, error, context) => {
    void reportError(message, error, context);
  });
}

async function reportError(message: string, error?: unknown, context: ErrorLogContext = {}): Promise<void> {
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

    const errorMessage = redactSensitiveText(getErrorMessage(error));
    const reportKey = `${message}|${errorMessage ?? ''}|${context.screen ?? ''}|${context.action ?? ''}`;
    if (isDuplicateReport(reportKey)) {
      return;
    }

    await addDoc(collection(services.firestore, workspace.rootCollection, workspace.rootId, 'errorReports'), {
      message: redactSensitiveText(message),
      errorMessage,
      stack: redactSensitiveText(getErrorStack(error)),
      userId: services.auth.currentUser?.uid ?? null,
      companyId: workspace.rootId,
      screen: context.screen ?? inferScreen(message),
      action: context.action ?? inferAction(message),
      entityType: context.entityType ?? null,
      entityId: context.entityId ?? null,
      customerName: redactSensitiveText(context.customerName ?? null),
      appVersion: Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? null,
      buildVersion:
        Constants.expoConfig?.android?.versionCode ??
        Constants.expoConfig?.ios?.buildNumber ??
        null,
      deviceModel: Constants.deviceName ?? null,
      platform: Platform.OS,
      osVersion: String(Platform.Version),
      metadata: sanitizeMetadata(context.metadata),
      occurredAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
    });
  } catch {
    // Remote error reporting must never break the user flow.
  } finally {
    isReporting = false;
  }
}

function installGlobalErrorHandlers(): void {
  const globalScope = globalThis as typeof globalThis & {
    ErrorUtils?: {
      getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void) | undefined;
      setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
    };
    onunhandledrejection?: ((event: PromiseRejectionEvent) => void) | null;
  };
  const errorUtils = globalScope.ErrorUtils as
    | {
        getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void) | undefined;
        setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
      }
    | undefined;

  const previousHandler = errorUtils?.getGlobalHandler?.();
  errorUtils?.setGlobalHandler?.((error, isFatal) => {
    void reportError('Unhandled JavaScript error', error, {
      action: 'unhandled_exception',
      metadata: { isFatal: isFatal ?? false },
    });
    previousHandler?.(error, isFatal);
  });

  const previousUnhandledRejection = globalScope.onunhandledrejection;
  globalScope.onunhandledrejection = (event) => {
    void reportError('Unhandled promise rejection', event.reason, {
      action: 'unhandled_promise_rejection',
    });
    previousUnhandledRejection?.(event);
  };
}

function isDuplicateReport(key: string): boolean {
  const now = Date.now();
  const lastSeenAt = recentReports.get(key);
  recentReports.set(key, now);

  for (const [reportKey, reportedAt] of recentReports) {
    if (now - reportedAt > duplicateWindowMs) {
      recentReports.delete(reportKey);
    }
  }

  return typeof lastSeenAt === 'number' && now - lastSeenAt < duplicateWindowMs;
}

function inferScreen(message: string): string | null {
  const lowered = message.toLocaleLowerCase('tr-TR');
  if (lowered.includes('quote')) return 'quotes';
  if (lowered.includes('customer')) return 'customers';
  if (lowered.includes('design editor')) return 'design-editor';
  if (lowered.includes('design')) return 'designs';
  if (lowered.includes('workshop')) return 'workshop';
  if (lowered.includes('stock')) return 'stock';
  if (lowered.includes('finance') || lowered.includes('payment')) return 'finance';
  if (lowered.includes('company') || lowered.includes('firma')) return 'company-profile';
  return null;
}

function inferAction(message: string): string | null {
  const lowered = message.toLocaleLowerCase('tr-TR');
  if (lowered.includes('save') || lowered.includes('kaydet')) return 'save';
  if (lowered.includes('load') || lowered.includes('yuklen')) return 'load';
  if (lowered.includes('restore')) return 'restore';
  if (lowered.includes('backup')) return 'backup';
  if (lowered.includes('share') || lowered.includes('paylas')) return 'share';
  if (lowered.includes('delete')) return 'delete';
  return null;
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

function sanitizeMetadata(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      typeof value === 'string' ? redactSensitiveText(value) : value,
    ]),
  );
}

function redactSensitiveText(value: string | null): string | null {
  if (!value) {
    return value;
  }

  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(password|sifre|şifre|token|api[_-]?key|apikey|authorization)(["'=:\s]+)([^"'\s,}]+)/gi, '$1$2[redacted]')
    .replace(/(key=)([^&\s]+)/gi, '$1[redacted]')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[redacted]');
}
