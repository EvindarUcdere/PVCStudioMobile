const isDevelopment = process.env.NODE_ENV !== 'production';

export type ErrorLogContext = {
  screen?: string | null;
  action?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  customerName?: string | null;
  metadata?: Record<string, unknown> | null;
};

type RemoteErrorReporter = (message: string, error?: unknown, context?: ErrorLogContext) => void;

let remoteErrorReporter: RemoteErrorReporter | null = null;
let currentContext: ErrorLogContext = {};

export const logger = {
  error(message: string, error?: unknown, context?: ErrorLogContext) {
    if (isDevelopment) {
      console.error(message, error, context);
    }

    remoteErrorReporter?.(message, error, { ...currentContext, ...context });
  },
  info(message: string, metadata?: unknown) {
    if (isDevelopment) {
      console.info(message, metadata);
    }
  },
};

export function configureRemoteErrorReporter(reporter: RemoteErrorReporter | null): void {
  remoteErrorReporter = reporter;
}

export function setLoggerContext(context: ErrorLogContext): void {
  currentContext = {
    ...currentContext,
    ...context,
  };
}
