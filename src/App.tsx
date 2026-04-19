import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle, loginWithEmailPassword, logout } from './firebase';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLoginError('Ingresa tu correo y contraseña.');
      setLoginLoading(false);
      return;
    }

    try {
      await loginWithEmailPassword(trimmedEmail, password);
      setEmail('');
      setPassword('');
    } catch (error) {
      console.error(error);
      setLoginError('Correo o contraseña incorrectos. Verifica tus datos.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoginError('');
    setLoginLoading(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error(error);
      setLoginError('No se pudo iniciar sesión con Google. Intenta de nuevo.');
    } finally {
      setLoginLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #F0F4F7 0%, #D1E7DD 100%)', color: '#2C5F78', fontFamily: 'Inter, sans-serif'}}>
        <div style={{textAlign: 'center'}}>
          <div style={{width: '60px', height: '60px', border: '6px solid #d9e6f1', borderTopColor: '#2C5F78', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 1s linear infinite'}} />
          <p style={{fontSize: '18px', fontWeight: 700}}>Cargando sistema...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{minHeight: '100vh', background: 'linear-gradient(140deg, #F0F4F7 0%, #E8F4FD 50%, #D1E7DD 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Inter, sans-serif'}}>
        <div style={{position: 'relative', width: '100%', maxWidth: '520px'}}>
          <div style={{position: 'absolute', top: '-40px', right: '-40px', width: '140px', height: '140px', borderRadius: '50%', background: '#2C5F78', opacity: 0.14}} />
          <div style={{position: 'absolute', bottom: '-40px', left: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: '#FF6B00', opacity: 0.12}} />
          <div style={{background: 'rgba(255,255,255,0.95)', borderRadius: '32px', padding: '36px', boxShadow: '0 36px 80px rgba(42, 71, 96, 0.14)', border: '1px solid rgba(255,255,255,0.9)', position: 'relative', zIndex: 1}}>
            <div style={{display: 'flex', justifyContent: 'center', marginBottom: '28px'}}>
              <div style={{width: '120px', height: '120px', borderRadius: '32px', background: '#fff', border: '2px solid rgba(44,95,120,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 18px 40px rgba(44,95,120,0.12)'}}>
                <img
                  src="/logochubut.png"
                  alt="Logo Gobierno del Chubut"
                  style={{width: '100%', height: '100%', objectFit: 'contain'}}
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://www.chubut.gov.ar/wp-content/uploads/2023/12/logo-chubut.png'; }}
                />
              </div>
            </div>

            <div style={{textAlign: 'center', marginBottom: '32px'}}>
              <p style={{margin: 0, color: '#2C5F78', fontWeight: 700, letterSpacing: '0.16em', fontSize: '12px', textTransform: 'uppercase'}}>Gobierno del Chubut</p>
              <h1 style={{marginTop: '12px', marginBottom: '10px', fontSize: '32px', lineHeight: 1.05, color: '#102A43'}}>Ministerio de Desarrollo Humano</h1>
              <p style={{margin: 0, color: '#4B6478', fontSize: '15px'}}>Sistema de Inventario institucional con acceso seguro.</p>
            </div>

            <form onSubmit={handleEmailLogin} style={{display: 'grid', gap: '18px'}}>
              <div style={{textAlign: 'left'}}>
                <label htmlFor="email" style={{display: 'block', fontWeight: 700, marginBottom: '8px', color: '#2C5F78'}}>Correo electrónico</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@chubut.gov.ar"
                  style={{width: '100%', padding: '16px 18px', borderRadius: '16px', border: '1px solid #CBD5E1', fontSize: '15px', color: '#102A43', background: '#F8FAFC'}}
                />
              </div>

              <div style={{textAlign: 'left'}}>
                <label htmlFor="password" style={{display: 'block', fontWeight: 700, marginBottom: '8px', color: '#2C5F78'}}>Contraseña</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{width: '100%', padding: '16px 18px', borderRadius: '16px', border: '1px solid #CBD5E1', fontSize: '15px', color: '#102A43', background: '#F8FAFC'}}
                />
              </div>

              {loginError && (
                <div style={{background: '#FEE2E2', color: '#991B1B', borderRadius: '16px', padding: '12px 16px', fontSize: '14px'}}>{loginError}</div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                style={{width: '100%', padding: '16px 18px', borderRadius: '16px', border: 'none', background: '#FF6B00', color: '#fff', fontWeight: 700, fontSize: '16px', cursor: 'pointer', boxShadow: '0 18px 30px rgba(255,107,0,0.24)'}}
              >
                {loginLoading ? 'Ingresando...' : 'Iniciar sesión'}
              </button>
            </form>

            <div style={{display: 'flex', alignItems: 'center', gap: '12px', margin: '26px 0', color: '#64748B'}}>
              <div style={{flex: 1, height: '1px', background: '#CBD5E1'}} />
              <span style={{fontSize: '14px'}}>o</span>
              <div style={{flex: 1, height: '1px', background: '#CBD5E1'}} />
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={loginLoading}
              style={{width: '100%', padding: '16px 18px', borderRadius: '16px', border: '1px solid #CBD5E1', background: '#ffffff', color: '#2C5F78', fontWeight: 700, fontSize: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '10px'}}
            >
              {loginLoading ? 'Ingresando...' : 'Ingresar con Google'}
            </button>

            <p style={{marginTop: '24px', color: '#64748B', fontSize: '13px', textAlign: 'center'}}>Si el login no funciona, revisa tus credenciales en Firebase Authentication o usa la opción de Google.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight: '100vh', background: '#F0F4F7', fontFamily: 'Inter, sans-serif', color: '#102A43', padding: '24px'}}>
      <div style={{maxWidth: '1024px', margin: '0 auto'}}>
        <header style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '18px', background: '#ffffff', padding: '18px 24px', borderRadius: '24px', boxShadow: '0 20px 60px rgba(44,95,120,0.08)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '14px'}}>
            <div style={{width: '60px', height: '60px', borderRadius: '18px', background: '#fff', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <img src="/logochubut.png" alt="Logo Chubut" style={{width: '100%', height: '100%', objectFit: 'contain'}} />
            </div>
            <div>
              <p style={{margin: 0, fontSize: '12px', fontWeight: 700, color: '#2C5F78', letterSpacing: '0.16em', textTransform: 'uppercase'}}>Gobierno del Chubut</p>
              <h1 style={{margin: '6px 0 0', fontSize: '22px', fontWeight: 900}}>Bienvenido al Sistema</h1>
            </div>
          </div>
          <button
            onClick={() => logout()}
            style={{padding: '12px 18px', borderRadius: '14px', border: 'none', background: '#2C5F78', color: '#fff', fontWeight: 700, cursor: 'pointer'}}
          >
            Cerrar sesión
          </button>
        </header>

        <main style={{marginTop: '28px', background: '#fff', borderRadius: '30px', padding: '30px', boxShadow: '0 20px 60px rgba(44,95,120,0.08)'}}>
          <p style={{margin: 0, fontSize: '16px', color: '#334155'}}>Has iniciado sesión como <strong>{user.email}</strong>.</p>
        </main>
      </div>
    </div>
  );
}

export default App;
