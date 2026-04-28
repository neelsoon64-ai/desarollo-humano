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
      setError('Credenciales inválidas o error de red.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-[450px] rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden border border-slate-100">
        
        {/* Banner Superior Institucional */}
        <div className="bg-[#003366] pt-12 pb-10 px-8 text-center relative">
          <div className="absolute top-4 right-6 opacity-10 text-white font-bold italic tracking-widest text-xs">
            V 2.0
          </div>
          <img 
            src="https://desarrollohumano.chubut.gov.ar/wp-content/uploads/2024/04/logochubut.png" 
            alt="Chubut" 
            className="w-20 mx-auto mb-6 brightness-0 invert" 
          />
          <h1 className="text-white font-black text-2xl uppercase tracking-tighter leading-tight">
            Ministerio de <br /> Desarrollo Humano
          </h1>
          <div className="h-1 w-12 bg-orange-500 mx-auto mt-4 rounded-full"></div>
        </div>

        {/* Cuerpo del Formulario */}
        <div className="p-10 bg-white">
          <div className="mb-8 text-center">
            <h2 className="text-xl font-bold text-slate-800 italic">
              {isRegistering ? 'Solicitud de Registro' : 'Acceso Restringido'}
            </h2>
            <p className="text-slate-400 text-xs font-medium mt-1">
              Ingrese sus datos para continuar
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            <div className="group">
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2 ml-1 tracking-wider">
                Email Institucional
              </label>
              <input 
                type="email" 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-700"
                placeholder="nombre@chubut.gov.ar"
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="group">
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2 ml-1 tracking-wider">
                Contraseña
              </label>
              <input 
                type="password" 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-700"
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-[10px] p-3 rounded-xl font-bold text-center border border-red-100">
                ⚠️ {error}
              </div>
            )}

            <button 
              type="submit"
              className="w-full bg-[#003366] hover:bg-[#002244] text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98] uppercase tracking-widest text-xs mt-4"
            >
              {isRegistering ? 'Crear Cuenta' : 'Entrar al Sistema'}
            </button>
          </form>

          {/* Registro Toggle */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-slate-500 text-xs font-bold hover:text-blue-700 transition-colors"
            >
              {isRegistering ? '¿Ya tiene cuenta? Iniciar Sesión' : '¿No tiene acceso? Solicitar Registro'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#f8fafc] p-6 text-center">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">
            Gobierno del Chubut
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginSystem;