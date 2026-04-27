import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle, loginWithEmailPassword, logout } from './firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

interface InventoryItem {
  id: string;
  nombre: string;
  categoria: string;
  cantidad: number;
  ubicacion: string;
  estado: 'En Stock' | 'Sin Stock';
  fechaActualizacion: string;
  remito?: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'inventario' | 'reportes' | 'configuracion'>('dashboard');
  const [inventoryType, setInventoryType] = useState<'provincial' | 'nacional'>('provincial');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const [formData, setFormData] = useState({
    nombre: '', categoria: '', cantidad: '', ubicacion: '', estado: 'En Stock' as 'En Stock' | 'Sin Stock', remito: ''
  });

  const loadData = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'inventory'));
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventoryItems(items);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) loadData();
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...formData, cantidad: Number(formData.cantidad), fechaActualizacion: new Date().toISOString().split('T')[0] };
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'inventory', editingItem.id), data);
      } else {
        await addDoc(collection(db, 'inventory'), data);
      }
      loadData();
      setShowForm(false);
      setEditingItem(null);
      setFormData({ nombre: '', categoria: '', cantidad: '', ubicacion: '', estado: 'En Stock', remito: '' });
    } catch (e) { alert("Error al guardar"); }
  };

  const filteredItems = inventoryItems.filter(i => 
    i.nombre.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedCategory === 'Todas' || i.categoria === selectedCategory)
  );

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-orange-600">INICIANDO SISTEMA...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm text-center">
          <img src="https://desarrollohumano.chubut.gov.ar/wp-content/uploads/2024/04/logochubut.png" className="w-32 mx-auto mb-6" alt="Chubut" />
          <h1 className="text-xl font-bold mb-6 text-slate-800">Desarrollo Humano - Inventario</h1>
          <form onSubmit={(e) => { e.preventDefault(); loginWithEmailPassword(email, password); }} className="space-y-4">
            <input type="email" placeholder="Email Institucional" className="w-full p-3 border rounded-xl" onChange={e => setEmail(e.target.value)} />
            <input type="password" placeholder="Contraseña" className="w-full p-3 border rounded-xl" onChange={e => setPassword(e.target.value)} />
            <button className="w-full bg-orange-600 text-white p-3 rounded-xl font-bold">Ingresar</button>
          </form>
          <button onClick={loginWithGoogle} className="w-full mt-4 border p-3 rounded-xl flex justify-center gap-2 font-medium">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/0/google.svg" width="18" alt="G" /> Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Oscuro - Restaurado */}
      <div className="w-64 bg-slate-900 text-white p-6 fixed h-full shadow-2xl">
        <div className="mb-10 text-center">
          <h2 className="text-xl font-black text-orange-500 uppercase tracking-tighter">Inventario App</h2>
          <p className="text-[10px] text-slate-400">Desarrollo Humano - Chubut</p>
        </div>
        <nav className="space-y-2">
          <button onClick={() => setActiveMenu('dashboard')} className={`w-full text-left p-3 rounded-xl transition ${activeMenu === 'dashboard' ? 'bg-orange-600' : 'hover:bg-slate-800'}`}>📊 Panel General</button>
          <button onClick={() => setActiveMenu('inventario')} className={`w-full text-left p-3 rounded-xl transition ${activeMenu === 'inventario' ? 'bg-orange-600' : 'hover:bg-slate-800'}`}>📋 Gestión Stock</button>
          <button onClick={() => setActiveMenu('reportes')} className={`w-full text-left p-3 rounded-xl transition ${activeMenu === 'reportes' ? 'bg-orange-600' : 'hover:bg-slate-800'}`}>📑 Reportes</button>
          <button onClick={() => setActiveMenu('configuracion')} className={`w-full text-left p-3 rounded-xl transition ${activeMenu === 'configuracion' ? 'bg-orange-600' : 'hover:bg-slate-800'}`}>⚙️ Configuración</button>
        </nav>
        <div className="absolute bottom-6 left-6 right-6">
          <button onClick={logout} className="w-full bg-red-500/10 text-red-500 p-2 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition uppercase">Cerrar Sesión</button>
        </div>
      </div>

      <div className="ml-64 p-10 w-full">
        <header className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-black uppercase text-slate-800 tracking-tight">{activeMenu}</h1>
            <p className="text-slate-500 font-medium">Ministerio de Desarrollo Humano - Chubut</p>
          </div>
          {/* Switch de Inventario - Restaurado */}
          <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
            <button onClick={() => setInventoryType('provincial')} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${inventoryType === 'provincial' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}>PROVINCIAL</button>
            <button onClick={() => setInventoryType('nacional')} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${inventoryType === 'nacional' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}>NACIONAL</button>
          </div>
        </header>

        {activeMenu === 'inventario' && (
          <div className="bg-white rounded-3xl p-8 shadow-sm">
            <div className="flex gap-4 mb-8">
              <input type="text" placeholder="Buscar insumo..." className="p-3 border rounded-xl flex-1 outline-orange-500" onChange={e => setSearchTerm(e.target.value)} />
              <button onClick={() => { setShowForm(!showForm); setEditingItem(null); }} className="bg-orange-600 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition">
                {showForm ? 'Cerrar' : '+ Nuevo Insumo'}
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4 mb-8 p-6 bg-slate-50 rounded-3xl border border-slate-200">
                <input type="text" placeholder="Insumo" value={formData.nombre} className="p-3 border rounded-xl bg-white" onChange={e => setFormData({...formData, nombre: e.target.value})} required />
                <input type="text" placeholder="Categoría" value={formData.categoria} className="p-3 border rounded-xl bg-white" onChange={e => setFormData({...formData, categoria: e.target.value})} required />
                <input type="number" placeholder="Cantidad" value={formData.cantidad} className="p-3 border rounded-xl bg-white" onChange={e => setFormData({...formData, cantidad: e.target.value})} required />
                <button type="submit" className="col-span-3 bg-orange-600 text-white p-3 rounded-xl font-bold uppercase tracking-widest hover:bg-orange-700 transition">Guardar Registro</button>
              </form>
            )}

            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <th className="py-4 px-4">Insumo</th>
                  <th>Categoría</th>
                  <th>Cant.</th>
                  <th>Estado</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="py-4 px-4 font-bold text-slate-700">{item.nombre}</td>
                    <td className="text-slate-500 text-sm">{item.categoria}</td>
                    <td className="font-black text-slate-800">{item.cantidad}</td>
                    <td><span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${item.estado === 'En Stock' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.estado}</span></td>
                    <td className="text-center">
                      <button onClick={() => { setEditingItem(item); setFormData(item as any); setShowForm(true); }} className="text-blue-500 hover:text-blue-700 px-2 transition">✏️</button>
                      <button onClick={async () => { if(window.confirm('¿Eliminar registro?')) { await deleteDoc(doc(db, 'inventory', item.id)); loadData(); } }} className="text-slate-300 hover:text-red-500 px-2 transition">🗑️</button>
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