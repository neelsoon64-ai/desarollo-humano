import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 1. Configuración usando las variables de entorno que cargamos en Vercel
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 2. Validación de configuración
const isConfigValid = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined';

if (!isConfigValid) {
  console.warn("⚠️ Configuración de Firebase incompleta. Verifica las Environment Variables en Vercel.");
}

// 3. Inicialización de la App (evita duplicados)
const app = getApps().length === 0 
  ? initializeApp(isConfigValid ? firebaseConfig : {}) 
  : getApps()[0];

// 4. Exportación de servicios
export const auth = getAuth(app);
export const db = getFirestore(app); // Este es el que usa el "depósito" de Firestore
export const googleProvider = new GoogleAuthProvider();

// 5. Funciones de ayuda (Helpers)
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);

export const loginWithEmailPassword = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const logout = () => signOut(auth);

export default app;