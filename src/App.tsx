/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  Timestamp, 
  runTransaction,
  getDocFromServer
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, loginWithGoogle, logout } from './firebase';
import { 
  Plus, 
  Minus, 
  History, 
  Download, 
  LogOut, 
  LogIn, 
  Search,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ArrowUpDown,
  Trash2,
  Info,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- UTILITIES & TYPES ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Product {
  id: string;
  name: string;
  code: string;
  category: string;
  notes?: string;
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
  documentType: 'boleta' | 'remito' | 'nota' | 'otro';
  documentNumber: string;
  date: Timestamp;
  notes: string;
  userEmail: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'provincia' | 'nacion'>('provincia');
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProvinciaCol, setShowProvinciaCol] = useState(true);
  const [showNacionCol, setShowNacionCol] = useState(true);
  const [stockThreshold, setStockThreshold] = useState(5);
  const [movementsPage, setMovementsPage] = useState(1);
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product, direction: 'asc' | 'desc' } | null>(null);
  
  const [globalError, setGlobalError] = useState<string | null>(null);

  // --- MODALS / UI STATE ---
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState<{product: Product, type: 'entry' | 'exit'} | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);

  // --- EFFECTS ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  // --- LOGIC ---
  const handleSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key] ?? '';
        const bValue = b[sortConfig.key] ?? '';
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [products, searchTerm, sortConfig]);

  const filteredMovements = useMemo(() => {
    let result = movements.filter(m => m.scope === activeTab);
    if (dateFilter.start) {
      const start = new Date(dateFilter.start);
      result = result.filter(m => m.date.toDate() >= start);
    }
    if (dateFilter.end) {
      const end = new Date(dateFilter.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter(m => m.date.toDate() <= end);
    }
    return result;
  }, [movements, activeTab, dateFilter]);

  const handleExportExcel = () => {
    const data = movements.map(m => ({
      Fecha: format(m.date.toDate(), 'dd/MM/yyyy HH:mm'),
      Producto: m.productName,
      Tipo: m.type === 'entry' ? 'Entrada' : 'Salida',
      Ámbito: m.scope.toUpperCase(),
      Cantidad: m.quantity,
      Documento: m.documentType.toUpperCase(),
      'Nro Documento': m.documentNumber,
      Usuario: m.userEmail,
      Notas: m.notes
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial");
    XLSX.writeFile(wb, `Inventario_${activeTab}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  // --- RENDERING ---
  if (loading) {
    return (
      <div className="min-h-screen bg-chubut-bg flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-chubut-blue-dark"></div>
        <p className="text-chubut-blue-dark font-medium">Cargando Sistema...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-chubut-bg flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-chubut-orange"
        >
          <div className="mb-6 flex justify-center">
            <div className="bg-white w-32 h-32 rounded-2xl flex items-center justify-center border border-chubut-blue-light/10 shadow-sm overflow-hidden p-2">
              <img
                src="/logochubut.png"
                alt="Chubut"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://www.chubut.gov.ar/wp-content/uploads/2023/12/logo-chubut.png";
                }}
              />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-chubut-blue-dark mb-2">Ministerio de Desarrollo Humano</h1>
          <p className="text-gray-600 mb-8">Gobierno del Chubut - Sistema de Inventario</p>
          
          <button 
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-chubut-blue-dark text-white py-3 px-6 rounded-xl hover:bg-chubut-blue-light transition-colors font-medium shadow-lg shadow-chubut-blue-dark/20"
          >
            <LogIn className="w-5 h-5" />
            Ingresar con Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-chubut-bg text-gray-900 font-sans">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-chubut-blue-light/10 shadow-sm overflow-hidden p-1">
                  <img src="/logochubut.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-bold text-sm tracking-tight uppercase text-chubut-blue-dark">Ministerio de Desarrollo Humano</span>
                  <span className="text-[10px] font-bold text-chubut-orange uppercase tracking-widest">Gobierno del Chubut</span>
                </div>
              </div>
              <div className="hidden sm:flex gap-1">
                <button onClick={() => setActiveTab('provincia')} className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", activeTab === 'provincia' ? "bg-chubut-blue-dark text-white" : "text-chubut-blue-light hover:bg-chubut-blue-light/10")}>Provincia</button>
                <button onClick={() => setActiveTab('nacion')} className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", activeTab === 'nacion' ? "bg-chubut-blue-dark text-white" : "text-chubut-blue-light hover:bg-chubut-blue-light/10")}>Nación</button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:block text-right">
                <p className="text-xs font-medium text-gray-500">Usuario</p>
                <p className="text-sm font-semibold">{user.email}</p>
              </div>
              <button onClick={logout} className="p-2 text-gray-500 hover:text-red-600 rounded-lg"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-chubut-blue-dark">Inventario {activeTab === 'provincia' ? 'Provincia' : 'Nación'}</h2>
            <p className="text-chubut-blue-light font-medium mt-1">Gestión de existencias oficiales.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-chubut-blue-light" />
              <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-chubut-blue-light/20 rounded-xl focus:outline-none w-64 shadow-sm" />
            </div>
            <button onClick={() => setShowAddProduct(true)} className="flex items-center gap-2 bg-chubut-blue-dark text-white px-4 py-2 rounded-xl font-bold shadow-md hover:bg-chubut-blue-light transition-colors"><Plus className="w-4 h-4" /> Nuevo Producto</button>
            <button onClick={handleExportExcel} className="flex items-center gap-2 bg-white border border-chubut-blue-light/20 text-chubut-blue-dark px-4 py-2 rounded-xl font-bold shadow-sm hover:bg-chubut-bg transition-colors"><Download className="w-4 h-4" /> Excel</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-chubut-bg border-b border-chubut-blue-light/20">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-chubut-blue-dark uppercase cursor-pointer" onClick={() => handleSort('name')}>Producto</th>
                    <th className="px-6 py-4 text-xs font-bold text-chubut-blue-dark uppercase">Código</th>
                    <th className="px-6 py-4 text-xs font-bold text-chubut-blue-dark uppercase">Stock</th>
                    <th className="px-6 py-4 text-xs font-bold text-chubut-blue-dark uppercase text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chubut-blue-light/10">
                  {filteredProducts.map(product => (
                    <tr key={product.id} className="hover:bg-chubut-bg/50 group transition-colors">
                      <td className="px-6 py-4 font-bold text-chubut-blue-dark">{product.name}</td>
                      <td className="px-6 py-4 text-sm font-mono text-chubut-blue-light">{product.code}</td>
                      <td className="px-6 py-4">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-sm font-bold", (activeTab === 'provincia' ? product.stockProvincia : product.stockNacion) <= stockThreshold ? "bg-chubut-orange/10 text-chubut-orange" : "bg-green-100 text-green-800")}>
                          {activeTab === 'provincia' ? product.stockProvincia : product.stockNacion}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button className="p-2 text-chubut-blue-dark hover:bg-chubut-blue-light/10 rounded-lg"><Info className="w-4 h-4" /></button>
                        <button className="p-2 text-chubut-orange hover:bg-chubut-orange/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold flex items-center gap-2 text-chubut-blue-dark"><History className="w-4 h-4" /> Movimientos Recientes</h3>
            <div className="bg-white rounded-2xl border border-chubut-blue-light/10 p-4 shadow-sm space-y-4 max-h-[500px] overflow-y-auto">
              {filteredMovements.slice(0, 10).map(m => (
                <div key={m.id} className="flex gap-4 p-3 rounded-xl bg-chubut-bg/30 border border-chubut-blue-light/5">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", m.type === 'entry' ? "bg-chubut-yellow/10 text-chubut-yellow" : "bg-chubut-orange/10 text-chubut-orange")}>
                    {m.type === 'entry' ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-chubut-blue-dark truncate">{m.productName}</p>
                    <p className="text-xs text-chubut-blue-light">{m.type === 'entry' ? 'Entrada' : 'Salida'} - {m.quantity} un.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;