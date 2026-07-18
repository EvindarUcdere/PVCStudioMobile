import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';

export function CustomersScreen() {
  return (
    <AppScreen>
      <AppHeader title="Müşteriler" subtitle="Müşteri kayıtları sonraki fazlarda eklenecek." />
      <EmptyState
        title="Henüz müşteri kaydı bulunmuyor."
        description="Müşteri yönetimi sonraki fazlarda geliştirilecektir."
      />
    </AppScreen>
  );
}
