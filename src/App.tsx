import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle, loginWithEmailPassword, logout } from './firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
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

  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'inventario' | 'configuracion'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  
  const [teamMembers] = useState<TeamMember[]>(() => {
    const saved = localStorage.getItem('teamMembers');
    if (saved) return JSON.parse(saved);
    return [
      { email: 'admin@chubut.gov.ar', role: 'Administrador', nombre: 'Admin', apellido: 'Central', password: 'admin' },
      { email: 'neelsoon64@gmail.com', role: 'Administrador', nombre: 'Nelson', apellido: '', password: 'Luna2187' }
    ];
  });

  const currentUserData = teamMembers.find(m => m.email.toLowerCase() === user?.email?.toLowerCase());
  const isAdmin = currentUserData?.role === 'Administrador' || user?.email === 'admin@chubut.gov.ar' || user?.email === 'neelsoon64@gmail.com';
  const userFullName = currentUserData ? `${currentUserData.nombre} ${currentUserData.apellido}`.trim() : (user?.displayName || user?.email || 'Usuario');

  // --- FUNCIÓN DE SINCRONIZACIÓN ---
  const syncUserToFirestore = async (userAuth: User) => {
    try {
      const userRef = doc(db, 'users', userAuth.uid);
      const localData = teamMembers.find(m => m.email.toLowerCase() === userAuth.email?.toLowerCase());
      const userData = {
        uid: userAuth.uid,
        email: userAuth.email,
        nombre: localData?.nombre || userAuth.displayName || 'Usuario',
        apellido: localData?.apellido || '',
        role: localData?.role || 'Operario',
        lastLogin: new Date().toISOString()
      };
      await setDoc(userRef, userData, { merge: true });
      console.log("Usuario sincronizado correctamente");
    } catch (e) { console.error("Error en sync:", e); }
  };

  const loadInventory = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'inventory'));
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventoryItems(items);
    } catch (e) { console.error("Error cargando inventario:", e); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await syncUserToFirestore(u);
        await loadInventory();
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
      await loadInventory();
      setShowForm(false);
      setEditingItem(null);
      setFormData({ nombre: '', categoria: '', cantidad: '', ubicacion: '', estado: 'En Stock', remito: '' });
      alert("¡Datos guardados correctamente!");
    } catch (e) { alert("Error al guardar en la base de datos"); }
    setLoginLoading(false);
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

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este insumo?')) {
      await deleteDoc(doc(db, 'inventory', id));
      await loadInventory();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setFormData({ ...formData, remito: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-orange-600">INICIANDO SISTEMA...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm text-center">
          <img src="https://desarrollohumano.chubut.gov.ar/wp-content/uploads/2024/04/logochubut.png" className="w-32 mx-auto mb-6" alt="Chubut" />
          <h1 className="text-xl font-bold mb-6 text-slate-800">Inventario Subsecretaría</h1>
          <form onSubmit={(e) => { e.preventDefault(); loginWithEmailPassword(email, password).catch(() => setLoginError("Error de acceso")); }} className="space-y-4">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full p-3 border rounded-xl" required />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" className="w-full p-3 border rounded-xl" required />
            {loginError && <p className="text-red-500 text-xs font-bold">{loginError}</p>}
            <button type="submit" className="w-full bg-orange-600 text-white p-3 rounded-xl font-bold hover:bg-orange-700">Ingresar</button>
          </form>
          <button onClick={() => loginWithGoogle()} className="w-full mt-4 border p-3 rounded-xl flex justify-center items-center gap-2 font-medium hover:bg-slate-50 transition">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/0/google.svg" width="18" alt="G" /> Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-white p-6 fixed h-full">
        <div className="mb-10">
          <h2 className="text-xl font-bold text-orange-500 uppercase tracking-tighter">Control Stock</h2>
          <p className="text-[10px] text-slate-400">Secretaría de Trabajo Chubut</p>
        </div>
        <nav className="space-y-2">
          <button onClick={() => setActiveMenu('dashboard')} className={`w-full text-left p-3 rounded-xl ${activeMenu === 'dashboard' ? 'bg-orange-600 shadow-lg' : 'hover:bg-slate-800'}`}>📊 Dashboard</button>
          <button onClick={() => setActiveMenu('inventario')} className={`w-full text-left p-3 rounded-xl ${activeMenu === 'inventario' ? 'bg-orange-600 shadow-lg' : 'hover:bg-slate-800'}`}>📋 Inventario</button>
          {isAdmin && <button onClick={() => setActiveMenu('configuracion')} className={`w-full text-left p-3 rounded-xl ${activeMenu === 'configuracion' ? 'bg-orange-600 shadow-lg' : 'hover:bg-slate-800'}`}>⚙️ Configuración</button>}
        </nav>
        <div className="absolute bottom-6 left-6 right-6 border-t border-slate-700 pt-4">
          <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
          <button onClick={() => logout()} className="text-red-400 text-sm font-bold mt-2 hover:text-red-300">Cerrar Sesión</button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-10 w-full">
        {activeMenu === 'dashboard' ? (
          <div>
            <div className="grid grid-cols-3 gap-6 mb-10">
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-orange-500">
                <p className="text-xs font-bold text-slate-400 uppercase">Artículos en Sistema</p>
                <p className="text-4xl font-black">{inventoryItems.length}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-red-500">
                <p className="text-xs font-bold text-slate-400 uppercase">Sin Stock Crítico</p>
                <p className="text-4xl font-black">{inventoryItems.filter(i => i.estado === 'Sin Stock').length}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-blue-500">
                <p className="text-xs font-bold text-slate-400 uppercase">Ubicaciones</p>
                <p className="text-4xl font-black">{new Set(inventoryItems.map(i => i.ubicacion)).size}</p>
              </div>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryItems.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="nombre" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="#ea580c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : activeMenu === 'inventario' ? (
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <div className="flex justify-between items-center mb-8">
              <input type="text" placeholder="Buscar insumo..." className="p-3 border rounded-xl w-80 outline-orange-500" onChange={e => setSearchTerm(e.target.value)} />
              <button onClick={() => { setShowForm(!showForm); setEditingItem(null); setFormData({nombre:'',categoria:'',cantidad:'',ubicacion:'',estado:'En Stock',remito:''}); }} className="bg-orange-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-orange-700 transition">
                {showForm ? 'Cerrar' : '+ Nuevo Registro'}
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleSubmit} className="mb-10 p-6 bg-orange-50 rounded-2xl border border-orange-100 grid grid-cols-3 gap-4">
                <input type="text" placeholder="Producto" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="p-3 border rounded-xl bg-white" required />
                <input type="text" placeholder="Categoría" value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} className="p-3 border rounded-xl bg-white" required />
                <input type="number" placeholder="Cantidad" value={formData.cantidad} onChange={e => setFormData({...formData, cantidad: e.target.value})} className="p-3 border rounded-xl bg-white" required />
                <input type="text" placeholder="Ubicación" value={formData.ubicacion} onChange={e => setFormData({...formData, ubicacion: e.target.value})} className="p-3 border rounded-xl bg-white" required />
                <select value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value as any})} className="p-3 border rounded-xl bg-white">
                  <option value="En Stock">En Stock</option>
                  <option value="Sin Stock">Sin Stock</option>
                </select>
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-400 mb-1">Cargar Remito (Imagen)</label>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="text-xs" />
                </div>
                <button type="submit" className="col-span-3 bg-orange-600 text-white p-3 rounded-xl font-bold uppercase tracking-wider hover:bg-orange-700">
                  {editingItem ? 'Actualizar Datos' : 'Guardar en Base de Datos'}
                </button>
              </form>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Producto</th>
                    <th>Categoría</th>
                    <th>Cant.</th>
                    <th>Ubicación</th>
                    <th>Estado</th>
                    <th>Remito</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventoryItems.filter(i => i.nombre.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-bold text-slate-700">{item.nombre}</td>
                      <td className="text-slate-500">{item.categoria}</td>
                      <td className="font-black text-slate-800">{item.cantidad}</td>
                      <td className="text-slate-500">{item.ubicacion}</td>
                      <td>
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${item.estado === 'En Stock' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.estado}</span>
                      </td>
                      <td>
                        {item.remito ? <button onClick={() => window.open(item.remito)} className="text-blue-500 text-xs underline font-bold">Ver</button> : <span className="text-slate-300 text-xs">-</span>}
                      </td>
                      <td className="text-center">
                        <button onClick={() => handleEdit(item)} className="text-blue-400 hover:text-blue-600 px-2 transition">✏️</button>
                        <button onClick={() => handleDelete(item.id)} className="text-slate-300 hover:text-red-500 px-2 transition">🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <h2 className="text-xl font-bold mb-6 text-slate-800">Personal de la Subsecretaría</h2>
            <div className="grid gap-4">
              {teamMembers.map((m, idx) => (
                <div key={idx} className="flex justify-between items-center p-4 border rounded-2xl bg-slate-50">
                  <div>
                    <p className="font-bold text-slate-700">{m.nombre} {m.apellido}</p>
                    <p className="text-xs text-slate-500">{m.email} — <span className="text-orange-600 font-bold uppercase">{m.role}</span></p>
                  </div>
                  <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">Activo</span>
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