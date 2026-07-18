const fallbackMessage =
  'Uygulama başlatılırken bir sorun oluştu. Lütfen uygulamayı kapatıp yeniden açın.';

export function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return fallbackMessage;
  }

  return fallbackMessage;
}
