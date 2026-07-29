import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, Persistence, getAuth, initializeAuth } from '@firebase/auth';
import * as FirebaseAuth from '@firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
};

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

let cachedServices: FirebaseServices | null = null;

export function getFirebaseServices(): FirebaseServices | null {
  if (cachedServices) {
    return cachedServices;
  }

  const config = readFirebaseConfig();

  if (!config) {
    return null;
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  cachedServices = {
    app,
    auth: getOrInitializeAuth(app),
    firestore: getFirestore(app),
  };

  return cachedServices;
}

function getOrInitializeAuth(app: FirebaseApp): Auth {
  try {
    const { getReactNativePersistence } = FirebaseAuth as typeof FirebaseAuth & {
      getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
    };

    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

export function isFirebaseConfigured(): boolean {
  return readFirebaseConfig() !== null;
}

function readFirebaseConfig(): FirebaseConfig | null {
  const config = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };

  return Object.values(config).every((value) => typeof value === 'string' && value.trim().length > 0)
    ? (config as FirebaseConfig)
    : null;
}
