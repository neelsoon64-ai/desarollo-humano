import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuración REAL de tu proyecto
const firebaseConfig = {
  apiKey: "AIzaSyBLHlM1Ox5moBPjXQRL5QtjbAAWduJlI2k",
  authDomain: "gen-lang-client-0628656636.firebaseapp.com",
  databaseURL: "https://gen-lang-client-0628656636-default-rtdb.firebaseio.com",
  projectId: "gen-lang-client-0628656636",
  storageBucket: "gen-lang-client-0628656636.firebasestorage.app",
  messagingSenderId: "471628166079",
  appId: "1:471628166079:web:4184c314daee766db9e70a"
};

// Inicialización
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const loginWithEmailPassword = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);

export default app;
export const firebaseConfigValid = true;