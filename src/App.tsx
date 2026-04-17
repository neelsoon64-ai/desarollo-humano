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
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
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
      <div className="min-h-screen bg-[#F0F4F7] flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border-t-8 border-[#FF6B00]"
        >
          <div className="mb-8 flex justify-center">
            <div className="bg-white w-32 h-32 rounded-2xl flex items-center justify-center border border-gray-100 shadow-sm overflow-hidden p-2">
              <img
                src="/logochubut.png"
                alt="Logo Chubut"
                className="w-full h-full object-contain"
                onError={(e) => {
                   (e.target as HTMLImageElement).src = "https://www.chubut.gov.ar/wp-content/uploads/2023/12/logo-chubut.png";
                }}
              />
            </div>
          </div>
          
          <h1 className="text-2xl font-black text-[#2C5F78] mb-2 uppercase tracking-tight">Ministerio de Desarrollo Humano</h1>
          <p className="text-gray-500 font-medium mb-10">Gobierno del Chubut - Sistema de Inventario</p>

          <form onSubmit={handleEmailLogin} className="space-y-4 text-left">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">Correo electrónico</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@chubut.gov.ar"
                className="w-full rounded-2xl border border-gray-200 bg-[#FBFCFE] px-4 py-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-[#2C5F78] focus:ring-2 focus:ring-[#6B9AB0]/30"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">Contraseña</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="w-full rounded-2xl border border-gray-200 bg-[#FBFCFE] px-4 py-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-[#2C5F78] focus:ring-2 focus:ring-[#6B9AB0]/30"
                required
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#2C5F78] focus:ring-[#2C5F78]"
                />
                Recordarme
              </label>
            </div>
            {loginError && (
              <p className="text-sm text-red-600 font-medium">{loginError}</p>
            )}
            <button
              type="submit"
              className="w-full bg-[#2C5F78] text-white py-4 rounded-2xl font-bold uppercase tracking-wider shadow-lg shadow-blue-900/15 hover:bg-[#1f4f63] transition"
            >
              Iniciar sesión
            </button>
          </form>

          <div className="mt-6 text-sm text-gray-500">O puedes ingresar con tu cuenta de Google si prefieres.</div>
          <button 
            onClick={loginWithGoogle}
            className="w-full mt-4 flex items-center justify-center gap-3 bg-white border border-gray-200 text-[#2C5F78] py-4 px-6 rounded-xl hover:bg-gray-50 transition-all font-bold shadow-sm"
          >
            <LogIn className="w-6 h-6" />
            Ingresar con Google
          </button>
        </motion.div>
      </div>
    );
  }

  // --- DASHBOARD PRINCIPAL ---
  return (
    <div className="min-h-screen bg-[#F0F4F7]">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 overflow-hidden p-1">
              <img src="/logochubut.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="font-black text-[#2C5F78] text-sm uppercase leading-tight">Secretaría de Trabajo</h2>
              <p className="text-[#FF6B00] text-[10px] font-bold uppercase tracking-widest">Gobierno del Chubut</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-gray-500 hover:text-red-600 font-bold text-sm transition-colors uppercase">
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
                        <button className="p-2 text-[#6B9AB0] hover:bg-[#6B9AB0]/10 rounded-lg"><Info className="w-5 h-5" /></button>
                        <button className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-5 h-5" /></button>
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