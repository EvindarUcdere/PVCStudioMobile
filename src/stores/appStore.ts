import { create } from 'zustand';

type AppState = {
  isInitialized: boolean;
  initializationError: string | null;
  setInitialized: (value: boolean) => void;
  setInitializationError: (message: string | null) => void;
};

export const useAppStore = create<AppState>((set) => ({
  isInitialized: false,
  initializationError: null,
  setInitialized: (value) => set({ isInitialized: value }),
  setInitializationError: (message) => set({ initializationError: message }),
}));
