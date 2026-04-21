import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle, loginWithEmailPassword, logout } from './firebase';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { collection, getDocs, addDoc, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

interface InventoryItem {
  id: string;
  nombre: string;
  categoria: string;
  cantidad: number;
  ubicacion: string;
  estado: 'Activo' | 'Inactivo' | 'Mantenimiento';
  fechaActualizacion: string;
}

interface FormData {
  nombre: string;
  categoria: string;
  cantidad: string;
  ubicacion: string;
  estado: 'Activo' | 'Inactivo' | 'Mantenimiento';
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  // Estados para el dashboard
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'inventario' | 'reportes' | 'configuracion'>('dashboard');
  const [inventoryType, setInventoryType] = useState<'provincial' | 'nacional'>('provincial');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para items
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([
    { id: '1', nombre: 'Laptop Dell', categoria: 'Equipos', cantidad: 5, ubicacion: 'Oficina A', estado: 'Activo', fechaActualizacion: '2026-04-15' },
    { id: '2', nombre: 'Mouse Inalámbrico', categoria: 'Periféricos', cantidad: 12, ubicacion: 'Almacén', estado: 'Activo', fechaActualizacion: '2026-04-10' },
    { id: '3', nombre: 'Monitor LG 24"', categoria: 'Equipos', cantidad: 3, ubicacion: 'Oficina B', estado: 'Mantenimiento', fechaActualizacion: '2026-04-01' },
    { id: '4', nombre: 'Teclado Mecánico', categoria: 'Periféricos', cantidad: 1, ubicacion: 'Almacén', estado: 'Activo', fechaActualizacion: '2026-03-28' },
  ]);
  
  const [nationalInventoryItems, setNationalInventoryItems] = useState<InventoryItem[]>([
    { id: '101', nombre: 'Servidores', categoria: 'Infraestructura', cantidad: 8, ubicacion: 'Data Center', estado: 'Activo', fechaActualizacion: '2026-04-18' },
    { id: '102', nombre: 'Switches Red', categoria: 'Infraestructura', cantidad: 15, ubicacion: 'Central', estado: 'Activo', fechaActualizacion: '2026-04-12' },
    { id: '103', nombre: 'Cables Ethernet', categoria: 'Materiales', cantidad: 50, ubicacion: 'Almacén Central', estado: 'Activo', fechaActualizacion: '2026-04-15' },
    { id: '104', nombre: 'Router Cisco', categoria: 'Infraestructura', cantidad: 6, ubicacion: 'Central', estado: 'Activo', fechaActualizacion: '2026-04-10' },
    { id: '105', nombre: 'Impresoras Multifunción', categoria: 'Equipos', cantidad: 4, ubicacion: 'Oficinas', estado: 'Mantenimiento', fechaActualizacion: '2026-03-25' },
  ]);

  // Categorías disponibles
  const [categorias, setCategorias] = useState<string[]>([
    'Herramientas',
    'Ropa',
    'Mercadería',
    'Materiales',
    'Equipos',
    'Periféricos',
    'Infraestructura',
    'Mobiliario',
    'Documentación',
    'Consumibles'
  ]);

  const [newCategory, setNewCategory] = useState('');

  // Estados para modal
  const [showModal, setShowModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    categoria: 'Herramientas',
    cantidad: '1',
    ubicacion: '',
    estado: 'Activo',
  });

  const currentInventory = inventoryType === 'provincial' ? inventoryItems : nationalInventoryItems;
  const currentSetInventory = inventoryType === 'provincial' ? setInventoryItems : setNationalInventoryItems;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLoginError('Ingresa tu correo y contraseña.');
      setLoginLoading(false);
      return;
    }

    try {
      await loginWithEmailPassword(trimmedEmail, password);
      setEmail('');
      setPassword('');
    } catch (error) {
      console.error(error);
      setLoginError('Correo o contraseña incorrectos. Verifica tus datos.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoginError('');
    setLoginLoading(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error(error);
      setLoginError('No se pudo iniciar sesión con Google. Intenta de nuevo.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Cargar inventario desde Firebase
  useEffect(() => {
    if (user) {
      loadInventoryFromFirebase();
    }
  }, [user]);

  const loadInventoryFromFirebase = async () => {
    try {
      const q = query(collection(db, 'inventory'), where('userId', '==', user?.uid));
      const querySnapshot = await getDocs(q);
      const items: InventoryItem[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      if (items.length > 0) {
        setInventoryItems(items);
      }
    } catch (error) {
      console.error('Error cargando inventario:', error);
    }
  };

  // CRUD Operations
  const openAddModal = () => {
    setEditingItemId(null);
    setFormData({
      nombre: '',
      categoria: 'Herramientas',
      cantidad: '1',
      ubicacion: '',
      estado: 'Activo',
    });
    setShowModal(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setFormData({
      nombre: item.nombre,
      categoria: item.categoria,
      cantidad: item.cantidad.toString(),
      ubicacion: item.ubicacion,
      estado: item.estado,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItemId(null);
  };

  const handleFormChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'cantidad' ? value : value
    }));
  };

  const handleSaveItem = () => {
    if (!formData.nombre.trim() || !formData.ubicacion.trim()) {
      alert('Por favor completa todos los campos.');
      return;
    }

    const newItem: InventoryItem = {
      id: editingItemId || Date.now().toString(),
      nombre: formData.nombre,
      categoria: formData.categoria,
      cantidad: parseInt(formData.cantidad) || 0,
      ubicacion: formData.ubicacion,
      estado: formData.estado,
      fechaActualizacion: new Date().toISOString().split('T')[0],
    };

    if (editingItemId) {
      // Editar item
      currentSetInventory(currentInventory.map(item => 
        item.id === editingItemId ? newItem : item
      ));
    } else {
      // Agregar item
      currentSetInventory([...currentInventory, newItem]);
    }

    closeModal();
  };

  const handleDeleteItem = (itemId: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este item?')) {
      currentSetInventory(currentInventory.filter(item => item.id !== itemId));
    }
  };

  const handleAddCategory = () => {
    if (newCategory.trim() && !categorias.includes(newCategory)) {
      setCategorias([...categorias, newCategory]);
      setNewCategory('');
    }
  };

  // Funciones de exportación
  const exportToPDF = () => {
    const doc = new jsPDF();
    let yPosition = 20;

    doc.setFontSize(16);
    doc.text(`Reporte de Inventario ${inventoryType === 'provincial' ? 'Provincial' : 'Nacional'}`, 20, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, 20, yPosition);
    doc.text(`Usuario: ${user?.email || ''}`, 20, yPosition + 5);
    yPosition += 20;

    // Encabezados
    doc.setFontSize(11);
    doc.text('Nombre', 20, yPosition);
    doc.text('Categoría', 80, yPosition);
    doc.text('Cantidad', 130, yPosition);
    doc.text('Estado', 160, yPosition);
    yPosition += 7;

    // Datos
    doc.setFontSize(9);
    currentInventory.forEach(item => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(item.nombre.substring(0, 30), 20, yPosition);
      doc.text(item.categoria, 80, yPosition);
      doc.text(item.cantidad.toString(), 130, yPosition);
      doc.text(item.estado, 160, yPosition);
      yPosition += 7;
    });

    doc.save(`inventario-${inventoryType}-reporte.pdf`);
  };

  const exportToExcel = () => {
    const worksheetData = [
      [`Reporte de Inventario ${inventoryType === 'provincial' ? 'Provincial' : 'Nacional'}`],
      [`Generado: ${new Date().toLocaleDateString('es-ES')}`],
      [`Usuario: ${user?.email}`],
      [],
      ['Nombre', 'Categoría', 'Cantidad', 'Ubicación', 'Estado', 'Fecha Actualización'],
      ...currentInventory.map(item => [
        item.nombre,
        item.categoria,
        item.cantidad,
        item.ubicacion,
        item.estado,
        item.fechaActualizacion
      ])
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario');
    XLSX.writeFile(workbook, `inventario-${inventoryType}-reporte.xlsx`);
  };

  // Datos para gráficos
  const getChartData = () => {
    const categoriesCounts = currentInventory.reduce((acc, item) => {
      const existing = acc.find(c => c.name === item.categoria);
      if (existing) {
        existing.cantidad += item.cantidad;
      } else {
        acc.push({ name: item.categoria, cantidad: item.cantidad });
      }
      return acc;
    }, [] as { name: string; cantidad: number }[]);

    const estadoCounts = [
      { name: 'Activo', value: currentInventory.filter(i => i.estado === 'Activo').length },
      { name: 'Inactivo', value: currentInventory.filter(i => i.estado === 'Inactivo').length },
      { name: 'Mantenimiento', value: currentInventory.filter(i => i.estado === 'Mantenimiento').length }
    ];

    return { categoriesCounts, estadoCounts };
  };

  const filteredItems = currentInventory.filter(item =>
    item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-100 to-emerald-200 text-teal-900 font-sans">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-teal-900 rounded-full mx-auto mb-5 spinner" />
          <p className="text-lg font-bold">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-emerald-200 flex items-center justify-center p-6 font-sans">
        <div className="relative w-full max-w-sm">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-teal-900 opacity-14" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-orange-600 opacity-12" />
          <div className="relative bg-white bg-opacity-95 rounded-3xl p-9 shadow-2xl border border-white border-opacity-90 z-10">
            <div className="flex justify-center mb-7">
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center overflow-hidden shadow-xl border-4 border-orange-500">
                <div className="text-5xl">🏛️</div>
              </div>
            </div>

            <div className="text-center mb-8">
              <p className="m-0 text-teal-900 font-bold text-xs tracking-wider uppercase">Gobierno del Chubut</p>
              <h1 className="mt-3 mb-2.5 text-4xl leading-tight text-slate-900">Ministerio de Desarrollo Humano</h1>
              <p className="m-0 text-blue-700 text-base">Sistema de Inventario institucional con acceso seguro.</p>
            </div>

            <form onSubmit={handleEmailLogin} className="grid gap-4.5">
              <div className="text-left">
                <label htmlFor="email" className="block font-bold mb-2 text-teal-900 text-sm">Correo electrónico</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@chubut.gov.ar"
                  className="w-full px-4.5 py-4 rounded-2xl border border-slate-300 text-base text-slate-900 bg-slate-50"
                />
              </div>

              <div className="text-left">
                <label htmlFor="password" className="block font-bold mb-2 text-teal-900 text-sm">Contraseña</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4.5 py-4 rounded-2xl border border-slate-300 text-base text-slate-900 bg-slate-50"
                />
              </div>

              {loginError && (
                <div className="bg-red-100 text-red-900 rounded-2xl p-4 text-sm">{loginError}</div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-4 px-4.5 rounded-2xl border-none bg-orange-600 text-white font-bold text-base cursor-pointer shadow-xl hover:bg-orange-700 disabled:opacity-70"
              >
                {loginLoading ? 'Ingresando...' : 'Iniciar sesión'}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6.5 text-slate-500">
              <div className="flex-1 h-px bg-slate-300" />
              <span className="text-sm">o</span>
              <div className="flex-1 h-px bg-slate-300" />
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={loginLoading}
              className="w-full py-4 px-4.5 rounded-2xl border border-slate-300 bg-white text-teal-900 font-bold text-base cursor-pointer flex justify-center gap-2.5 hover:bg-slate-50 disabled:opacity-70"
            >
              {loginLoading ? 'Ingresando...' : 'Ingresar con Google'}
            </button>

            <p className="mt-6 text-slate-500 text-xs text-center">Si el login no funciona, revisa tus credenciales en Firebase Authentication o usa la opción de Google.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 w-64 h-screen bg-slate-900 text-white p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-lg bg-orange-600 flex items-center justify-center font-bold text-lg">📦</div>
          <div>
            <h2 className="font-bold text-lg">InventarioApp</h2>
            <p className="text-xs text-slate-400">Sistema de Control</p>
          </div>
        </div>

        <nav className="space-y-2">
          {[
            { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
            { id: 'inventario', label: '📋 Inventario', icon: '📋' },
            { id: 'reportes', label: '📈 Reportes', icon: '📈' },
            { id: 'configuracion', label: '⚙️ Configuración', icon: '⚙️' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveMenu(item.id as any)}
              className={`w-full text-left px-4 py-3 rounded-lg transition ${
                activeMenu === item.id
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-6 left-6 right-6 pt-6 border-t border-slate-700">
          <p className="text-xs text-slate-400 mb-2">Conectado como</p>
          <p className="text-sm font-semibold text-white truncate">{user?.email}</p>
          <button
            onClick={() => logout()}
            className="w-full mt-4 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm text-orange-600 font-bold uppercase mb-1">Ministerio de Desarrollo Humano</p>
            <h1 className="text-3xl font-bold text-slate-900">
              {activeMenu === 'dashboard' && 'Panel de Control'}
              {activeMenu === 'inventario' && 'Gestión de Inventario'}
              {activeMenu === 'reportes' && 'Reportes'}
              {activeMenu === 'configuracion' && 'Configuración'}
            </h1>
            <p className="text-slate-600 mt-1">Inventario {inventoryType === 'provincial' ? 'Provincial' : 'Nacional'}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-600">Hoy</p>
            <p className="text-lg font-bold text-slate-900">{new Date().toLocaleDateString('es-ES')}</p>
          </div>
        </div>

        {/* Selector de Tipo de Inventario */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setInventoryType('provincial')}
            className={`px-6 py-3 rounded-xl font-bold transition ${
              inventoryType === 'provincial'
                ? 'bg-orange-600 text-white shadow-lg'
                : 'bg-white text-slate-900 border-2 border-slate-200 hover:border-orange-600'
            }`}
          >
            📍 Inventario Provincial
          </button>
          <button
            onClick={() => setInventoryType('nacional')}
            className={`px-6 py-3 rounded-xl font-bold transition ${
              inventoryType === 'nacional'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-slate-900 border-2 border-slate-200 hover:border-blue-600'
            }`}
          >
            🌍 Inventario Nacional
          </button>
        </div>

        {/* Dashboard View */}
        {activeMenu === 'dashboard' && (
          <div>
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition">
                <p className="text-slate-600 text-sm font-semibold uppercase">Total de Items</p>
                <p className="text-4xl font-bold text-slate-900 mt-2">{currentInventory.length}</p>
                <p className="text-xs text-slate-500 mt-2">+2 esta semana</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition border-l-4 border-orange-500">
                <p className="text-slate-600 text-sm font-semibold uppercase">Stock Bajo</p>
                <p className="text-4xl font-bold text-orange-600 mt-2">{currentInventory.filter(i => i.cantidad <= 3).length}</p>
                <p className="text-xs text-slate-500 mt-2">Requiere atención</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition border-l-4 border-green-500">
                <p className="text-slate-600 text-sm font-semibold uppercase">Activos</p>
                <p className="text-4xl font-bold text-green-600 mt-2">{currentInventory.filter(i => i.estado === 'Activo').length}</p>
                <p className="text-xs text-slate-500 mt-2">En funcionamiento</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition border-l-4 border-blue-500">
                <p className="text-slate-600 text-sm font-semibold uppercase">Categorías</p>
                <p className="text-4xl font-bold text-blue-600 mt-2">{new Set(currentInventory.map(i => i.categoria)).size}</p>
                <p className="text-xs text-slate-500 mt-2">Diferentes tipos</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-md mb-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Acciones Rápidas</h3>
              <div className="grid grid-cols-4 gap-4">
                <button onClick={openAddModal} className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-slate-300 hover:border-orange-500 hover:bg-orange-50 transition">
                  <span className="text-3xl mb-2">➕</span>
                  <span className="font-semibold text-sm">Agregar Item</span>
                </button>
                <button onClick={exportToExcel} className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition">
                  <span className="text-3xl mb-2">📤</span>
                  <span className="font-semibold text-sm">Exportar</span>
                </button>
                <button onClick={() => setActiveMenu('reportes')} className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-slate-300 hover:border-green-500 hover:bg-green-50 transition">
                  <span className="text-3xl mb-2">📊</span>
                  <span className="font-semibold text-sm">Reportes</span>
                </button>
                <button onClick={() => setActiveMenu('configuracion')} className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-slate-300 hover:border-purple-500 hover:bg-purple-50 transition">
                  <span className="text-3xl mb-2">⚙️</span>
                  <span className="font-semibold text-sm">Configurar</span>
                </button>
              </div>
            </div>

            {/* Recent Items */}
            <div className="bg-white rounded-2xl p-6 shadow-md">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Últimas Actualizaciones</h3>
              <div className="space-y-3">
                {currentInventory.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition">
                    <div>
                      <p className="font-semibold text-slate-900">{item.nombre}</p>
                      <p className="text-xs text-slate-600">{item.categoria} • {item.ubicacion}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">{item.cantidad}</p>
                      <p className="text-xs text-slate-500">{item.fechaActualizacion}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Inventory View */}
        {activeMenu === 'inventario' && (
          <div>
            {/* Search and Filter */}
            <div className="flex gap-4 mb-6">
              <input
                type="text"
                placeholder="🔍 Buscar por nombre o categoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:border-orange-500"
              />
              <button onClick={openAddModal} className="px-6 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition">
                ➕ Agregar Item
              </button>
            </div>

            {/* Inventory Table */}
            <div className="bg-white rounded-2xl shadow-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-bold">Nombre</th>
                    <th className="px-6 py-4 text-left font-bold">Categoría</th>
                    <th className="px-6 py-4 text-center font-bold">Cantidad</th>
                    <th className="px-6 py-4 text-left font-bold">Ubicación</th>
                    <th className="px-6 py-4 text-left font-bold">Estado</th>
                    <th className="px-6 py-4 text-center font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-semibold text-slate-900">{item.nombre}</td>
                      <td className="px-6 py-4 text-slate-600">{item.categoria}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full font-bold ${
                          item.cantidad <= 3 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {item.cantidad}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{item.ubicacion}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                          item.estado === 'Activo' ? 'bg-green-100 text-green-800' :
                          item.estado === 'Inactivo' ? 'bg-slate-100 text-slate-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {item.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => openEditModal(item)} className="text-blue-600 hover:text-blue-800 mr-3">✏️</button>
                        <button onClick={() => handleDeleteItem(item.id)} className="text-red-600 hover:text-red-800">🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredItems.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-slate-500">No hay items que coincidan con la búsqueda.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reportes View */}
        {activeMenu === 'reportes' && (
          <div>
            {/* Botones de Exportación */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition"
              >
                📄 Exportar PDF
              </button>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition"
              >
                📊 Exportar Excel
              </button>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Gráfico de Barras - Categorías */}
              <div className="bg-white rounded-2xl p-6 shadow-md">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Cantidad por Categoría</h3>
                {getChartData().categoriesCounts.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getChartData().categoriesCounts}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="cantidad" fill="#FF6B00" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-500 text-center py-12">Sin datos disponibles</p>
                )}
              </div>

              {/* Gráfico de Pastel - Estado */}
              <div className="bg-white rounded-2xl p-6 shadow-md">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Distribución por Estado</h3>
                {getChartData().estadoCounts.some(c => c.value > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={getChartData().estadoCounts}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#10B981" />
                        <Cell fill="#EF4444" />
                        <Cell fill="#F59E0B" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-500 text-center py-12">Sin datos disponibles</p>
                )}
            </div>

            {/* Estadísticas Detalladas */}
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-md">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Reporte de Stock</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Items en Stock</span>
                    <span className="text-2xl font-bold text-green-600">{currentInventory.filter(i => i.cantidad > 5).length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Stock Medio</span>
                    <span className="text-2xl font-bold text-yellow-600">{currentInventory.filter(i => i.cantidad > 3 && i.cantidad <= 5).length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Stock Bajo</span>
                    <span className="text-2xl font-bold text-red-600">{currentInventory.filter(i => i.cantidad <= 3).length}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-md">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Reporte por Estado</h3>
                <div className="space-y-3">
                  {['Activo', 'Inactivo', 'Mantenimiento'].map((estado) => (
                    <div key={estado} className="flex justify-between items-center">
                      <span className="text-slate-600">{estado}</span>
                      <span className="text-2xl font-bold text-slate-900">{currentInventory.filter(i => i.estado === estado).length}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-md">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Resumen General</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Total Items</span>
                    <span className="text-2xl font-bold text-blue-600">{currentInventory.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Categorías</span>
                    <span className="text-2xl font-bold text-purple-600">{new Set(currentInventory.map(i => i.categoria)).size}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Ubicaciones</span>
                    <span className="text-2xl font-bold text-indigo-600">{new Set(currentInventory.map(i => i.ubicacion)).size}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Configuración View */}
        {activeMenu === 'configuracion' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-md max-w-2xl">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Configuración del Sistema</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block font-semibold text-slate-900 mb-2">Nombre de Organización</label>
                  <input 
                    type="text" 
                    placeholder="Nombre de organización"
                    defaultValue="Ministerio de Desarrollo Humano" 
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-orange-500" 
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-900 mb-2">Email de Contacto</label>
                  <input 
                    type="email" 
                    placeholder="correo@ejemplo.com"
                    defaultValue={user?.email || ''} 
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-orange-500" 
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-900 mb-2">Notificaciones</label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" defaultChecked className="mr-2" />
                      <span className="text-slate-700">Alertas de stock bajo</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" defaultChecked className="mr-2" />
                      <span className="text-slate-700">Reportes semanales</span>
                    </label>
                  </div>
                </div>

                <button className="w-full py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition">
                  Guardar Cambios
                </button>
              </div>
            </div>

            {/* Gestión de Categorías */}
            <div className="bg-white rounded-2xl p-6 shadow-md max-w-2xl">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Gestión de Categorías</h3>
              
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Nueva categoría..."
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-orange-500" 
                  />
                  <button 
                    onClick={handleAddCategory}
                    className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition"
                  >
                    ➕ Agregar
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="font-semibold text-slate-900">Categorías disponibles:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {categorias.map((cat) => (
                      <div key={cat} className="flex items-center justify-between bg-slate-100 px-4 py-2 rounded-lg">
                        <span className="text-slate-900">{cat}</span>
                        <button 
                          onClick={() => setCategorias(categorias.filter(c => c !== cat))}
                          className="text-red-600 hover:text-red-800 font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal para Agregar/Editar Item */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 shadow-2xl w-full max-w-md">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              {editingItemId ? 'Editar Item' : 'Agregar Nuevo Item'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-900 mb-2">Nombre</label>
                <input 
                  type="text" 
                  placeholder="Nombre del item"
                  value={formData.nombre}
                  onChange={(e) => handleFormChange('nombre', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-orange-500" 
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-900 mb-2">Categoría</label>
                <select 
                  value={formData.categoria}
                  onChange={(e) => handleFormChange('categoria', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-orange-500"
                >
                  {categorias.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-900 mb-2">Cantidad</label>
                <input 
                  type="number" 
                  placeholder="Cantidad"
                  value={formData.cantidad}
                  onChange={(e) => handleFormChange('cantidad', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-orange-500" 
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-900 mb-2">Ubicación</label>
                <input 
                  type="text" 
                  placeholder="Ubicación del item"
                  value={formData.ubicacion}
                  onChange={(e) => handleFormChange('ubicacion', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-orange-500" 
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-900 mb-2">Estado</label>
                <select 
                  value={formData.estado}
                  onChange={(e) => handleFormChange('estado', e.target.value as any)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-orange-500"
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={handleSaveItem}
                  className="flex-1 py-2 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition"
                >
                  {editingItemId ? 'Actualizar' : 'Agregar'}
                </button>
                <button 
                  onClick={closeModal}
                  className="flex-1 py-2 bg-slate-300 text-slate-900 font-bold rounded-lg hover:bg-slate-400 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
