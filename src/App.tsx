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
  estado: 'En Stock' | 'Sin Stock';
  fechaActualizacion: string;
  cargadoPor?: string;
  remito?: string;
}

interface FormData {
  nombre: string;
  categoria: string;
  cantidad: string;
  ubicacion: string;
  estado: 'En Stock' | 'Sin Stock';
  remito: string;
}

interface TeamMember {
  email: string;
  role: 'Administrador' | 'Operario';
  nombre: string;
  apellido: string;
  password?: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  // Estados para CRUD y Filtrado
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    categoria: '',
    cantidad: '',
    ubicacion: '',
    estado: 'En Stock',
    remito: '',
  });
  const [reportStatusFilter, setReportStatusFilter] = useState<'En Stock' | 'Sin Stock' | null>(null);
  const [newMemberNombre, setNewMemberNombre] = useState('');
  const [newMemberApellido, setNewMemberApellido] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    const saved = localStorage.getItem('teamMembers');
    if (saved) return JSON.parse(saved);
    return [
      { email: 'admin@chubut.gov.ar', role: 'Administrador', nombre: 'Admin', apellido: 'Central' },
      { email: 'neelsoon64@gmail.com', role: 'Administrador', nombre: 'Nelson', apellido: '' }
    ];
  });
  const [newMemberRole, setNewMemberRole] = useState<'Administrador' | 'Operario'>('Operario');
  const [newMemberPassword, setNewMemberPassword] = useState('');

  // Estados para el dashboard
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'inventario' | 'reportes' | 'configuracion'>('dashboard');
  const [inventoryType, setInventoryType] = useState<'provincial' | 'nacional'>('provincial');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([
    { id: '1', nombre: 'Laptop Dell', categoria: 'Equipos', cantidad: 5, ubicacion: 'Oficina A', estado: 'En Stock', fechaActualizacion: '2026-04-15' },
    { id: '2', nombre: 'Mouse Inalámbrico', categoria: 'Periféricos', cantidad: 12, ubicacion: 'Almacén', estado: 'En Stock', fechaActualizacion: '2026-04-10' },
    { id: '3', nombre: 'Monitor LG 24"', categoria: 'Equipos', cantidad: 3, ubicacion: 'Oficina B', estado: 'Sin Stock', fechaActualizacion: '2026-04-01' },
    { id: '4', nombre: 'Teclado Mecánico', categoria: 'Periféricos', cantidad: 1, ubicacion: 'Almacén', estado: 'En Stock', fechaActualizacion: '2026-03-28' },
  ]);
  const [nationalInventoryItems, setNationalInventoryItems] = useState<InventoryItem[]>([
    { id: '101', nombre: 'Servidores', categoria: 'Infraestructura', cantidad: 8, ubicacion: 'Data Center', estado: 'En Stock', fechaActualizacion: '2026-04-18' },
    { id: '102', nombre: 'Switches Red', categoria: 'Equipos Red', cantidad: 15, ubicacion: 'Central', estado: 'En Stock', fechaActualizacion: '2026-04-12' },
    { id: '103', nombre: 'Cables Ethernet', categoria: 'Periféricos', cantidad: 50, ubicacion: 'Almacén Central', estado: 'En Stock', fechaActualizacion: '2026-04-15' },
    { id: '104', nombre: 'Router Cisco', categoria: 'Equipos Red', cantidad: 6, ubicacion: 'Central', estado: 'En Stock', fechaActualizacion: '2026-04-10' },
    { id: '105', nombre: 'Impresoras Multifunción', categoria: 'Equipos', cantidad: 4, ubicacion: 'Oficinas', estado: 'Sin Stock', fechaActualizacion: '2026-03-25' },
  ]);

  const currentInventory = inventoryType === 'provincial' ? inventoryItems : nationalInventoryItems;

  // Determinar rol del usuario actual
  const currentUserData = teamMembers.find(m => m.email === user?.email);
  const isAdmin = currentUserData?.role === 'Administrador' || user?.email === 'admin@chubut.gov.ar' || user?.email === 'neelsoon64@gmail.com';
  const userRole = isAdmin ? 'Administrador' : 'Operario';
  const userFullName = currentUserData ? `${currentUserData.nombre} ${currentUserData.apellido}`.trim() : (user?.displayName || user?.email || 'Desconocido');

  const filteredInventory = currentInventory.filter(item => {
    const matchesSearch = item.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || item.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      nombre: item.nombre,
      categoria: item.categoria,
      cantidad: item.cantidad.toString(),
      ubicacion: item.ubicacion,
      estado: item.estado,
      remito: item.remito || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este elemento?')) {
      try {
        await deleteDoc(doc(db, 'inventory', id));
      } catch (e) { /* Fallback para items locales */ }
      
      const updateList = (items: InventoryItem[]) => items.filter(i => i.id !== id);
      if (inventoryType === 'provincial') setInventoryItems(updateList);
      else setNationalInventoryItems(updateList);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemData: any = {
      nombre: formData.nombre,
      categoria: formData.categoria,
      cantidad: parseInt(formData.cantidad) || 0,
      ubicacion: formData.ubicacion,
      estado: formData.estado,
      fechaActualizacion: new Date().toISOString().split('T')[0],
      userId: user?.uid,
      cargadoPor: userFullName,
      remito: formData.remito
    };

    try {
      if (editingItem) {
        if (editingItem.id.length > 5) await updateDoc(doc(db, 'inventory', editingItem.id), itemData);
        const updateList = (items: InventoryItem[]) => items.map(i => i.id === editingItem.id ? { ...itemData, id: i.id } : i);
        if (inventoryType === 'provincial') setInventoryItems(updateList);
        else setNationalInventoryItems(updateList);
      } else {
        const docRef = await addDoc(collection(db, 'inventory'), itemData);
        const newItem = { ...itemData, id: docRef.id };
        if (inventoryType === 'provincial') setInventoryItems(prev => [...prev, newItem]);
        else setNationalInventoryItems(prev => [...prev, newItem]);
      }
      setShowForm(false);
      setEditingItem(null);
    } catch (e) { console.error("Error al guardar:", e); }
  };

  const handleDeleteMember = (email: string) => {
    if (email === user?.email) {
      alert("No puedes eliminar tu propia cuenta de administrador.");
      return;
    }
    if (window.confirm(`¿Estás seguro de eliminar el acceso para ${email}?`)) {
      setTeamMembers(teamMembers.filter(m => m.email !== email));
    }
  };

  // Guardar usuarios automáticamente cuando cambian
  useEffect(() => {
    localStorage.setItem('teamMembers', JSON.stringify(teamMembers));
  }, [teamMembers]);

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
      // Si falla Firebase Auth, intentamos validar contra la lista local de teamMembers
      const localMember = teamMembers.find(
        (m) => m.email.toLowerCase() === trimmedEmail.toLowerCase() && m.password === password
      );

      if (localMember) {
        // Simulamos el inicio de sesión exitoso con los datos del miembro local
        setUser({ email: localMember.email, uid: `local-${localMember.email}` } as any);
        setEmail('');
        setPassword('');
      } else {
        console.error(error);
        setLoginError('Correo o contraseña incorrectos. Verifica tus datos.');
      }
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
      const q = query(collection(db, 'inventory'));
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
      { name: 'En Stock', value: currentInventory.filter(i => i.estado === 'En Stock').length },
      { name: 'Sin Stock', value: currentInventory.filter(i => i.estado === 'Sin Stock').length }
    ];

    return { categoriesCounts, estadoCounts };
  };

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
              <div className="w-32 h-32 rounded-2xl bg-white border-2 border-teal-900 border-opacity-16 flex items-center justify-center overflow-hidden shadow-xl">
                <img
                src="https://desarrollohumano.chubut.gov.ar/wp-content/uploads/2024/04/logochubut.png"
                  alt="Logo Gobierno del Chubut"
                  className="w-full h-full object-contain p-2"
                onError={(e) => { 
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="text-4xl text-teal-900">🏛️</div>';
                }}
                />
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
            { id: 'reportes', label: '📈 Reportes', icon: '📈', adminOnly: true },
            { id: 'configuracion', label: '⚙️ Configuración', icon: '⚙️', adminOnly: true },
          ].filter(item => !item.adminOnly || isAdmin).map((item) => (
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
          <p className="text-sm font-semibold text-white truncate">{user?.email} ({userRole})</p>
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
                <p className="text-slate-600 text-sm font-semibold uppercase">En Stock</p>
                <p className="text-4xl font-bold text-green-600 mt-2">{currentInventory.filter(i => i.estado === 'En Stock').length}</p>
                <p className="text-xs text-slate-500 mt-2">Disponibles</p>
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
                {isAdmin && (
                  <button onClick={() => setActiveMenu('inventario')} className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-slate-300 hover:border-orange-500 hover:bg-orange-50 transition">
                    <span className="text-3xl mb-2">➕</span>
                    <span className="font-semibold text-sm">Agregar Item</span>
                  </button>
                )}
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
            {/* Formulario de Edición/Creación */}
            {showForm && (
              <div className="bg-white p-6 rounded-2xl shadow-lg mb-8 border border-orange-200">
                <h3 className="text-xl font-bold mb-4 text-slate-900">{editingItem ? '✏️ Editar Item' : '✨ Nuevo Item'}</h3>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="relative">
                    <input type="text" placeholder="Nombre (ej: Martillo)" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full p-3 border rounded-xl pr-10" required />
                    <button type="button" title="Escanear Producto" className="absolute right-3 top-3 text-slate-400 hover:text-orange-600">📷</button>
                  </div>
                  <input type="text" placeholder="Categoría (ej: Herramientas)" value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} className="p-3 border rounded-xl" required />
                  <input type="number" placeholder="Cantidad" value={formData.cantidad} onChange={e => setFormData({...formData, cantidad: e.target.value})} className="p-3 border rounded-xl" required />
                  <input type="text" placeholder="Ubicación" value={formData.ubicacion} onChange={e => setFormData({...formData, ubicacion: e.target.value})} className="p-3 border rounded-xl" required />
                  <div className="relative">
                    <input type="text" placeholder="N° de Remito / Documento" value={formData.remito} onChange={e => setFormData({...formData, remito: e.target.value})} className="w-full p-3 border rounded-xl pr-10" />
                    <button type="button" title="Escanear Remito" className="absolute right-3 top-3 text-slate-400 hover:text-blue-600">📷</button>
                  </div>
                  <select value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value as any})} className="p-3 border rounded-xl bg-white">
                    <option value="En Stock">En Stock</option>
                    <option value="Sin Stock">Sin Stock</option>
                  </select>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-orange-600 text-white font-bold p-3 rounded-xl hover:bg-orange-700 transition">Guardar</button>
                    <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-slate-200 text-slate-700 font-bold p-3 rounded-xl hover:bg-slate-300 transition">Cancelar</button>
                  </div>
                </form>
              </div>
            )}

            {/* Search and Filter */}
            <div className="flex gap-4 mb-6">
              <input
                type="text"
                placeholder="🔍 Buscar por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:border-orange-500"
              />
              <button 
                onClick={() => alert("Iniciando escáner de cámara...")}
                className="px-4 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition"
                title="Escanear código de barras"
              >📷</button>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-3 rounded-xl border border-slate-300 bg-white font-medium"
              >
                <option value="Todas">Todas las categorías</option>
                <option value="Equipos">Equipos</option>
                <option value="Periféricos">Periféricos</option>
                <option value="Herramientas">Herramientas</option>
                <option value="Infraestructura">Infraestructura</option>
              </select>
              {isAdmin && (
                <button 
                  onClick={() => { setEditingItem(null); setFormData({nombre:'', categoria:'', cantidad:'', ubicacion:'', estado:'En Stock', remito: ''}); setShowForm(true); }}
                  className="px-6 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition"
                >
                  ➕ Agregar Item
                </button>
              )}
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
                    <th className="px-6 py-4 text-left font-bold">Remito</th>
                    <th className="px-6 py-4 text-left font-bold">Cargado Por</th>
                    <th className="px-6 py-4 text-center font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => (
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
                          item.estado === 'En Stock' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {item.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {item.remito ? (
                          <button onClick={() => alert(`Documento asociado: ${item.remito}`)} className="flex items-center gap-1 text-blue-600 hover:underline">
                            <span>📄</span> <span className="text-xs">{item.remito}</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 italic">{item.cargadoPor || 'Sistema'}</td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => alert(`Detalles del Item:\nNombre: ${item.nombre}\nRemito: ${item.remito || 'Sin remito'}\nFecha: ${item.fechaActualizacion}\nCargado por: ${item.cargadoPor}`)} className="text-slate-500 hover:text-slate-800 mr-3" title="Ver Detalles">👁️</button>
                        {isAdmin && (
                          <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800 mr-3" title="Editar">✏️</button>
                        )}
                        {isAdmin && (
                          <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800" title="Borrar">🗑️</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getChartData().categoriesCounts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="cantidad" fill="#FF6B00" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Gráfico de Pastel - Estado */}
              <div className="bg-white rounded-2xl p-6 shadow-md">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Distribución por Estado</h3>
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
                      <Cell fill="#10B981" /> {/* En Stock */}
                      <Cell fill="#EF4444" /> {/* Sin Stock */}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
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
                  {['En Stock', 'Sin Stock'].map((estado) => (
                    <button 
                      key={estado} 
                      onClick={() => setReportStatusFilter(reportStatusFilter === estado ? null : estado as any)}
                      className={`w-full flex justify-between items-center p-2 rounded-lg transition ${reportStatusFilter === estado ? 'bg-orange-100' : 'hover:bg-slate-50'}`}
                    >
                      <span className="text-slate-600 font-medium">{estado}</span>
                      <span className={`text-2xl font-bold ${estado === 'En Stock' ? 'text-green-600' : 'text-red-600'}`}>
                        {currentInventory.filter(i => i.estado === estado).length}
                      </span>
                    </button>
                  ))}
                </div>
                {reportStatusFilter && (
                  <div className="mt-4 pt-4 border-t border-slate-100 max-h-40 overflow-y-auto">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Items en {reportStatusFilter}:</p>
                    <ul className="text-sm space-y-2">
                      {currentInventory.filter(i => i.estado === reportStatusFilter).map(item => (
                        <li key={item.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-md">
                          <span className="text-slate-700 font-medium">{item.nombre}</span>
                          <span className="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600">Stock: {item.cantidad}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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

              <div className="pt-6 border-t border-slate-200">
                <h4 className="font-bold text-slate-900 mb-4">👥 Gestión de Equipo</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <input 
                    type="text" 
                    placeholder="Nombre" 
                    value={newMemberNombre}
                    onChange={(e) => setNewMemberNombre(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm" 
                  />
                  <input 
                    type="text" 
                    placeholder="Apellido" 
                    value={newMemberApellido}
                    onChange={(e) => setNewMemberApellido(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm" 
                  />
                  <input 
                    id="newUserEmail" 
                    type="email" 
                    placeholder="correo@chubut.gov.ar" 
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm" 
                  />
                  <input 
                    type="password" 
                    placeholder="Contraseña temporal" 
                    value={newMemberPassword}
                    onChange={(e) => setNewMemberPassword(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm" 
                  />
                  <select 
                    value={newMemberRole} 
                    onChange={(e) => setNewMemberRole(e.target.value as any)}
                    className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                  >
                    <option value="Operario">Operario</option>
                    <option value="Administrador">Administrador</option>
                  </select>
                  <button 
                    onClick={() => {
                      const input = document.getElementById('newUserEmail') as HTMLInputElement;
                      if(input.value && newMemberNombre) { 
                        setTeamMembers([...teamMembers, { email: input.value, role: newMemberRole, password: newMemberPassword, nombre: newMemberNombre, apellido: newMemberApellido }]); 
                        input.value = '';
                        setNewMemberPassword('');
                        setNewMemberNombre('');
                        setNewMemberApellido('');
                      }
                    }}
                    className="bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition py-2"
                  >
                    Añadir
                  </button>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-500 mb-3 uppercase tracking-wider">Usuarios con acceso</p>
                  <div className="space-y-3">
                    {teamMembers.map(member => (
                        <div key={member.email} className="flex justify-between items-center text-sm">
                          <div className="flex flex-col">
                            <span className={`${member.email === user?.email ? 'font-semibold text-slate-700' : 'text-slate-600'}`}>
                              {member.nombre} {member.apellido} ({member.email}) {member.email === user?.email && '(Tú)'}
                            </span>
                            <span className="text-[10px] text-slate-400">PW: {member.password ? '••••••' : 'Auth Google/Firebase'}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 text-[10px] font-bold rounded-md uppercase ${
                              member.role === 'Administrador' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-slate-200 text-slate-600'
                            }`}>
                              {member.role}
                            </span>
                            {member.email !== user?.email && (
                              <button onClick={() => handleDeleteMember(member.email)} className="text-red-500 hover:text-red-700">🗑️</button>
                            )}
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
              </div>

              <button className="w-full py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition">
                Guardar Cambios
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
