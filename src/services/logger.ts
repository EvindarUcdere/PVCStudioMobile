const isDevelopment = process.env.NODE_ENV !== 'production';

type RemoteErrorReporter = (message: string, error?: unknown) => void;

let remoteErrorReporter: RemoteErrorReporter | null = null;

export const logger = {
  error(message: string, error?: unknown) {
    if (isDevelopment) {
      console.error(message, error);
    }

    remoteErrorReporter?.(message, error);
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
