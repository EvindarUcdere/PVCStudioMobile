import { useCallback, useEffect, useRef } from 'react';

import { initializeDatabase } from '../database/initializeDatabase';
import { logger } from '../services/logger';
import { useAppStore } from '../stores/appStore';
import { getUserFriendlyErrorMessage } from '../utils/error';

export function useAppInitialization() {
  const hasStartedRef = useRef(false);
  const isInitialized = useAppStore((state) => state.isInitialized);
  const initializationError = useAppStore((state) => state.initializationError);
  const setInitialized = useAppStore((state) => state.setInitialized);
  const setInitializationError = useAppStore((state) => state.setInitializationError);

  const runInitialization = useCallback(async () => {
    hasStartedRef.current = true;
    setInitializationError(null);
    setInitialized(false);

    try {
      await initializeDatabase();
      setInitialized(true);
    } catch (error) {
      logger.error('Uygulama baslatma hatasi', error);
      setInitializationError(getUserFriendlyErrorMessage(error));
    }
  }, [setInitializationError, setInitialized]);

  useEffect(() => {
    if (!hasStartedRef.current) {
      void runInitialization();
    }
  }, [runInitialization]);

  const retryInitialization = useCallback(() => {
    void runInitialization();
  }, [runInitialization]);

  return {
    isInitialized,
    initializationError,
    retryInitialization,
  };
}
