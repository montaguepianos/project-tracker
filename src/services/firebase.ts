import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(cfg.apiKey);

if (!firebaseEnabled) {
  // Dev guard to avoid cryptic crashes if env isn’t set
  // You can remove this once everything’s wired up
  // eslint-disable-next-line no-console
  console.warn('[firebase] Env vars missing; Firebase disabled');
}

export const app = initializeApp(cfg);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Best-effort offline cache
enableIndexedDbPersistence(db).catch(() => {
  // ignore if multiple tabs etc.
});