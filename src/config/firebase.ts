import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAIycj6LtKtndvgXKkZPa7fNpTdlrByzwc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'home-finance-1ah277j9.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'home-finance-1ah277j9',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'home-finance-1ah277j9.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '728739828558',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:728739828558:web:48676750e96c2be089041f',
};

// Firebase web configuration is public by design. The fallback values keep the
// GitHub Pages build connected when GitHub Actions cannot read local .env files.
// Placeholder values still explicitly opt into offline mode for other deployments.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey !== 'your_api_key_here' &&
    firebaseConfig.projectId !== 'your_project_id_here'
);

// Safe initialization
let appInstance;
try {
  appInstance = isFirebaseConfigured
    ? getApps().length > 0
      ? getApp()
      : initializeApp(firebaseConfig)
    : null;
} catch (err) {
  console.warn('Firebase initialization skipped (using offline LocalStorage fallback):', err);
  appInstance = null;
}

export const app = appInstance;
export const auth = appInstance ? getAuth(appInstance) : null;
export const db = appInstance ? getFirestore(appInstance) : null;
export const fileStorage = appInstance ? getStorage(appInstance) : null;
