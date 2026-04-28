import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, loginWithGoogle } from './firebase';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div style={{padding: '20px', textAlign: 'center'}}>Cargando sistema...</div>;

  if (!user) {
    return (
      <div style={{
        backgroundColor: '#F0F4F7', 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        fontFamily: 'sans-serif'
      }}>
        <div style={{
          backgroundColor: 'white', 
          padding: '40px', 
          borderRadius: '15px', 
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)', 
          textAlign: 'center', 
          borderTop: '8px solid #FF6B00',
          width: '100%',
          maxWidth: '350px'
        }}>
          <img 
            src="https://www.chubut.gov.ar/wp-content/uploads/2023/12/logo-chubut.png" 
            alt="Logo" 
            style={{width: '100px', marginBottom: '20px'}}
          />
          <h2 style={{color: '#2C5F78', margin: '10px 0'}}>SGI CHUBUT</h2>
          <p style={{color: '#666', fontSize: '14px', marginBottom: '30px'}}>Ministerio de Desarrollo Humano</p>
          
          <button 
            onClick={loginWithGoogle}
            style={{
              backgroundColor: '#2C5F78', 
              color: 'white', 
              border: 'none', 
              padding: '12px 20px', 
              borderRadius: '8px', 
              fontWeight: 'bold', 
              cursor: 'pointer',
              width: '100%'
            }}
          >
            INGRESAR CON GOOGLE
          </button>
        </div>
      </div>
    );
  }

  return <div style={{padding: '20px'}}>Conectado como: {user.email}</div>;
}

export default App;