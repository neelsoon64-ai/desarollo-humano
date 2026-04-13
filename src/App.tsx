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
  addDoc, 
  updateDoc, 
  doc, 
  Timestamp, 
  runTransaction,
  getDoc,
  getDocFromServer,
  FirestoreError
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, loginWithGoogle, logout } from './firebase';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Plus, 
  Minus, 
  History, 
  Package, 
  Download, 
  LogOut, 
  LogIn, 
  LayoutDashboard,
  FileText,
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
  Calendar,
  Edit2,
  Save,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Error handling for Firestore
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let displayError = "Ocurrió un error inesperado.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) displayError = `Error de Base de Datos: ${parsed.error}`;
      } catch (e) {
        displayError = this.state.error?.message || String(this.state.error);
      }

      return (
        <div className="min-h-screen bg-chubut-bg flex items-center justify-center p-4 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border-t-4 border-red-500">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-chubut-blue-dark mb-2">¡Ups! Algo salió mal</h2>
            <p className="text-gray-600 mb-6">{displayError}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-chubut-blue-dark text-white py-2 rounded-xl font-bold hover:bg-chubut-blue-light transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
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
  
  // Modals / Forms state
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState<{product: Product, type: 'entry' | 'exit'} | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          setGlobalError("Error de conexión: Por favor verifica la configuración de Firebase.");
        }
      }
    }
    testConnection();
  }, []);

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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    const qMovements = query(collection(db, 'movements'), orderBy('date', 'desc'));
    const unsubMovements = onSnapshot(qMovements, (snapshot) => {
      setMovements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Movement)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'movements');
    });

    return () => {
      unsubProducts();
      unsubMovements();
    };
  }, [user]);

  useEffect(() => {
    setMovementsPage(1);
  }, [activeTab]);

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [products, searchTerm, sortConfig]);

  const handleSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'products', productId);
        transaction.delete(productRef);
      });
      setProductToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
    }
  };

  const SortIcon = ({ column }: { column: keyof Product }) => {
    if (!sortConfig || sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-3 h-3 ml-1 text-gray-900" /> 
      : <ChevronDown className="w-3 h-3 ml-1 text-gray-900" />;
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-chubut-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-chubut-blue-dark"></div>
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
          <div className="bg-white w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-chubut-blue-light/10 shadow-sm overflow-hidden p-2">
            <img 
              src="/logo.png" 
              alt="Logo Chubut" 
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://picsum.photos/seed/chubut/100/100";
              }}
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-bold text-chubut-blue-dark mb-2">Ministerio de Desarrollo Humano</h1>
          <p className="text-gray-600 mb-8">Gobierno del Chubut - Sistema de Inventario</p>
          
          {globalError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm text-left">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{globalError}</p>
            </div>
          )}

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
      {/* Sidebar / Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-chubut-blue-light/10 shadow-sm overflow-hidden p-1">
                  <img 
                    src="/logo.png" 
                    alt="Logo Chubut" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://picsum.photos/seed/chubut/100/100";
                    }}
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-bold text-sm tracking-tight uppercase text-chubut-blue-dark">Ministerio de Desarrollo Humano</span>
                  <span className="text-[10px] font-bold text-chubut-orange uppercase tracking-widest">Gobierno del Chubut</span>
                </div>
              </div>
              <div className="hidden sm:flex gap-1">
                <button 
                  onClick={() => setActiveTab('provincia')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                    activeTab === 'provincia' ? "bg-chubut-blue-dark text-white shadow-md shadow-chubut-blue-dark/20" : "text-chubut-blue-light hover:bg-chubut-blue-light/10"
                  )}
                >
                  Provincia
                </button>
                <button 
                  onClick={() => setActiveTab('nacion')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                    activeTab === 'nacion' ? "bg-chubut-blue-dark text-white shadow-md shadow-chubut-blue-dark/20" : "text-chubut-blue-light hover:bg-chubut-blue-light/10"
                  )}
                >
                  Nación
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:block text-right">
                <p className="text-xs font-medium text-gray-500">Usuario</p>
                <p className="text-sm font-semibold">{user.email}</p>
              </div>
              <button 
                onClick={logout}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Cerrar Sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-chubut-blue-dark">
              Inventario {activeTab === 'provincia' ? 'Provincia' : 'Nación'}
            </h2>
            <p className="text-chubut-blue-light font-medium mt-1">Gestiona existencias, entradas y salidas.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-chubut-blue-light" />
              <input 
                type="text" 
                placeholder="Buscar producto..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-chubut-blue-light/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-chubut-blue-dark/10 transition-all w-full md:w-64 shadow-sm"
              />
            </div>
            <button 
              onClick={() => setShowAddProduct(true)}
              className="flex items-center gap-2 bg-chubut-blue-dark text-white px-4 py-2 rounded-xl hover:bg-chubut-blue-light transition-colors font-bold shadow-md shadow-chubut-blue-dark/20"
            >
              <Plus className="w-4 h-4" />
              Nuevo Producto
            </button>
            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-white border border-chubut-blue-light/20 text-chubut-blue-dark px-4 py-2 rounded-xl hover:bg-chubut-bg transition-colors font-bold shadow-sm"
            >
              <Download className="w-4 h-4" />
              Exportar Excel
            </button>
          </div>
        </div>

        {/* View Configuration */}
        <div className="flex flex-wrap items-center gap-6 mb-4 bg-white p-3 rounded-xl border border-chubut-blue-light/10 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-chubut-blue-light uppercase tracking-wider">Ver Columnas:</span>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowProvinciaCol(!showProvinciaCol)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                  showProvinciaCol ? "bg-chubut-blue-dark text-white border-chubut-blue-dark shadow-sm" : "bg-white text-chubut-blue-light border-chubut-blue-light/20"
                )}
              >
                {showProvinciaCol ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                Provincia
              </button>
              <button 
                onClick={() => setShowNacionCol(!showNacionCol)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                  showNacionCol ? "bg-chubut-blue-dark text-white border-chubut-blue-dark shadow-sm" : "bg-white text-chubut-blue-light border-chubut-blue-light/20"
                )}
              >
                {showNacionCol ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                Nación
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 border-l border-chubut-blue-light/10 pl-6">
            <span className="text-xs font-bold text-chubut-blue-light uppercase tracking-wider">Alerta de Stock:</span>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                min="0"
                value={stockThreshold}
                onChange={(e) => setStockThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 px-2 py-1 text-xs font-bold border border-chubut-blue-light/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-chubut-blue-dark/10 text-center"
              />
              <span className="text-[10px] font-bold text-chubut-blue-light/60 uppercase">unidades</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Products List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-chubut-bg border-b border-chubut-blue-light/20">
                      <th 
                        className="px-6 py-4 text-xs font-bold text-chubut-blue-dark uppercase tracking-wider cursor-pointer hover:text-chubut-blue-light transition-colors"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center">Producto <SortIcon column="name" /></div>
                      </th>
                      <th 
                        className="px-6 py-4 text-xs font-bold text-chubut-blue-dark uppercase tracking-wider cursor-pointer hover:text-chubut-blue-light transition-colors"
                        onClick={() => handleSort('code')}
                      >
                        <div className="flex items-center">Código <SortIcon column="code" /></div>
                      </th>
                      {showProvinciaCol && (
                        <th 
                          className="px-6 py-4 text-xs font-bold text-chubut-blue-dark uppercase tracking-wider cursor-pointer hover:text-chubut-blue-light transition-colors"
                          onClick={() => handleSort('stockProvincia')}
                        >
                          <div className="flex items-center">Stock Prov. <SortIcon column="stockProvincia" /></div>
                        </th>
                      )}
                      {showNacionCol && (
                        <th 
                          className="px-6 py-4 text-xs font-bold text-chubut-blue-dark uppercase tracking-wider cursor-pointer hover:text-chubut-blue-light transition-colors"
                          onClick={() => handleSort('stockNacion')}
                        >
                          <div className="flex items-center">Stock Nac. <SortIcon column="stockNacion" /></div>
                        </th>
                      )}
                      <th className="px-6 py-4 text-xs font-bold text-chubut-blue-dark uppercase tracking-wider text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-chubut-blue-light/10">
                    {filteredProducts.map(product => (
                      <tr key={product.id} className="hover:bg-chubut-bg/50 transition-colors group">
                        <td 
                          className="px-6 py-4 cursor-pointer"
                          onClick={() => setSelectedProduct(product)}
                        >
                          <div className="font-bold text-chubut-blue-dark group-hover:text-chubut-orange transition-colors">{product.name}</div>
                          <div className="text-xs font-medium text-chubut-blue-light">{product.category}</div>
                        </td>
                        <td 
                          className="px-6 py-4 text-sm font-mono text-chubut-blue-light font-bold cursor-pointer"
                          onClick={() => setSelectedProduct(product)}
                        >
                          {product.code}
                        </td>
                        {showProvinciaCol && (
                          <td className="px-6 py-4">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold",
                              product.stockProvincia <= stockThreshold 
                                ? "bg-chubut-orange/10 text-chubut-orange" 
                                : "bg-green-100 text-green-800"
                            )}>
                              {product.stockProvincia}
                            </span>
                          </td>
                        )}
                        {showNacionCol && (
                          <td className="px-6 py-4">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold",
                              product.stockNacion <= stockThreshold 
                                ? "bg-chubut-orange/10 text-chubut-orange" 
                                : "bg-green-100 text-green-800"
                            )}>
                              {product.stockNacion}
                            </span>
                          </td>
                        )}
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setShowMovementForm({ product, type: 'entry' })}
                              className="p-2 text-chubut-yellow hover:bg-chubut-yellow/10 rounded-lg transition-colors"
                              title="Entrada"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setShowMovementForm({ product, type: 'exit' })}
                              className="p-2 text-chubut-orange hover:bg-chubut-orange/10 rounded-lg transition-colors"
                              title="Salida"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setProductToDelete(product)}
                              className="p-2 text-chubut-blue-light hover:text-chubut-orange hover:bg-chubut-orange/10 rounded-lg transition-colors"
                              title="Eliminar Producto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setSelectedProduct(product)}
                              className="p-2 text-chubut-blue-dark hover:bg-chubut-blue-light/10 rounded-lg transition-colors"
                              title="Ver Detalles"
                            >
                              <Info className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                          No se encontraron productos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent History */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2 text-chubut-blue-dark">
                <History className="w-4 h-4" />
                Movimientos Recientes
              </h3>
            </div>
            
            {/* Date Filter Panel */}
            <div className="bg-white rounded-2xl border border-chubut-blue-light/10 p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-chubut-blue-light uppercase tracking-wider">
                <Calendar className="w-3 h-3" />
                Filtrar por Fecha
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input 
                    type="date" 
                    value={dateFilter.start}
                    onChange={e => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full text-xs px-2 py-1.5 border border-chubut-blue-light/10 rounded-lg outline-none focus:ring-1 focus:ring-chubut-blue-dark/20"
                  />
                </div>
                <div>
                  <input 
                    type="date" 
                    value={dateFilter.end}
                    onChange={e => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full text-xs px-2 py-1.5 border border-chubut-blue-light/10 rounded-lg outline-none focus:ring-1 focus:ring-chubut-blue-dark/20"
                  />
                </div>
              </div>
              {(dateFilter.start || dateFilter.end) && (
                <button 
                  onClick={() => setDateFilter({ start: '', end: '' })}
                  className="mt-2 w-full text-[10px] font-bold text-chubut-orange hover:text-chubut-orange/80 transition-colors uppercase"
                >
                  Limpiar Filtros
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-chubut-blue-light/10 p-4 shadow-sm space-y-4 max-h-[500px] overflow-y-auto flex flex-col">
              <div className="space-y-4 flex-1">
                {filteredMovements.slice((movementsPage - 1) * 10, movementsPage * 10).map(m => (
                  <button 
                    key={m.id} 
                    onClick={() => setSelectedMovement(m)}
                    className="w-full text-left flex gap-4 p-3 rounded-xl bg-chubut-bg/30 border border-chubut-blue-light/5 hover:bg-chubut-bg transition-colors group"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                      m.type === 'entry' ? "bg-chubut-yellow/10 text-chubut-yellow" : "bg-chubut-orange/10 text-chubut-orange"
                    )}>
                      {m.type === 'entry' ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-chubut-blue-dark truncate group-hover:text-chubut-blue-light transition-colors">{m.productName}</p>
                      <p className="text-xs font-medium text-chubut-blue-light">
                        {m.type === 'entry' ? 'Entrada' : 'Salida'} de {m.quantity} unidades
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold uppercase bg-white px-1.5 py-0.5 rounded border border-chubut-blue-light/10 text-chubut-blue-light">
                          {m.documentType}: {m.documentNumber}
                        </span>
                        <span className="text-[10px] font-medium text-chubut-blue-light/60">
                          {format(m.date.toDate(), 'dd/MM HH:mm')}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
                {filteredMovements.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Sin movimientos registrados.
                  </div>
                )}
              </div>

              {filteredMovements.length > 10 && (
                <div className="pt-4 border-t border-chubut-blue-light/10 flex items-center justify-between">
                  <button 
                    disabled={movementsPage === 1}
                    onClick={() => setMovementsPage(p => p - 1)}
                    className="p-1.5 rounded-lg border border-chubut-blue-light/20 text-chubut-blue-light disabled:opacity-30 hover:bg-chubut-bg transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-chubut-blue-dark">
                    Página {movementsPage} de {Math.ceil(filteredMovements.length / 10)}
                  </span>
                  <button 
                    disabled={movementsPage >= Math.ceil(filteredMovements.length / 10)}
                    onClick={() => setMovementsPage(p => p + 1)}
                    className="p-1.5 rounded-lg border border-chubut-blue-light/20 text-chubut-blue-light disabled:opacity-30 hover:bg-chubut-bg transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showAddProduct && (
          <Modal onClose={() => setShowAddProduct(false)} title="Nuevo Producto">
            <AddProductForm onCancel={() => setShowAddProduct(false)} />
          </Modal>
        )}

        {showMovementForm && (
          <Modal 
            onClose={() => setShowMovementForm(null)} 
            title={showMovementForm.type === 'entry' ? 'Registrar Entrada' : 'Registrar Salida'}
          >
            <MovementForm 
              product={showMovementForm.product} 
              type={showMovementForm.type} 
              scope={activeTab}
              userEmail={user.email || ''}
              onCancel={() => setShowMovementForm(null)} 
            />
          </Modal>
        )}

        {productToDelete && (
          <Modal 
            onClose={() => setProductToDelete(null)} 
            title="Confirmar Eliminación"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-800">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <p className="text-sm font-medium">
                  ¿Estás seguro de que deseas eliminar el producto <strong>{productToDelete.name}</strong>? 
                  Esta acción no se puede deshacer y el producto desaparecerá del inventario.
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 py-2 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDeleteProduct(productToDelete.id)}
                  className="flex-1 py-2 px-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium"
                >
                  Eliminar permanentemente
                </button>
              </div>
            </div>
          </Modal>
        )}

        {selectedProduct && (
          <Modal 
            onClose={() => setSelectedProduct(null)} 
            title="Detalles del Producto"
          >
            <ProductDetail 
              product={selectedProduct} 
              movements={movements.filter(m => m.productId === selectedProduct.id)} 
              onSelectMovement={setSelectedMovement}
            />
          </Modal>
        )}

        {selectedMovement && (
          <Modal 
            onClose={() => setSelectedMovement(null)} 
            title="Detalle del Movimiento"
          >
            <div className="space-y-6">
              <div className={cn(
                "p-6 rounded-2xl border text-center",
                selectedMovement.type === 'entry' ? "bg-chubut-yellow/5 border-chubut-yellow/20" : "bg-chubut-orange/5 border-chubut-orange/20"
              )}>
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
                  selectedMovement.type === 'entry' ? "bg-chubut-yellow/10 text-chubut-yellow" : "bg-chubut-orange/10 text-chubut-orange"
                )}>
                  {selectedMovement.type === 'entry' ? <Plus className="w-8 h-8" /> : <Minus className="w-8 h-8" />}
                </div>
                <h4 className="text-xl font-bold text-chubut-blue-dark uppercase">
                  {selectedMovement.type === 'entry' ? 'Entrada de Stock' : 'Salida de Stock'}
                </h4>
                <p className="text-chubut-blue-light font-medium">Registrado el {format(selectedMovement.date.toDate(), 'dd/MM/yyyy HH:mm')}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-chubut-blue-light uppercase tracking-wider">Producto</p>
                  <p className="font-bold text-chubut-blue-dark">{selectedMovement.productName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-chubut-blue-light uppercase tracking-wider">Cantidad</p>
                  <p className="font-bold text-chubut-blue-dark text-lg">{selectedMovement.quantity} unidades</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-chubut-blue-light uppercase tracking-wider">Ámbito</p>
                  <p className="font-bold text-chubut-blue-dark uppercase">{selectedMovement.scope}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-chubut-blue-light uppercase tracking-wider">Usuario</p>
                  <p className="font-bold text-chubut-blue-dark text-xs truncate">{selectedMovement.userEmail}</p>
                </div>
              </div>

              <div className="p-4 bg-chubut-bg rounded-xl border border-chubut-blue-light/10">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-bold text-chubut-blue-light uppercase tracking-wider">Documento de Respaldo</p>
                  <span className="px-2 py-0.5 bg-white rounded border border-chubut-blue-light/20 text-[10px] font-bold text-chubut-blue-dark uppercase">
                    {selectedMovement.documentType}
                  </span>
                </div>
                <p className="text-2xl font-mono font-bold text-chubut-blue-dark">{selectedMovement.documentNumber}</p>
              </div>

              {selectedMovement.notes && (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-chubut-blue-light uppercase tracking-wider">Notas del Movimiento</p>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap italic">
                    "{selectedMovement.notes}"
                  </div>
                </div>
              )}

              <button 
                onClick={() => setSelectedMovement(null)}
                className="w-full py-3 bg-chubut-blue-dark text-white rounded-xl font-bold hover:bg-chubut-blue-light transition-colors shadow-lg shadow-chubut-blue-dark/20"
              >
                Cerrar Detalle
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// Components
function Modal({ children, onClose, title }: { children: React.ReactNode, onClose: () => void, title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-chubut-blue-light/10 flex justify-between items-center bg-chubut-bg">
          <h3 className="font-bold text-lg text-chubut-blue-dark">{title}</h3>
          <button onClick={onClose} className="text-chubut-blue-light hover:text-chubut-blue-dark transition-colors">
            <LogOut className="w-5 h-5 rotate-180" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function ProductDetail({ product, movements, onSelectMovement }: { 
  product: Product, 
  movements: Movement[],
  onSelectMovement: (m: Movement) => void
}) {
  const [localDateFilter, setLocalDateFilter] = useState({ start: '', end: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: product.name,
    code: product.code,
    category: product.category,
    notes: product.notes
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'products', product.id), editForm);
      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${product.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredLocalMovements = useMemo(() => {
    let result = [...movements];
    
    if (localDateFilter.start) {
      const start = new Date(localDateFilter.start);
      result = result.filter(m => m.date.toDate() >= start);
    }
    
    if (localDateFilter.end) {
      const end = new Date(localDateFilter.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter(m => m.date.toDate() <= end);
    }
    
    return result;
  }, [movements, localDateFilter]);

  const chartData = useMemo(() => {
    // Sort movements by date ascending for calculation
    const sortedMovements = [...movements].sort((a, b) => a.date.toMillis() - b.date.toMillis());
    
    // We need to find the "starting" stock. 
    // Since we only have current stock, we can work backwards from current stock
    // OR we can work forwards if we assume the first state was 0 (but that's not true if there was initial stock)
    // The most accurate way is to take current stock and subtract all movements to find "initial"
    
    let currentProv = product.stockProvincia;
    let currentNac = product.stockNacion;
    
    // Work backwards to find the state at each movement
    const history = [];
    
    // Add current state as the last point
    history.push({
      date: format(new Date(), 'dd/MM HH:mm'),
      timestamp: Date.now(),
      provincia: currentProv,
      nacion: currentNac
    });

    const revMovements = [...movements].sort((a, b) => b.date.toMillis() - a.date.toMillis());
    
    let tempProv = currentProv;
    let tempNac = currentNac;
    
    revMovements.forEach(m => {
      if (m.scope === 'provincia') {
        tempProv = m.type === 'entry' ? tempProv - m.quantity : tempProv + m.quantity;
      } else {
        tempNac = m.type === 'entry' ? tempNac - m.quantity : tempNac + m.quantity;
      }
      
      history.push({
        date: format(m.date.toDate(), 'dd/MM HH:mm'),
        timestamp: m.date.toMillis(),
        provincia: tempProv,
        nacion: tempNac
      });
    });

    // Sort by timestamp for the chart
    return history.sort((a, b) => a.timestamp - b.timestamp);
  }, [product, movements]);

  return (
    <div className="space-y-8 pb-4">
      {/* Section 1: Detalles del Producto */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-chubut-blue-light/10">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-chubut-blue-dark" />
            <h4 className="font-bold text-chubut-blue-dark">Detalles del Producto</h4>
          </div>
          <button 
            onClick={() => isEditing ? handleSaveEdit() : setIsEditing(true)}
            disabled={isSaving}
            className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold transition-all",
              isEditing 
                ? "bg-chubut-yellow text-chubut-blue-dark hover:bg-chubut-yellow/80" 
                : "bg-chubut-bg text-chubut-blue-light hover:text-chubut-blue-dark"
            )}
          >
            {isEditing ? (
              <>
                <Save className="w-3 h-3" />
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </>
            ) : (
              <>
                <Edit2 className="w-3 h-3" />
                Editar Información
              </>
            )}
          </button>
          {isEditing && (
            <button 
              onClick={() => {
                setIsEditing(false);
                setEditForm({
                  name: product.name,
                  code: product.code,
                  category: product.category,
                  notes: product.notes
                });
              }}
              className="p-1 text-chubut-orange hover:bg-chubut-orange/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <p className="text-xs font-bold text-chubut-blue-light uppercase tracking-wider">Nombre</p>
            {isEditing ? (
              <input 
                type="text"
                value={editForm.name}
                onChange={e => setEditForm({...editForm, name: e.target.value})}
                className="w-full px-3 py-1.5 border border-chubut-blue-light/20 rounded-lg text-sm outline-none focus:ring-1 focus:ring-chubut-blue-dark/20"
              />
            ) : (
              <p className="text-lg font-bold text-chubut-blue-dark">{product.name}</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-chubut-blue-light uppercase tracking-wider">Código / SKU</p>
            {isEditing ? (
              <input 
                type="text"
                value={editForm.code}
                onChange={e => setEditForm({...editForm, code: e.target.value})}
                className="w-full px-3 py-1.5 border border-chubut-blue-light/20 rounded-lg text-sm font-mono outline-none focus:ring-1 focus:ring-chubut-blue-dark/20"
              />
            ) : (
              <p className="text-lg font-mono font-bold text-chubut-blue-dark">{product.code}</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-chubut-blue-light uppercase tracking-wider">Categoría</p>
            {isEditing ? (
              <input 
                type="text"
                value={editForm.category}
                onChange={e => setEditForm({...editForm, category: e.target.value})}
                className="w-full px-3 py-1.5 border border-chubut-blue-light/20 rounded-lg text-sm outline-none focus:ring-1 focus:ring-chubut-blue-dark/20"
              />
            ) : (
              <p className="font-bold text-chubut-blue-dark">{product.category || 'Sin categoría'}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-chubut-bg/50 rounded-xl border border-chubut-blue-light/10">
            <p className="text-xs font-bold text-chubut-blue-light uppercase mb-1">Stock Provincia</p>
            <p className="text-2xl font-bold text-chubut-blue-dark">{product.stockProvincia}</p>
          </div>
          <div className="p-4 bg-chubut-bg/50 rounded-xl border border-chubut-blue-light/10">
            <p className="text-xs font-bold text-chubut-blue-light uppercase mb-1">Stock Nación</p>
            <p className="text-2xl font-bold text-chubut-blue-dark">{product.stockNacion}</p>
          </div>
        </div>

        {(product.notes || isEditing) && (
          <div className="space-y-1">
            <p className="text-xs font-bold text-chubut-blue-light uppercase tracking-wider">Notas / Descripción</p>
            {isEditing ? (
              <textarea 
                value={editForm.notes}
                onChange={e => setEditForm({...editForm, notes: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border border-chubut-blue-light/20 rounded-xl text-sm outline-none focus:ring-1 focus:ring-chubut-blue-dark/20 resize-none"
              />
            ) : (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap">
                {product.notes}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Section 2: Gráfico de Stock */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-chubut-blue-light/10">
          <LayoutDashboard className="w-5 h-5 text-chubut-blue-dark" />
          <h4 className="font-bold text-chubut-blue-dark">Gráfico de Stock</h4>
        </div>
        <div className="h-64 w-full bg-white p-4 rounded-2xl border border-chubut-blue-light/10 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                fontSize={10} 
                tickMargin={10}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                fontSize={10}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  fontSize: '12px'
                }} 
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Line 
                type="monotone" 
                dataKey="provincia" 
                name="Provincia"
                stroke="#2C5F78" 
                strokeWidth={3}
                dot={{ r: 4, fill: '#2C5F78', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="nacion" 
                name="Nación"
                stroke="#FF6B00" 
                strokeWidth={3}
                dot={{ r: 4, fill: '#FF6B00', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Section 3: Historial de Movimientos */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-chubut-blue-light/10">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-chubut-blue-dark" />
            <h4 className="font-bold text-chubut-blue-dark">Historial de Movimientos</h4>
          </div>
          
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={localDateFilter.start}
              onChange={e => setLocalDateFilter(prev => ({ ...prev, start: e.target.value }))}
              className="text-[10px] px-2 py-1 border border-chubut-blue-light/10 rounded-lg outline-none"
            />
            <span className="text-chubut-blue-light text-[10px]">-</span>
            <input 
              type="date" 
              value={localDateFilter.end}
              onChange={e => setLocalDateFilter(prev => ({ ...prev, end: e.target.value }))}
              className="text-[10px] px-2 py-1 border border-chubut-blue-light/10 rounded-lg outline-none"
            />
            {(localDateFilter.start || localDateFilter.end) && (
              <button 
                onClick={() => setLocalDateFilter({ start: '', end: '' })}
                className="text-[10px] font-bold text-chubut-orange"
              >
                X
              </button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {filteredLocalMovements.length > 0 ? (
            filteredLocalMovements.map(m => (
              <button 
                key={m.id} 
                onClick={() => onSelectMovement(m)}
                className="w-full text-left flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl text-sm hover:border-chubut-blue-light/30 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    m.type === 'entry' ? "bg-chubut-yellow/10 text-chubut-yellow" : "bg-chubut-orange/10 text-chubut-orange"
                  )}>
                    {m.type === 'entry' ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-bold text-chubut-blue-dark group-hover:text-chubut-blue-light transition-colors">
                      {m.type === 'entry' ? 'Entrada' : 'Salida'} de {m.quantity} unidades
                    </p>
                    <p className="text-[10px] text-chubut-blue-light font-medium">
                      {m.scope.toUpperCase()} • {m.documentType.toUpperCase()}: {m.documentNumber}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-chubut-blue-light/60">
                    {format(m.date.toDate(), 'dd/MM/yyyy HH:mm')}
                  </p>
                  <p className="text-[10px] text-chubut-blue-light truncate max-w-[120px]">
                    {m.userEmail}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <p className="text-center py-6 text-gray-400 text-sm italic">No hay movimientos registrados para este producto.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function AddProductForm({ onCancel }: { onCancel: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: '',
    notes: '',
    stockProvincia: 0,
    stockNacion: 0
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'products'), {
        ...formData,
        stockProvincia: Number(formData.stockProvincia),
        stockNacion: Number(formData.stockNacion)
      });
      onCancel();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'products');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-bold text-chubut-blue-light uppercase mb-1">Nombre</label>
          <input 
            required
            type="text" 
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            className="w-full px-4 py-2 border border-chubut-blue-light/20 rounded-xl focus:ring-2 focus:ring-chubut-blue-dark/10 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-chubut-blue-light uppercase mb-1">Código / SKU</label>
          <input 
            required
            type="text" 
            value={formData.code}
            onChange={e => setFormData({...formData, code: e.target.value})}
            className="w-full px-4 py-2 border border-chubut-blue-light/20 rounded-xl focus:ring-2 focus:ring-chubut-blue-dark/10 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-chubut-blue-light uppercase mb-1">Categoría</label>
          <input 
            type="text" 
            value={formData.category}
            onChange={e => setFormData({...formData, category: e.target.value})}
            className="w-full px-4 py-2 border border-chubut-blue-light/20 rounded-xl focus:ring-2 focus:ring-chubut-blue-dark/10 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-chubut-blue-light uppercase mb-1">Stock Inicial Prov.</label>
          <input 
            type="number" 
            value={formData.stockProvincia}
            onChange={e => setFormData({...formData, stockProvincia: Number(e.target.value)})}
            className="w-full px-4 py-2 border border-chubut-blue-light/20 rounded-xl focus:ring-2 focus:ring-chubut-blue-dark/10 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-chubut-blue-light uppercase mb-1">Stock Inicial Nac.</label>
          <input 
            type="number" 
            value={formData.stockNacion}
            onChange={e => setFormData({...formData, stockNacion: Number(e.target.value)})}
            className="w-full px-4 py-2 border border-chubut-blue-light/20 rounded-xl focus:ring-2 focus:ring-chubut-blue-dark/10 outline-none"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-chubut-blue-light uppercase mb-1">Notas / Descripción</label>
          <textarea 
            value={formData.notes}
            onChange={e => setFormData({...formData, notes: e.target.value})}
            className="w-full px-4 py-2 border border-chubut-blue-light/20 rounded-xl focus:ring-2 focus:ring-chubut-blue-dark/10 outline-none resize-none h-20"
            placeholder="Detalles adicionales del producto..."
          />
        </div>
      </div>
      <div className="flex gap-3 pt-4">
        <button 
          type="button" 
          onClick={onCancel}
          className="flex-1 py-2 px-4 border border-chubut-blue-light/20 rounded-xl hover:bg-chubut-bg transition-colors font-bold text-chubut-blue-light"
        >
          Cancelar
        </button>
        <button 
          type="submit" 
          disabled={loading}
          className="flex-1 py-2 px-4 bg-chubut-blue-dark text-white rounded-xl hover:bg-chubut-blue-light transition-colors font-bold disabled:opacity-50 shadow-md shadow-chubut-blue-dark/20"
        >
          {loading ? 'Guardando...' : 'Crear Producto'}
        </button>
      </div>
    </form>
  );
}

function MovementForm({ product, type, scope, userEmail, onCancel }: { 
  product: Product, 
  type: 'entry' | 'exit', 
  scope: 'provincia' | 'nacion',
  userEmail: string,
  onCancel: () => void 
}) {
  const [formData, setFormData] = useState({
    quantity: 1,
    documentType: 'remito' as 'boleta' | 'remito' | 'nota' | 'otro',
    documentNumber: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const currentStock = scope === 'provincia' ? product.stockProvincia : product.stockNacion;
    if (type === 'exit' && currentStock < formData.quantity) {
      setError("Stock insuficiente para realizar esta salida.");
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'products', product.id);
        const productDoc = await transaction.get(productRef);
        
        if (!productDoc.exists()) throw new Error("Product does not exist!");
        
        const data = productDoc.data() as Product;
        const newStock = type === 'entry' 
          ? (scope === 'provincia' ? data.stockProvincia : data.stockNacion) + formData.quantity
          : (scope === 'provincia' ? data.stockProvincia : data.stockNacion) - formData.quantity;

        transaction.update(productRef, {
          [scope === 'provincia' ? 'stockProvincia' : 'stockNacion']: newStock
        });

        const movementRef = doc(collection(db, 'movements'));
        transaction.set(movementRef, {
          productId: product.id,
          productName: product.name,
          type,
          scope,
          quantity: formData.quantity,
          documentType: formData.documentType,
          documentNumber: formData.documentNumber,
          date: Timestamp.now(),
          notes: formData.notes,
          userEmail
        });
      });
      onCancel();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'movements/products');
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="space-y-6">
        <div className="bg-chubut-bg/50 p-6 rounded-2xl border border-chubut-blue-light/10 text-center">
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
            type === 'entry' ? "bg-chubut-yellow/10 text-chubut-yellow" : "bg-chubut-orange/10 text-chubut-orange"
          )}>
            {type === 'entry' ? <Plus className="w-8 h-8" /> : <Minus className="w-8 h-8" />}
          </div>
          <h4 className="text-xl font-bold text-chubut-blue-dark mb-2">¿Confirmar Movimiento?</h4>
          <div className="space-y-2 text-sm text-chubut-blue-light font-medium">
            <p>Estás por registrar una <span className="font-bold">{type === 'entry' ? 'ENTRADA' : 'SALIDA'}</span> de:</p>
            <p className="text-lg font-bold text-chubut-blue-dark">{formData.quantity} unidades</p>
            <p>Para el producto: <span className="font-bold text-chubut-blue-dark">{product.name}</span></p>
            <p>Ámbito: <span className="font-bold text-chubut-blue-dark uppercase">{scope}</span></p>
            <p>Documento: <span className="font-bold text-chubut-blue-dark uppercase">{formData.documentType} {formData.documentNumber}</span></p>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            type="button" 
            onClick={() => setShowConfirm(false)}
            className="flex-1 py-3 px-4 border border-chubut-blue-light/20 rounded-xl hover:bg-chubut-bg transition-colors font-bold text-chubut-blue-light"
          >
            Volver y Editar
          </button>
          <button 
            type="button" 
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              "flex-1 py-3 px-4 text-white rounded-xl transition-colors font-bold disabled:opacity-50 shadow-lg",
              type === 'entry' ? "bg-chubut-yellow hover:bg-chubut-yellow/80 shadow-chubut-yellow/20" : "bg-chubut-orange hover:bg-chubut-orange/80 shadow-chubut-orange/20"
            )}
          >
            {loading ? 'Procesando...' : 'Confirmar Registro'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-chubut-bg/50 p-3 rounded-xl border border-chubut-blue-light/10 mb-4">
        <p className="text-xs font-bold text-chubut-blue-light uppercase">Producto</p>
        <p className="font-bold text-chubut-blue-dark">{product.name} <span className="text-chubut-blue-light font-normal">({product.code})</span></p>
        <p className="text-xs text-chubut-blue-light mt-1 font-medium">
          Stock actual en {scope === 'provincia' ? 'Provincia' : 'Nación'}: 
          <span className="font-bold text-chubut-blue-dark ml-1">
            {scope === 'provincia' ? product.stockProvincia : product.stockNacion}
          </span>
        </p>
      </div>

      {error && (
        <div className="bg-chubut-orange/10 text-chubut-orange p-3 rounded-xl flex items-center gap-2 text-sm border border-chubut-orange/20 font-bold">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-chubut-blue-light uppercase mb-1">Cantidad</label>
          <input 
            required
            type="number" 
            min="1"
            value={formData.quantity}
            onChange={e => setFormData({...formData, quantity: Number(e.target.value)})}
            className="w-full px-4 py-2 border border-chubut-blue-light/20 rounded-xl focus:ring-2 focus:ring-chubut-blue-dark/10 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-chubut-blue-light uppercase mb-1">Tipo Documento</label>
          <select 
            value={formData.documentType}
            onChange={e => setFormData({...formData, documentType: e.target.value as any})}
            className="w-full px-4 py-2 border border-chubut-blue-light/20 rounded-xl focus:ring-2 focus:ring-chubut-blue-dark/10 outline-none bg-white font-bold text-chubut-blue-dark"
          >
            <option value="remito">Remito</option>
            <option value="boleta">Boleta</option>
            <option value="nota">Nota</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-chubut-blue-light uppercase mb-1">Nro de Documento</label>
          <input 
            required
            type="text" 
            value={formData.documentNumber}
            onChange={e => setFormData({...formData, documentNumber: e.target.value})}
            className="w-full px-4 py-2 border border-chubut-blue-light/20 rounded-xl focus:ring-2 focus:ring-chubut-blue-dark/10 outline-none"
            placeholder="Ej: 0001-00001234"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-chubut-blue-light uppercase mb-1">Notas (Opcional)</label>
          <textarea 
            value={formData.notes}
            onChange={e => setFormData({...formData, notes: e.target.value})}
            className="w-full px-4 py-2 border border-chubut-blue-light/20 rounded-xl focus:ring-2 focus:ring-chubut-blue-dark/10 outline-none resize-none h-20"
          />
        </div>
      </div>
      <div className="flex gap-3 pt-4">
        <button 
          type="button" 
          onClick={onCancel}
          className="flex-1 py-2 px-4 border border-chubut-blue-light/20 rounded-xl hover:bg-chubut-bg transition-colors font-bold text-chubut-blue-light"
        >
          Cancelar
        </button>
        <button 
          type="submit" 
          disabled={loading}
          className={cn(
            "flex-1 py-2 px-4 text-white rounded-xl transition-colors font-bold disabled:opacity-50 shadow-md",
            type === 'entry' ? "bg-chubut-yellow hover:bg-chubut-yellow/80 shadow-chubut-yellow/20" : "bg-chubut-orange hover:bg-chubut-orange/80 shadow-chubut-orange/20"
          )}
        >
          {loading ? 'Procesando...' : (type === 'entry' ? 'Registrar Entrada' : 'Registrar Salida')}
        </button>
      </div>
    </form>
  );
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
