import { useLocalSearchParams } from 'expo-router';

import { TemplateCatalogScreen } from '../../templates/screens/TemplateCatalogScreen';

export function NewDesignScreen() {
  const { customerId, jobId } = useLocalSearchParams<{ customerId?: string; jobId?: string }>();
  return <TemplateCatalogScreen customerId={customerId ?? null} jobId={jobId ?? null} />;
}
