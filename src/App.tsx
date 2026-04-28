import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider 
} from 'firebase/auth';
import { auth } from './firebase';

const LoginSystem = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError('Error: Verifique sus credenciales o conexión.');
    }
  };

  const loginWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Encabezado Institucional */}
        <div className="bg-[#003366] p-8 text-center">
          <img 
            src="https://desarrollohumano.chubut.gov.ar/wp-content/uploads/2024/04/logochubut.png" 
            alt="Escudo Chubut" 
            className="w-24 mx-auto mb-4 brightness-0 invert" 
          />
          <h1 className="text-white font-black text-xl uppercase tracking-tighter">
            Ministerio de Desarrollo Humano
          </h1>
          <p className="text-blue-200 text-[10px] font-bold uppercase mt-1">
            Gobierno del Chubut
          </p>
        </div>

        {/* Formulario */}
        <div className="p-10">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">
            {isRegistering ? 'Crear Cuenta Nueva' : 'Acceso al Sistema'}
          </h2>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Email Institucional</label>
              <input 
                type="email" 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 transition-all"
                placeholder="usuario@chubut.gov.ar"
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Contraseña</label>
              <input 
                type="password" 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 transition-all"
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-red-500 text-xs font-bold text-center italic">{error}</p>}

            <button 
              type="submit"
              className="w-full bg-[#003366] hover:bg-[#004080] text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-95 uppercase tracking-widest text-sm"
            >
              {isRegistering ? 'Registrar Usuario' : 'Iniciar Sesión'}
            </button>
          </form>

          {/* Divisor */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-bold italic">O acceder con</span></div>
          </div>

          {/* Google Login */}
          <button 
            onClick={loginWithGoogle}
            className="w-full border-2 border-slate-100 py-3 rounded-2xl flex justify-center items-center gap-3 font-bold text-slate-600 hover:bg-slate-50 transition-all"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/0/google.svg" width="18" alt="Google" />
            Google Workspace
          </button>

          {/* Toggle Register/Login */}
          <p className="mt-8 text-center text-sm text-slate-500">
            {isRegistering ? '¿Ya tiene cuenta?' : '¿No tiene acceso?'} {' '}
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-blue-700 font-black hover:underline underline-offset-4"
            >
              {isRegistering ? 'Inicie Sesión' : 'Solicitar Registro'}
            </button>
          </p>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
            Dirección de Informática - Desarrollo Humano
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginSystem;