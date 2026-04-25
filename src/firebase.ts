import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuración usando variables de entorno de Vite
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app: FirebaseApp;
export let firebaseConfigValid = false;

try {
  const isConfigValid = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined';
  firebaseConfigValid = isConfigValid;

  if (!isConfigValid) {
    console.error("⚠️ Configuración de Firebase incompleta. Verifica las variables de entorno en Vercel.");
  }

  app = getApps().length === 0 ? initializeApp(isConfigValid ? firebaseConfig : {}) : getApps()[0];
} catch (error) {
  console.error("⚠️ Error de Inicialización de Firebase:", error);
  app = getApps()[0]; // Fallback
}

export const auth = getAuth(app);
// Si no tienes un ID de base de datos específico, se usa el (default)
export const db = getFirestore(app); 
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const loginWithEmailPassword = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);
