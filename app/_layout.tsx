import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppButton } from '../src/components/ui/AppButton';
import { AppScreen } from '../src/components/ui/AppScreen';
import { EmptyState } from '../src/components/ui/EmptyState';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';
import { useAppInitialization } from '../src/hooks/useAppInitialization';
import { logger } from '../src/services/logger';

type RouteErrorBoundaryProps = {
  error: Error;
  retry: () => void;
};

export function ErrorBoundary({ error, retry }: RouteErrorBoundaryProps) {
  logger.error('Beklenmeyen route hatasi', error);

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

  if (!isInitialized && !initializationError) {
    return <LoadingScreen message="Uygulama hazırlanıyor..." />;
  }

  if (initializationError) {
    return (
      <AppScreen centered>
        <EmptyState
          title="Uygulama başlatılamadı"
          description={initializationError}
          action={<AppButton label="Tekrar Dene" onPress={retryInitialization} />}
        />
      </AppScreen>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
