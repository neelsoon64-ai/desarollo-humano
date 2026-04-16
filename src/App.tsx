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
  Eye,
  EyeOff,
  ArrowUpDown,
  Trash2,
  Info,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ... (Las interfaces y funciones de error se mantienen igual)

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
  
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState<{product: Product, type: 'entry' | 'exit'} | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // ... (Efectos de Firebase y lógica de filtrado se mantienen igual)

  if (loading) {
    return (
      <div className="min-h-screen bg-chubut-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-chubut-blue-dark"></div>
      </div>
    );
  }

  // --- VISTA DE LOGIN ACTUALIZADA ---
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
                src="/logochubut.png" // Tu nueva imagen
                alt="Logo Gobierno del Chubut"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://picsum.photos/seed/chubut/200/200";
                }}
              />
            </div>
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

  // --- VISTA PRINCIPAL / DASHBOARD ---
  return (
    <div className="min-h-screen bg-chubut-bg text-gray-900 font-sans">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-chubut-blue-light/10 shadow-sm overflow-hidden p-1">
                  <img 
                    src="/logochubut.png" // Logo también en la barra de navegación
                    alt="Logo Chubut" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://picsum.photos/seed/chubut/100/100";
                    }}
                  />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-bold text-sm tracking-tight uppercase text-chubut-blue-dark">Ministerio de Desarrollo Humano</span>
                  <span className="text-[10px] font-bold text-chubut-orange uppercase tracking-widest">Gobierno del Chubut</span>
                </div>
              </div>
              {/* Tabs de navegación se mantienen... */}
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

      {/* El resto del componente se mantiene igual... */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
         {/* ... Contenido del dashboard ... */}
      </main>
    </div>
  );
}

export default App;