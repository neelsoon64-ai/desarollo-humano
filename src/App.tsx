import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle, loginWithEmailPassword, logout, firebaseConfigValid } from './firebase';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { collection, getDocs, addDoc, query, where, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
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
  const [zoom, setZoom] = useState(1);
  const [viewingRemito, setViewingRemito] = useState<string | null>(null);
  const [reportStatusFilter, setReportStatusFilter] = useState<'En Stock' | 'Sin Stock' | null>(null);
  const [newMemberNombre, setNewMemberNombre] = useState('');
  const [newMemberApellido, setNewMemberApellido] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    const saved = localStorage.getItem('teamMembers');
    if (saved) return JSON.parse(saved);
    return [
      { email: 'admin@chubut.gov.ar', role: 'Administrador', nombre: 'Admin', apellido: 'Central', password: 'admin' },
      { email: 'neelsoon64@gmail.com', role: 'Administrador', nombre: 'Nelson', apellido: '', password: 'Luna2187' }
    ];
  });
  const [newMemberRole, setNewMemberRole] = useState<'Administrador' | 'Operario'>('Operario');
  const [newMemberPassword, setNewMemberPassword] = useState('');

  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'inventario' | 'reportes' | 'configuracion'>('dashboard');
  const [inventoryType, setInventoryType] = useState<'provincial' | 'nacional'>('provincial');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [nationalInventoryItems, setNationalInventoryItems] = useState<InventoryItem[]>([]);

  const currentInventory = inventoryType === 'provincial' ? inventoryItems : nationalInventoryItems;

  const currentUserData = teamMembers.find(m => m.email === user?.email);
  const isAdmin = currentUserData?.role === 'Administrador' || user?.email === 'admin@chubut.gov.ar' || user?.email === 'neelsoon64@gmail.com';
  const userRole = isAdmin ? 'Administrador' : 'Operario';
  const userFullName = currentUserData ? `${currentUserData.nombre} ${currentUserData.apellido}`.trim() : (user?.displayName || user?.email || 'Desconocido');

  const filteredInventory = currentInventory.filter(item => {
    const matchesSearch = item.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || item.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // --- NUEVA FUNCIÓN: Sincronizar Perfil de Usuario ---
  const syncUserToFirestore = async (userAuth: User) => {
    try {
      const userRef = doc(db, 'users', userAuth.uid);
      const localData = teamMembers.find(m => m.email?.toLowerCase() === userAuth.email?.toLowerCase());

      const userData = {
        uid: userAuth.uid,
        email: userAuth.email,
        nombre: localData?.nombre || userAuth.displayName || 'Usuario',
        apellido: localData?.apellido || '',
        role: localData?.role || 'Operario',
        lastLogin: new Date().toISOString()
      };

      await setDoc(userRef, userData, { merge: true });
      console.log("Perfil de usuario sincronizado en Firestore");
    } catch (e) {
      console.error("Error al sincronizar usuario:", e);
    }
  };

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setFormData({ ...formData, remito: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este elemento?')) {
      try {
        await deleteDoc(doc(db, 'inventory', id));
      } catch (e) { }
      
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
      userId: user?.uid || 'user-id-fallback',
      cargadoPor: userFullName,
      remito: formData.remito
    };

    try {
      setLoginLoading(true);
      if (editingItem) {
        if (editingItem.id.length > 5) await updateDoc(doc(db, 'inventory', editingItem.id), itemData);
        
        const updateList = (items: InventoryItem[]) => 
          items.map(i => i.id === editingItem.id ? { ...itemData, id: i.id } : i);
          
        if (inventoryType === 'provincial') setInventoryItems(updateList);
        else setNationalInventoryItems(updateList);
        alert("¡Item actualizado!");
      } else {
        try {
          const docRef = await addDoc(collection(db, 'inventory'), itemData);
          const newItem = { ...itemData, id: docRef.id };
          if (inventoryType === 'provincial') setInventoryItems(prev => [...prev, newItem]);
          else setNationalInventoryItems(prev => [...prev, newItem]);
          alert("¡Guardado en base de datos!");
        } catch (dbError) {
          const localId = Math.random().toString(36).substr(2, 9);
          const newItem = { ...itemData, id: localId };
          if (inventoryType === 'provincial') setInventoryItems(prev => [...prev, newItem]);
          else setNationalInventoryItems(prev => [...prev, newItem]);
          alert("Guardado localmente");
        }
      }
      setShowForm(false);
      setEditingItem(null);
    } catch (e) { 
      console.error(e);
    } finally {
      setLoginLoading(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('teamMembers', JSON.stringify(teamMembers));
  }, [teamMembers]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        syncUserToFirestore(u); // Se ejecuta al loguear
      }
    });
    return () => unsubscribe();
  }, [teamMembers]);

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const trimmedEmail = email.trim();
    try {
      await loginWithEmailPassword(trimmedEmail, password);
    } catch (error) {
      const localMember = teamMembers.find(
        (m) => m.email.toLowerCase() === trimmedEmail.toLowerCase() && m.password === password
      );
      if (localMember) {
        setUser({ email: localMember.email, uid: `local-${localMember.email}` } as any);
      } else {
        setLoginError('Credenciales incorrectas.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoginLoading(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      setLoginError('Error con Google.');
    } finally {
      setLoginLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadInventoryFromFirebase();
    }
  }, [user]);

  const loadInventoryFromFirebase = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'inventory'));
      const items: InventoryItem[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      if (items.length > 0) setInventoryItems(items);
    } catch (error) {
      console.error(error);
    }
  };

  const exportToExcel = () => {
    const worksheetData = [
      [`Reporte de Inventario`],
      ['Nombre', 'Categoría', 'Cantidad', 'Ubicación', 'Estado', 'Fecha'],
      ...currentInventory.map(item => [item.nombre, item.categoria, item.cantidad, item.ubicacion, item.estado, item.fechaActualizacion])
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario');
    XLSX.writeFile(workbook, `reporte.xlsx`);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold">Cargando sistema...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm text-center">
          <img src="https://desarrollohumano.chubut.gov.ar/wp-content/uploads/2024/04/logochubut.png" className="w-32 mx-auto mb-6" alt="Chubut" />
          <h1 className="text-2xl font-bold mb-6">Desarrollo Humano - Inventario</h1>
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full p-3 border rounded-xl" required />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full p-3 border rounded-xl" required />
            {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
            <button type="submit" disabled={loginLoading} className="w-full bg-orange-600 text-white p-3 rounded-xl font-bold">Ingresar</button>
          </form>
          <button onClick={handleGoogleLogin} className="w-full mt-4 border p-3 rounded-xl flex justify-center gap-2">Google</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="w-64 bg-slate-900 text-white p-6 fixed h-full">
        <h2 className="text-xl font-bold mb-8">📦 InventarioApp</h2>
        <nav className="space-y-2">
          <button onClick={() => setActiveMenu('dashboard')} className={`w-full text-left p-3 rounded-lg ${activeMenu === 'dashboard' ? 'bg-orange-600' : ''}`}>📊 Dashboard</button>
          <button onClick={() => setActiveMenu('inventario')} className={`w-full text-left p-3 rounded-lg ${activeMenu === 'inventario' ? 'bg-orange-600' : ''}`}>📋 Inventario</button>
          {isAdmin && <button onClick={() => setActiveMenu('configuracion')} className={`w-full text-left p-3 rounded-lg ${activeMenu === 'configuracion' ? 'bg-orange-600' : ''}`}>⚙️ Configuración</button>}
        </nav>
        <div className="absolute bottom-6">
          <p className="text-xs text-slate-400">{user.email}</p>
          <button onClick={() => logout()} className="text-red-400 text-sm font-bold mt-2">Cerrar sesión</button>
        </div>
      </div>

      <div className="ml-64 p-8 w-full">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 uppercase">
            {activeMenu === 'dashboard' ? 'Panel de Control' : 'Gestión'}
          </h1>
          <p className="text-slate-500">Ministerio de Desarrollo Humano - Chubut</p>
        </header>

        {activeMenu === 'dashboard' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <p className="text-sm font-bold text-slate-500 uppercase">Total Items</p>
              <p className="text-4xl font-bold">{currentInventory.length}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-orange-500">
              <p className="text-sm font-bold text-slate-500 uppercase">Sin Stock</p>
              <p className="text-4xl font-bold">{currentInventory.filter(i => i.estado === 'Sin Stock').length}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <p className="text-sm font-bold text-slate-500 uppercase">Ubicaciones</p>
              <p className="text-4xl font-bold">{new Set(currentInventory.map(i => i.ubicacion)).size}</p>
            </div>
          </div>
        )}

        {activeMenu === 'inventario' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between mb-6">
              <input type="text" placeholder="Buscar..." className="p-2 border rounded-lg w-64" onChange={e => setSearchTerm(e.target.value)} />
              <button onClick={() => setShowForm(true)} className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold">+ Nuevo</button>
            </div>

            {showForm && (
              <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4 mb-8 p-4 border rounded-xl bg-orange-50">
                <input type="text" placeholder="Nombre" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="p-2 border rounded" required />
                <input type="text" placeholder="Categoría" value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} className="p-2 border rounded" required />
                <input type="number" placeholder="Cantidad" value={formData.cantidad} onChange={e => setFormData({...formData, cantidad: e.target.value})} className="p-2 border rounded" required />
                <input type="text" placeholder="Ubicación" value={formData.ubicacion} onChange={e => setFormData({...formData, ubicacion: e.target.value})} className="p-2 border rounded" required />
                <select value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value as any})} className="p-2 border rounded">
                  <option value="En Stock">En Stock</option>
                  <option value="Sin Stock">Sin Stock</option>
                </select>
                <div className="flex gap-2">
                  <button type="submit" className="bg-orange-600 text-white flex-1 rounded font-bold">Guardar</button>
                  <button type="button" onClick={() => setShowForm(false)} className="bg-slate-300 flex-1 rounded">X</button>
                </div>
              </form>
            )}

            <table className="w-full text-left">
              <thead>
                <tr className="border-b text-slate-400 text-sm">
                  <th className="py-3">PRODUCTO</th>
                  <th>CATEGORÍA</th>
                  <th>CANT.</th>
                  <th>UBICACIÓN</th>
                  <th>ESTADO</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map(item => (
                  <tr key={item.id} className="border-b hover:bg-slate-50 transition">
                    <td className="py-4 font-semibold">{item.nombre}</td>
                    <td className="text-slate-600">{item.categoria}</td>
                    <td className="font-bold">{item.cantidad}</td>
                    <td>{item.ubicacion}</td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.estado === 'En Stock' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.estado}</span>
                    </td>
                    <td>
                      <button onClick={() => handleEdit(item)} className="text-blue-600 mr-2">✏️</button>
                      <button onClick={() => handleDelete(item.id)} className="text-red-600">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;