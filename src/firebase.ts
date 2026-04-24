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

try {
  const isConfigValid = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined';
  
  if (!isConfigValid) {
    throw new Error("Falta la configuración de Firebase. Asegúrate de añadir las variables VITE_FIREBASE_* en el panel de Vercel.");
  }
  
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
} catch (error) {
  console.error("⚠️ Error de Inicialización:", error instanceof Error ? error.message : error);
  // Mantenemos el throw para detener la ejecución y evitar errores derivados
  throw error;
}

export const auth = getAuth(app);
// Si no tienes un ID de base de datos específico, se usa el (default)
export const db = getFirestore(app); 
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const loginWithEmailPassword = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);
