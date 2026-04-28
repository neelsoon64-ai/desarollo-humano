import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { auth, loginWithGoogle, loginWithEmailPassword } from './firebase';

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
        await loginWithEmailPassword(email, password);
      }
    } catch (err: any) {
      setError('Error en la autenticación. Verifique sus datos.');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      await loginWithGoogle();
    } catch (err: any) {
      setError('No se pudo iniciar sesión con Google.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-[450px] rounded-[2rem] shadow-[0_20px_60px_rgba(0,51,102,0.15)] overflow-hidden border border-white">
        
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

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="group">
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2 ml-1 tracking-wider">
                Email Institucional
              </label>
              <input 
                type="email" 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] transition-all text-slate-700 placeholder:text-slate-300"
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
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] transition-all text-slate-700 placeholder:text-slate-300"
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
              className="w-full bg-[#003366] hover:bg-[#002244] text-white font-black py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] uppercase tracking-[0.2em] text-[11px] mt-2"
            >
              {isRegistering ? 'Crear Cuenta' : 'Entrar al Sistema'}
            </button>
          </form>

          {/* Divisor */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-white px-4 text-slate-400 font-bold tracking-widest">o continuar con</span></div>
          </div>

          {/* Google Login */}
          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-3 text-xs shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
            Cuenta Institucional Google
          </button>

          {/* Registro Toggle */}
          <div className="mt-8 text-center">
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-slate-400 text-[11px] font-bold hover:text-[#003366] transition-colors uppercase tracking-wider"
            >
              {isRegistering ? '¿Ya tiene cuenta? Iniciar Sesión' : '¿No tiene acceso? Solicitar Registro'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#f8fafc] py-4 text-center border-t border-slate-50">
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em]">
            Gobierno del Chubut
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginSystem;