import { router, Stack, usePathname } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../src/components/ui/AppButton';
import { AppScreen } from '../src/components/ui/AppScreen';
import { EmptyState } from '../src/components/ui/EmptyState';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';
import { routes } from '../src/constants/routes';
import { useAppInitialization } from '../src/hooks/useAppInitialization';
import { installRemoteErrorReporting } from '../src/services/errorReportingService';
import { ensureCompanyWorkspace } from '../src/services/firebase/companyWorkspaceService';
import { restoreAllCloudDataToLocal } from '../src/services/firebase/fullSyncService';
import { verifyActiveCompanyLicense } from '../src/services/firebase/licenseGuard';
import { logger, setLoggerContext } from '../src/services/logger';

type RouteErrorBoundaryProps = {
  error: Error;
  retry: () => void;
};

export function ErrorBoundary({ error, retry }: RouteErrorBoundaryProps) {
  logger.error('Beklenmeyen route hatasi', error, { action: 'route_error_boundary' });

  return (
    <AppScreen centered>
      <EmptyState
        title="Beklenmeyen bir sorun oluştu"
        description="Lütfen tekrar deneyin. Sorun devam ederse uygulamayı yeniden açın."
        action={<AppButton label="Tekrar Dene" onPress={retry} />}
      />
    </AppScreen>
  );
}

export default function RootLayout() {
  const { isInitialized, initializationError, retryInitialization } = useAppInitialization();
  const pathname = usePathname();
  const [isCheckingCompanyAccess, setIsCheckingCompanyAccess] = useState(true);
  const verifiedCompanyIdRef = useRef<string | null>(null);
  const reconnectSyncRef = useRef<Promise<void> | null>(null);
  const lastReconnectSyncAtRef = useRef(0);

  useEffect(() => {
    installRemoteErrorReporting();
  }, []);

  useEffect(() => {
    setLoggerContext({ screen: pathname });
  }, [pathname]);

  const checkCompanyAccess = useCallback(async () => {
    if (!isInitialized || initializationError) {
      return;
    }

    if (pathname === routes.companyProfile) {
      verifiedCompanyIdRef.current = null;
      setIsCheckingCompanyAccess(false);
      return;
    }

    if (verifiedCompanyIdRef.current) {
      setIsCheckingCompanyAccess(false);
      return;
    }

    setIsCheckingCompanyAccess(true);
    try {
      const license = await verifyActiveCompanyLicense();
      if (!license.ok) {
        verifiedCompanyIdRef.current = null;
        router.replace(routes.companyProfile);
        return;
      }

      verifiedCompanyIdRef.current = license.companyId;

      if (license.source === 'firebase') {
        const workspaceCompanyId = await ensureCompanyWorkspace();
        if (!workspaceCompanyId) {
          verifiedCompanyIdRef.current = null;
          router.replace(routes.companyProfile);
        }
      }
    } catch (error) {
      verifiedCompanyIdRef.current = null;
      logger.error('Firma erisim kontrolu basarisiz oldu', error, {
        action: 'company_access_check',
        screen: pathname,
      });
      router.replace(routes.companyProfile);
    } finally {
      setIsCheckingCompanyAccess(false);
    }
  }, [initializationError, isInitialized, pathname]);

  useEffect(() => {
    void checkCompanyAccess();
  }, [checkCompanyAccess]);

  useEffect(() => {
    if (!isInitialized || initializationError) {
      return undefined;
    }

    return NetInfo.addEventListener((state) => {
      const isOnline = state.isConnected === true && state.isInternetReachable !== false;
      const now = Date.now();
      if (!isOnline || reconnectSyncRef.current || now - lastReconnectSyncAtRef.current < 60_000) {
        return;
      }

      lastReconnectSyncAtRef.current = now;
      reconnectSyncRef.current = (async () => {
        const license = await verifyActiveCompanyLicense();
        if (!license.ok || license.source !== 'firebase') {
          return;
        }

        await ensureCompanyWorkspace();
        await restoreAllCloudDataToLocal();
      })()
        .catch((error) => {
          logger.error('Reconnect license sync failed', error, {
            action: 'reconnect_license_sync',
            screen: pathname,
          });
        })
        .finally(() => {
          reconnectSyncRef.current = null;
        });
    });
  }, [initializationError, isInitialized, pathname]);

  const blockingContent =
    !isInitialized && !initializationError ? (
      <LoadingScreen message="Uygulama hazırlanıyor..." />
    ) : initializationError ? (
      <AppScreen centered>
        <EmptyState
          title="Uygulama başlatılamadı"
          description={initializationError}
          action={<AppButton label="Tekrar Dene" onPress={retryInitialization} />}
        />
      </AppScreen>
    ) : isCheckingCompanyAccess && pathname !== routes.companyProfile ? (
      <LoadingScreen message="Firma lisansı doğrulanıyor..." />
    ) : null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="company-profile" />
      </Stack>
      {blockingContent ? <View style={styles.overlay}>{blockingContent}</View> : null}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
});
