import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center font-sans">
      {/* Logo Superior */}
      <div className="mb-8 text-center">
        <div className="bg-white p-4 rounded-3xl shadow-sm inline-block mb-4">
          <img 
            src="https://desarrollohumano.chubut.gov.ar/wp-content/uploads/2024/04/logochubut.png" 
            alt="Logo" 
            className="w-16"
          />
        </div>
        <h1 className="text-[#003366] font-black text-2xl uppercase tracking-tighter">
          Ministerio de <br/> Desarrollo Humano
        </h1>
      </div>

      {/* Tarjeta de Login */}
      <div className="bg-white w-full max-w-[400px] rounded-[2rem] shadow-2xl overflow-hidden">
        <div className="bg-[#003366] p-6 text-white">
          <h2 className="font-bold text-lg">Panel de Gestión</h2>
          <p className="text-xs opacity-70 uppercase font-bold tracking-widest">Acceso Administrativo</p>
        </div>
        
        <div className="p-8 space-y-4">
          <input type="email" placeholder="Usuario" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:border-blue-500" />
          <input type="password" placeholder="Contraseña" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:border-blue-500" />
          <button className="w-full bg-[#003366] text-white p-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#002244] transition">
            Ingresar al Sistema
          </button>
        </div>
      </div>

      <p className="mt-10 text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
        © 2026 Gobierno del Chubut
      </p>
    </div>
  );
}

export default App;