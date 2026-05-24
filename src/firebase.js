import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Only initialise if all required values are present and not placeholders
export const firebaseReady =
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.startsWith('YOUR_') &&
  firebaseConfig.projectId &&
  !firebaseConfig.projectId.startsWith('YOUR_');

let db = null;
let functions = null;
let auth = null;

if (firebaseReady) {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  db        = getFirestore(app);
  functions = getFunctions(app);
  auth      = getAuth(app);
  // Auto sign-in anonymously so Cloud Functions can verify the caller
  signInAnonymously(auth).catch((err) => { console.warn('Anonymous sign-in failed:', err && err.message ? err.message : err); });
  // Debug: surface config status in Console
  try { console.info('Firebase ready:', { projectId: firebaseConfig.projectId }); } catch (e) {}
}

export { db, functions, auth };
