import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle, logout } from './firebase';
import { LogIn, LogOut } from 'lucide-react';
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

  if (loading) return <div className="min-h-screen bg-[#F0F4F7] flex items-center justify-center font-bold">Cargando...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F0F4F7] flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border-t-8 border-[#FF6B00]"
        >
          <div className="mb-8 flex justify-center">
            <div className="bg-white w-32 h-32 rounded-2xl flex items-center justify-center border border-gray-100 shadow-sm overflow-hidden p-2">
              <img
                src="https://www.chubut.gov.ar/wp-content/uploads/2023/12/logo-chubut.png"
                alt="Logo Chubut"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          
          <h1 className="text-2xl font-black text-[#2C5F78] mb-2 uppercase">Ministerio de Desarrollo Humano</h1>
          <p className="text-gray-500 font-medium mb-10">Gobierno del Chubut - Sistema de Inventario</p>
          
          <button 
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-[#2C5F78] text-white py-4 px-6 rounded-xl hover:bg-[#6B9AB0] transition-all font-bold shadow-lg shadow-blue-900/20"
          >
            <LogIn className="w-6 h-6" />
            Ingresar con Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F4F7] p-8">
      <div className="max-w-7xl mx-auto flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
        <h1 className="font-bold text-[#2C5F78]">Bienvenido, {user.email}</h1>
        <button onClick={logout} className="flex items-center gap-2 text-red-500 font-bold uppercase text-sm">
          Salir <LogOut className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-10 text-center text-gray-400 font-bold">
        Panel de Inventario - Secretaría de Trabajo
      </div>
    </div>
  );
}

export default App;