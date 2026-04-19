import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  Timestamp 
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, loginWithGoogle, loginWithEmailPassword, logout } from './firebase';
import { 
  Plus, 
  Minus, 
  History, 
  Download, 
  LogOut, 
  LogIn, 
  Search,
  Trash2,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { motion } from 'framer-motion';

// --- INTERFACES ---
interface Product {
  id: string;
  name: string;
  code: string;
  category: string;
  stockProvincia: number;
  stockNacion: number;
}

interface Movement {
  id: string;
  productId: string;
  productName: string;
  type: 'entry' | 'exit';
  scope: 'provincia' | 'nacion';
  quantity: number;
  date: Timestamp;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'provincia' | 'nacion'>('provincia');
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState('');

  // --- AUTENTICACIÓN ---
  useEffect(() => {
    console.log('Inicializando Firebase Auth...');
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log('Estado de auth cambiado:', u ? 'Usuario logueado' : 'No logueado');
      setUser(u);
      setLoading(false);
    });
    // Timeout de seguridad en caso de que Firebase no responda
    const timeout = setTimeout(() => {
      console.log('Timeout alcanzado, forzando login screen');
      setLoading(false);
    }, 5000);
    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail') || '';
    const savedRemember = localStorage.getItem('rememberMe') === 'true';

    if (savedRemember && savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // --- CARGA DE DATOS ---
  useEffect(() => {
    if (!user) return;

    const qProducts = query(collection(db, 'products'), orderBy('name'));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    const qMovements = query(collection(db, 'movements'), orderBy('date', 'desc'));
    const unsubMovements = onSnapshot(qMovements, (snapshot) => {
      setMovements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Movement)));
    });

    return () => {
      unsubProducts();
      unsubMovements();
    };
  }, [user]);

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');

    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmedEmail || !password) {
      setLoginError('Ingresa correo y contraseña.');
      return;
    }

    if (!emailRegex.test(trimmedEmail)) {
      setLoginError('Ingresa un correo válido.');
      return;
    }

    try {
      await loginWithEmailPassword(trimmedEmail, password);

      if (rememberMe) {
        localStorage.setItem('rememberedEmail', trimmedEmail);
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('rememberedEmail');
        localStorage.setItem('rememberMe', 'false');
      }
    } catch (error) {
      console.error('Error de inicio de sesión:', error);
      setLoginError('Correo o contraseña incorrectos. Verifica tus datos.');
    }
  };

  // --- FILTROS ---
  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const handleExportExcel = () => {
    const data = movements.map(m => ({
      Fecha: format(m.date.toDate(), 'dd/MM/yyyy'),
      Producto: m.productName,
      Tipo: m.type === 'entry' ? 'Entrada' : 'Salida',
      Cantidad: m.quantity
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, `Inventario_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0F4F7] flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2C5F78]"></div>
        <p className="text-[#2C5F78] font-bold uppercase tracking-wider">Cargando Sistema...</p>
      </div>
    );
  }

  // --- VISTA DE LOGIN ---
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F0F4F7] via-[#E8F4FD] to-[#D1E7DD] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Elementos decorativos de fondo */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5">
          <div className="absolute top-10 left-10 w-32 h-32 bg-[#FF6B00] rounded-full blur-xl"></div>
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-[#2C5F78] rounded-full blur-xl"></div>
          <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-[#6B9AB0] rounded-full blur-lg"></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="bg-white/95 backdrop-blur-sm p-10 rounded-3xl shadow-2xl max-w-md w-full text-center border border-white/20 relative z-10"
        >
          {/* Logo con animación */}
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mb-8 flex justify-center"
          >
            <div className="bg-gradient-to-br from-[#2C5F78] to-[#1a3a4a] w-36 h-36 rounded-3xl flex items-center justify-center border-4 border-white shadow-xl overflow-hidden p-3">
              <img
                src="/logochubut.png"
                alt="Logo Gobierno del Chubut"
                className="w-full h-full object-contain drop-shadow-sm"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://www.chubut.gov.ar/wp-content/uploads/2023/12/logo-chubut.png";
                }}
              />
            </div>
          </motion.div>
          
          {/* Título con gradiente */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h1 className="text-3xl font-black bg-gradient-to-r from-[#2C5F78] to-[#1a3a4a] bg-clip-text text-transparent mb-3 uppercase tracking-tight">
              Ministerio de Desarrollo Humano
            </h1>
            <p className="text-gray-600 font-semibold text-lg mb-2">Gobierno del Chubut</p>
            <p className="text-gray-500 font-medium mb-10">Sistema de Inventario</p>
          </motion.div>

          {/* Formulario con animaciones */}
          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            onSubmit={handleEmailLogin} 
            className="space-y-6 text-left"
          >
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-[#2C5F78] mb-3 uppercase tracking-wide">
                Correo electrónico
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@chubut.gov.ar"
                  className="w-full rounded-2xl border-2 border-gray-200 bg-white px-5 py-4 text-base font-medium text-slate-700 shadow-lg outline-none transition-all duration-300 focus:border-[#FF6B00] focus:ring-4 focus:ring-[#FF6B00]/20 hover:border-[#2C5F78]/50"
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                  <div className="w-2 h-2 bg-[#FF6B00] rounded-full opacity-0 transition-opacity duration-300 focus-within:opacity-100"></div>
                </div>
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-bold text-[#2C5F78] mb-3 uppercase tracking-wide">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border-2 border-gray-200 bg-white px-5 py-4 text-base font-medium text-slate-700 shadow-lg outline-none transition-all duration-300 focus:border-[#FF6B00] focus:ring-4 focus:ring-[#FF6B00]/20 hover:border-[#2C5F78]/50"
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                  <div className="w-2 h-2 bg-[#FF6B00] rounded-full opacity-0 transition-opacity duration-300 focus-within:opacity-100"></div>
                </div>
              </div>
            </div>

            {/* Checkbox recordar */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-[#FF6B00] bg-gray-100 border-gray-300 rounded focus:ring-[#FF6B00] focus:ring-2"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">Recordar sesión</span>
              </label>
            </div>

            {/* Error message */}
            {loginError && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium"
              >
                {loginError}
              </motion.div>
            )}

            {/* Botón de login */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full bg-gradient-to-r from-[#FF6B00] to-[#e55a00] hover:from-[#e55a00] hover:to-[#cc4d00] text-white font-bold py-4 px-6 rounded-2xl shadow-xl transition-all duration-300 uppercase tracking-wide text-base"
            >
              Iniciar Sesión
            </motion.button>
          </motion.form>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 pt-6 border-t border-gray-200"
          >
            <p className="text-xs text-gray-500 font-medium">
              Sistema seguro • Gobierno del Chubut
            </p>
          </motion.div>
        </motion.div>
      </div>
    );
  }


  // --- DASHBOARD PRINCIPAL ---
  return (
    <div className="min-h-screen bg-[#F0F4F7]">
      <nav className="bg-gradient-to-r from-[#2C5F78] to-[#FF6B00] border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 overflow-hidden p-1 bg-white rounded-lg">
              <img src="/logochubut.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="font-black text-white text-sm uppercase leading-tight">Secretaría de Trabajo</h2>
              <p className="text-[#FFB800] text-[10px] font-bold uppercase tracking-widest">Gobierno del Chubut</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-white hover:text-gray-200 font-bold text-sm transition-colors uppercase">
            <span>Salir</span>
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h3 className="text-4xl font-black text-[#2C5F78] uppercase">Panel de Control</h3>
            <div className="flex gap-2 mt-4">
              <button 
                onClick={() => setActiveTab('provincia')}
                className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'provincia' ? 'bg-[#2C5F78] text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
              >
                PROVINCIA
              </button>
              <button 
                onClick={() => setActiveTab('nacion')}
                className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'nacion' ? 'bg-[#2C5F78] text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
              >
                NACIÓN
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar insumos..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#6B9AB0] outline-none w-72 bg-white shadow-sm font-medium" 
              />
            </div>
            <button onClick={handleExportExcel} className="bg-white border border-gray-200 text-[#2C5F78] px-5 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm">
              <Download className="w-5 h-5" /> EXCEL
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Insumo / Descripción</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Código</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Existencias</th>
                  <th className="px-6 py-4 text-right text-xs font-black text-gray-400 uppercase tracking-widest">Gestión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-5 font-bold text-[#2C5F78]">{product.name}</td>
                    <td className="px-6 py-5 text-sm font-mono text-gray-400">{product.code}</td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-lg font-black text-sm ${
                        (activeTab === 'provincia' ? product.stockProvincia : product.stockNacion) < 10 
                        ? 'bg-red-50 text-red-600' 
                        : 'bg-green-50 text-green-700'
                      }`}>
                        {activeTab === 'provincia' ? product.stockProvincia : product.stockNacion}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button title="Información" className="p-2 text-[#6B9AB0] hover:bg-[#6B9AB0]/10 rounded-lg"><Info className="w-5 h-5" /></button>
                        <button title="Eliminar" className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h4 className="font-black text-[#2C5F78] uppercase mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-[#FF6B00]" /> Historial Reciente
              </h4>
              <div className="space-y-4">
                {movements.slice(0, 5).map(m => (
                  <div key={m.id} className="flex items-center gap-4 p-3 rounded-xl bg-[#F0F4F7]/50 border border-gray-100">
                    <div className={`p-2 rounded-lg ${m.type === 'entry' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {m.type === 'entry' ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-[#2C5F78] truncate uppercase">{m.productName}</p>
                      <p className="text-[10px] font-bold text-gray-400">{format(m.date.toDate(), 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;