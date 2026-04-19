import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle } from './firebase';
import { motion } from 'framer-motion';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div style={{display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'}}>Cargando...</div>;

  if (!user) {
    return (
      <div style={{backgroundColor: '#F0F4F7', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'}}>
        <div style={{backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', maxWidth: '400px', width: '100%', textAlign: 'center', borderTop: '8px solid #FF6B00'}}>
          
          <div style={{marginBottom: '30px', display: 'flex', justifyContent: 'center'}}>
            <div style={{backgroundColor: 'white', width: '120px', height: '120px', borderRadius: '15px', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '10px'}}>
              <img
                src="https://www.chubut.gov.ar/wp-content/uploads/2023/12/logo-chubut.png"
                alt="Logo Chubut"
                style={{width: '100%', height: '100%', objectFit: 'contain'}}
              />
            </div>
          </div>
          
          <h1 style={{fontSize: '24px', fontWeight: '900', color: '#2C5F78', marginBottom: '8px', textTransform: 'uppercase'}}>Ministerio de Desarrollo Humano</h1>
          <p style={{color: '#666', marginBottom: '40px'}}>Gobierno del Chubut - Sistema de Inventario</p>
          
          <button 
            onClick={loginWithGoogle}
            style={{width: '100%', backgroundColor: '#2C5F78', color: 'white', padding: '15px', borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'}}
          >
            Ingresar con Google
          </button>
        </div>
      </div>
    );
  }

  return <div style={{padding: '20px'}}>Bienvenido {user.email}</div>;
}

export default App;s