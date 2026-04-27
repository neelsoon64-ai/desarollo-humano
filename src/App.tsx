import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle, loginWithEmailPassword, logout } from './firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
    nombre: '', categoria: '', cantidad: '', ubicacion: '', estado: 'En Stock', remito: '',
  });

  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'inventario' | 'reportes' | 'configuracion'>('dashboard');
  const [inventoryType, setInventoryType] = useState<'provincial' | 'nacional'>('provincial');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [nationalInventoryItems, setNationalInventoryItems] = useState<InventoryItem[]>([]);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    const saved = localStorage.getItem('teamMembers');
    if (saved) return JSON.parse(saved);
    return [
      { email: 'admin@chubut.gov.ar', role: 'Administrador', nombre: 'Admin', apellido: 'Central', password: 'admin' },
      { email: 'neelsoon64@gmail.com', role: 'Administrador', nombre: 'Nelson', apellido: '', password: 'Luna2187' }
    ];
  });

  const currentInventory = inventoryType === 'provincial' ? inventoryItems : nationalInventoryItems;
  const currentUserData = teamMembers.find(m => m.email.toLowerCase() === user?.email?.toLowerCase());
  const isAdmin = currentUserData?.role === 'Administrador' || user?.email === 'admin@chubut.gov.ar' || user?.email === 'neelsoon64@gmail.com';
  const userFullName = currentUserData ? `${currentUserData.nombre} ${currentUserData.apellido}`.trim() : (user?.displayName || user?.email || 'Usuario');

  const filteredInventory = currentInventory.filter(item => {
    const matchesSearch = item.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || item.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // --- Sincronización (Mantenida pero sin romper lo visual) ---
  const syncUserToFirestore = async (userAuth: User) => {
    try {
      const userRef = doc(db, 'users', userAuth.uid);
      const localData = teamMembers.find(m => m.email.toLowerCase() === userAuth.email?.toLowerCase());
      await setDoc(userRef, {
        uid: userAuth.uid,
        email: userAuth.email,
        nombre: localData?.nombre || userAuth.displayName || 'Usuario',
        apellido: localData?.apellido || '',
        role: localData?.role || 'Operario',
        lastLogin: new Date().toISOString()
      }, { merge: true });
    } catch (e) { console.error(e); }
  };

  const loadInventoryFromFirebase = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'inventory'));
      const items: InventoryItem[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      setInventoryItems(items);
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        syncUserToFirestore(u);
        loadInventoryFromFirebase();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const itemData = {
      nombre: formData.nombre,
      categoria: formData.categoria,
      cantidad: parseInt(formData.cantidad) || 0,
      ubicacion: formData.ubicacion,
      estado: formData.estado,
      fechaActualizacion: new Date().toISOString().split('T')[0],
      cargadoPor: userFullName,
      remito: formData.remito
    };

    try {
      if (editingItem) {
        await updateDoc(doc(db, 'inventory', editingItem.id), itemData);
      } else {
        await addDoc(collection(db, 'inventory'), itemData);
      }
      loadInventoryFromFirebase();
      setShowForm(false);
      setEditingItem(null);
      setFormData({ nombre: '', categoria: '', cantidad: '', ubicacion: '', estado: 'En Stock', remito: '' });
    } catch (e) { alert("Error al guardar"); }
    setLoginLoading(false);
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      nombre: item.nombre, categoria: item.categoria, cantidad: item.cantidad.toString(),
      ubicacion: item.ubicacion, estado: item.estado, remito: item.remito || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Eliminar item?')) {
      await deleteDoc(doc(db, 'inventory', id));
      loadInventoryFromFirebase();
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(currentInventory);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
    XLSX.writeFile(workbook, "Reporte_Inventario.xlsx");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-orange-600">CARGANDO...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm text-center">
          <img src="https://desarrollohumano.chubut.gov.ar/wp-content/uploads/2024/04/logochubut.png" className="w-32 mx-auto mb-6" alt="Chubut" />
          <h1 className="text-xl font-bold mb-6 text-slate-800 tracking-tight">Desarrollo Humano - Inventario</h1>
          <form onSubmit={(e) => { e.preventDefault(); loginWithEmailPassword(email, password).catch(() => setLoginError("Error")); }} className="space-y-4">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Institucional" className="w-full p-3 border rounded-xl" required />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" className="w-full p-3 border rounded-xl" required />
            <button type="submit" className="w-full bg-orange-600 text-white p-3 rounded-xl font-bold">Ingresar</button>
          </form>
          <button onClick={() => loginWithGoogle()} className="w-full mt-4 border p-3 rounded-xl flex justify-center gap-2 font-medium hover:bg-slate-50 transition">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/0/google.svg" width="18" alt="G" /> Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Original */}
      <div className="w-64 bg-slate-900 text-white p-6 fixed h-full shadow-xl">
        <div className="mb-10 text-center">
          <h2 className="text-xl font-black text-orange-500 uppercase tracking-tighter">Inventario App</h2>
          <p className="text-[10px] text-slate-400">Chubut - Desarrollo Humano</p>
        </div>
        <nav className="space-y-2">
          <button onClick={() => setActiveMenu('dashboard')} className={`w-full text-left p-3 rounded-xl transition ${activeMenu === 'dashboard' ? 'bg-orange-600' : 'hover:bg-slate-800'}`}>📊 Dashboard</button>
          <button onClick={() => setActiveMenu('inventario')} className={`w-full text-left p-3 rounded-xl transition ${activeMenu === 'inventario' ? 'bg-orange-600' : 'hover:bg-slate-800'}`}>📋 Inventario</button>
          <button onClick={() => setActiveMenu('reportes')} className={`w-full text-left p-3 rounded-xl transition ${activeMenu === 'reportes' ? 'bg-orange-600' : 'hover:bg-slate-800'}`}>📑 Reportes</button>
          {isAdmin && <button onClick={() => setActiveMenu('configuracion')} className={`w-full text-left p-3 rounded-xl transition ${activeMenu === 'configuracion' ? 'bg-orange-600' : 'hover:bg-slate-800'}`}>⚙️ Configuración</button>}
        </nav>
        <div className="absolute bottom-6 left-6 right-6">
          <p className="text-[10px] text-slate-400 truncate mb-2">{user.email}</p>
          <button onClick={() => logout()} className="w-full bg-red-500/10 text-red-500 p-2 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition uppercase">Cerrar Sesión</button>
        </div>
      </div>

      <div className="ml-64 p-8 w-full">
        <header className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">{activeMenu}</h1>
            <p className="text-slate-500 font-medium">Gestión de Stock - Subsecretaría de Trabajo</p>
          </div>
          <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
            <button onClick={() => setInventoryType('provincial')} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${inventoryType === 'provincial' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>PROVINCIAL</button>
            <button onClick={() => setInventoryType('nacional')} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${inventoryType === 'nacional' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>NACIONAL</button>
          </div>
        </header>

        {activeMenu === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border-b-4 border-orange-500">
                <p className="text-xs font-bold text-slate-400 uppercase">Artículos Totales</p>
                <p className="text-4xl font-black text-slate-800">{currentInventory.length}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border-b-4 border-red-500">
                <p className="text-xs font-bold text-slate-400 uppercase">Sin Stock</p>
                <p className="text-4xl font-black text-slate-800">{currentInventory.filter(i => i.estado === 'Sin Stock').length}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border-b-4 border-blue-500">
                <p className="text-xs font-bold text-slate-400 uppercase">Ubicaciones</p>
                <p className="text-4xl font-black text-slate-800">{new Set(currentInventory.map(i => i.ubicacion)).size}</p>
              </div>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={currentInventory.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="nombre" fontSize={10} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="#ea580c" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeMenu === 'inventario' && (
          <div className="bg-white rounded-3xl shadow-sm p-8">
            <div className="flex justify-between items-center mb-8 gap-4">
              <div className="flex flex-1 gap-4">
                <input type="text" placeholder="Buscar insumo..." className="p-3 border rounded-xl w-full max-w-md outline-orange-500" onChange={e => setSearchTerm(e.target.value)} />
                <select className="p-3 border rounded-xl bg-slate-50 text-xs font-bold" onChange={e => setSelectedCategory(e.target.value)}>
                  <option value="Todas">TODAS LAS CATEGORÍAS</option>
                  {Array.from(new Set(currentInventory.map(i => i.categoria))).map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                </select>
              </div>
              <button onClick={() => { setShowForm(!showForm); setEditingItem(null); }} className="bg-orange-600 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition">
                {showForm ? 'Cerrar' : '+ Nuevo Registro'}
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleSubmit} className="mb-10 p-6 bg-slate-50 rounded-3xl grid grid-cols-3 gap-4 border border-slate-200">
                <input type="text" placeholder="Producto" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="p-3 border rounded-xl" required />
                <input type="text" placeholder="Categoría" value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} className="p-3 border rounded-xl" required />
                <input type="number" placeholder="Cantidad" value={formData.cantidad} onChange={e => setFormData({...formData, cantidad: e.target.value})} className="p-3 border rounded-xl" required />
                <input type="text" placeholder="Ubicación" value={formData.ubicacion} onChange={e => setFormData({...formData, ubicacion: e.target.value})} className="p-3 border rounded-xl" required />
                <select value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value as any})} className="p-3 border rounded-xl">
                  <option value="En Stock">En Stock</option>
                  <option value="Sin Stock">Sin Stock</option>
                </select>
                <input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => setFormData({...formData, remito: reader.result as string});
                    reader.readAsDataURL(file);
                  }
                }} className="text-xs" />
                <button type="submit" className="col-span-3 bg-orange-600 text-white p-3 rounded-xl font-bold uppercase">{editingItem ? 'Actualizar' : 'Guardar'}</button>
              </form>
            )}

            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-[10px] uppercase font-black tracking-widest border-b">
                  <th className="px-6 py-4">Producto</th>
                  <th>Categoría</th>
                  <th>Cantidad</th>
                  <th>Ubicación</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInventory.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 font-bold text-slate-700">{item.nombre}</td>
                    <td className="text-slate-500 text-sm">{item.categoria}</td>
                    <td className="font-black">{item.cantidad}</td>
                    <td className="text-slate-500 text-sm">{item.ubicacion}</td>
                    <td><span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${item.estado === 'En Stock' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.estado}</span></td>
                    <td className="py-4">
                      <button onClick={() => handleEdit(item)} className="text-blue-500 mr-3">✏️</button>
                      <button onClick={() => handleDelete(item.id)} className="text-red-300">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeMenu === 'reportes' && (
          <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
            <h2 className="text-xl font-bold mb-6">Centro de Descargas</h2>
            <div className="flex justify-center gap-4">
              <button onClick={exportToExcel} className="bg-green-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-green-700 transition">Descargar Excel (.xlsx)</button>
              <button onClick={() => window.print()} className="bg-slate-800 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-900 transition">Imprimir Reporte PDF</button>
            </div>
          </div>
        )}

        {activeMenu === 'configuracion' && (
          <div className="bg-white rounded-3xl shadow-sm p-8">
            <h2 className="text-xl font-bold mb-6">Miembros del Equipo</h2>
            <div className="space-y-4">
              {teamMembers.map((m, i) => (
                <div key={i} className="flex justify-between p-4 border rounded-2xl bg-slate-50">
                  <div>
                    <p className="font-bold">{m.nombre} {m.apellido}</p>
                    <p className="text-xs text-slate-400">{m.email} - <span className="text-orange-600 font-bold">{m.role}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;