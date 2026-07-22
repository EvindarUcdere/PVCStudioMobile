import { useLocalSearchParams } from 'expo-router';

import { TemplateCatalogScreen } from '../../templates/screens/TemplateCatalogScreen';

export function NewDesignScreen() {
  const { customerId } = useLocalSearchParams<{ customerId?: string }>();
  return <TemplateCatalogScreen customerId={customerId ?? null} />;
}
