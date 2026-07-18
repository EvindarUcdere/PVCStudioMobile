const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = {
  error(message: string, error?: unknown) {
    if (isDevelopment) {
      console.error(message, error);
    }
  },
  info(message: string, metadata?: unknown) {
    if (isDevelopment) {
      console.info(message, metadata);
    }
  },
};
