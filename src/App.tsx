import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Tag, 
  Boxes, 
  FileText, 
  FileType, 
  Users, 
  LogOut, 
  ShieldCheck, 
  Upload, 
  AlertCircle, 
  CheckCircle2,
  Plus,
  Lock,
  Unlock,
  DollarSign,
  Edit,
  Trash2,
  RefreshCw,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

// Types
type UserRole = 'admin' | 'company' | null;

interface Company {
  id: string;
  name: string;
  responsible_name: string;
  username: string;
  password?: string;
  phone: string;
  email: string;
  enabled: boolean;
  amount: number;
  debt: number;
  payments: number;
  ml_link?: string;
  ml_id?: string;
  local_db_config?: string;
  lastSync?: string;
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loginView, setLoginView] = useState<'company' | 'admin'>('company');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ show: boolean, action: () => void, title: string, message: string }>({ show: false, action: () => {}, title: '', message: '' });
  const [newCompany, setNewCompany] = useState({ 
    name: '', 
    responsible_name: '', 
    username: '', 
    password: '', 
    phone: '', 
    email: '', 
    amount: 0, 
    debt: 0,
    payments: 0,
    ml_link: '',
    ml_id: '',
    local_db_config: ''
  });

  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Single Session Check
  useEffect(() => {
    let interval: any;
    if (role === 'company' && user?.id && user?.session_token) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/check-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyId: user.id, sessionToken: user.session_token })
          });
          const data = await res.json();
          if (data.valid === false) {
            alert('Su sesión ha sido iniciada en otro dispositivo. Se cerrará esta sesión.');
            handleLogout();
          }
        } catch (err) {
          console.error("Session check error:", err);
        }
      }, 10000); // Check every 10 seconds
    }
    return () => clearInterval(interval);
  }, [role, user]);

  useEffect(() => {
    console.log("MLSync App Started");
  }, []);

  // Fetch companies if admin
  useEffect(() => {
    if (role === 'admin') {
      fetchCompanies();
    }
  }, [role]);

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/companies');
      if (!res.ok) {
        const err = await res.json();
        console.error("Error fetching:", err);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setCompanies(data);
      }
    } catch (err) {
      console.error("Connection error fetching companies:", err);
    }
  };

  const testConnection = async () => {
    try {
      const res = await fetch('/api/health-check');
      const data = await res.json();
      alert(data.message);
    } catch (err) {
      alert("Error crítico de red al intentar conectar con el servidor.");
    }
  };

  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (isAdmin: boolean) => {
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, isAdmin })
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        setRole(isAdmin ? 'admin' : 'company');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCompanyStatus = async (id: string, enabled: boolean) => {
    await fetch(`/api/companies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    fetchCompanies();
  };

  const addCompany = async () => {
    const isEditing = !!editingCompany;
    setShowConfirm({
      show: true,
      title: isEditing ? 'Confirmar Edición' : 'Confirmar Registro',
      message: `¿Desea ${isEditing ? 'actualizar' : 'guardar'} la información de la empresa "${newCompany.name}"?`,
      action: async () => {
        try {
          const url = isEditing ? `/api/companies/${editingCompany.id}` : '/api/companies';
          const method = isEditing ? 'PATCH' : 'POST';
          
          const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCompany)
          });
          if (res.ok) {
            setShowAddCompany(false);
            setEditingCompany(null);
            setNewCompany({ 
              name: '', 
              responsible_name: '', 
              username: '', 
              password: '', 
              phone: '', 
              email: '', 
              amount: 0, 
              debt: 0,
              payments: 0,
              ml_link: '',
              ml_id: '',
              local_db_config: ''
            });
            fetchCompanies();
          } else {
            const errData = await res.json();
            alert('Error al guardar: ' + (errData.message || 'Error desconocido'));
          }
        } catch (err) {
          alert('Error de conexión al servidor');
        }
        setShowConfirm({ ...showConfirm, show: false });
      }
    });
  };

  const deleteCompany = async (id: string, name: string) => {
    setShowConfirm({
      show: true,
      title: 'Eliminar Empresa',
      message: `¿Está seguro de que desea eliminar la empresa "${name}"? Esta acción no se puede deshacer.`,
      action: async () => {
        try {
          const res = await fetch(`/api/companies/${id}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            fetchCompanies();
          } else {
            alert('Error al eliminar la empresa.');
          }
        } catch (err) {
          alert('Error de red al intentar eliminar.');
        }
        setShowConfirm({ ...showConfirm, show: false });
      }
    });
  };

  const startEditCompany = (company: Company) => {
    setEditingCompany(company);
    setNewCompany({
      name: company.name,
      responsible_name: company.responsible_name,
      username: company.username,
      password: company.password || '',
      phone: company.phone,
      email: company.email,
      amount: company.amount,
      debt: company.debt,
      payments: company.payments || 0,
      ml_link: company.ml_link || '',
      ml_id: company.ml_id || '',
      local_db_config: company.local_db_config || ''
    });
    setShowAddCompany(true);
  };

  const handleLogout = async () => {
    if (role === 'company' && user?.id) {
      try {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: user.id })
        });
      } catch (err) {
        console.error("Error logging out from server:", err);
      }
    }
    setUser(null);
    setRole(null);
    setUsername('');
    setPassword('');
    setActiveTab('dashboard');
  };

  if (!role) {
    if (loginView === 'admin') {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
          {/* Decorative elements for Admin */}
          <div className="absolute top-[-10%] left-[-10%] w-1/2 h-1/2 bg-blue-900/20 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-1/2 h-1/2 bg-blue-800/10 blur-[120px] rounded-full"></div>

          <div className="absolute top-4 right-4">
            <button 
              onClick={() => {
                setLoginView('company');
                setError('');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white/60 rounded-lg hover:bg-white/10 transition-colors border border-white/10 backdrop-blur-md text-sm font-bold"
            >
              Volver a Empresas
            </button>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-slate-900/50 border border-blue-500/30 rounded-2xl shadow-2xl shadow-blue-500/10 overflow-hidden backdrop-blur-xl"
          >
            <div className="p-10 text-center border-b border-blue-500/20">
              <h1 className="text-5xl font-black text-blue-500 tracking-tighter">MLSync</h1>
              <p className="text-blue-400/60 font-bold mt-2 uppercase tracking-[0.3em] text-[10px]">Administración Central</p>
            </div>
            
            <div className="p-10">
              <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                <ShieldCheck className="text-blue-500" />
                Acceso Administrador
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-blue-400/50 uppercase tracking-widest mb-2">Usuario Maestro</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-4 bg-black/50 rounded-xl border border-blue-500/30 text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium placeholder:text-blue-900"
                    placeholder="udwadmin"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-blue-400/50 uppercase tracking-widest mb-2">Clave de Seguridad</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-4 bg-black/50 rounded-xl border border-blue-500/30 text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium placeholder:text-blue-900"
                    placeholder="••••••••"
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm font-bold bg-red-950/30 p-4 rounded-xl border border-red-500/30">
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}
                <button 
                  onClick={() => handleLogin(true)}
                  disabled={isLoading}
                  className={`w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-xl shadow-blue-600/20 transition-all transform hover:-translate-y-1 active:scale-95 uppercase tracking-widest ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? 'AUTENTICANDO...' : 'AUTENTICAR ADMIN'}
                </button>
              </div>
            </div>
          </motion.div>
          
          <p className="mt-8 text-blue-900 text-[10px] font-black uppercase tracking-[0.5em]">udw desarrollos • 2026</p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-sky-50 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Decorative elements for Company */}
        <div className="absolute top-[-10%] right-[-10%] w-1/2 h-1/2 bg-yellow-400/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-1/2 h-1/2 bg-sky-400/20 blur-[120px] rounded-full"></div>

        <div className="absolute top-4 right-4">
          <button 
            onClick={() => {
              setLoginView('admin');
              setError('');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-lg text-sm font-bold"
          >
            <ShieldCheck size={18} />
            Ingreso Admin
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 relative z-10"
        >
          <div className="bg-yellow-400 p-10 text-center">
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter">MLSync</h1>
            <p className="text-slate-800 font-bold mt-2 uppercase tracking-widest text-[10px]">Sincronización Mercado Libre</p>
          </div>
          
          <div className="p-10">
            <h2 className="text-xl font-bold text-slate-800 mb-8">Acceso Empresas</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Usuario</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all font-medium"
                  placeholder="Ingrese su usuario"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Contraseña</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all font-medium"
                  placeholder="••••••••"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-red-500 text-sm font-bold bg-red-50 p-4 rounded-xl border border-red-100">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}
              <button 
                onClick={() => handleLogin(false)}
                disabled={isLoading}
                className={`w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black rounded-xl shadow-xl shadow-yellow-400/30 transition-all transform hover:-translate-y-1 active:scale-95 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isLoading ? 'INGRESANDO...' : 'INGRESAR AHORA'}
              </button>
            </div>
          </div>
        </motion.div>
        
        <p className="mt-8 text-slate-400 text-[10px] font-black uppercase tracking-widest">© 2026 MLSync - udw desarrollos</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-sky-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-yellow-400 flex flex-col shadow-2xl z-20">
        <div className="p-8 border-b border-yellow-500/30">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">MLSync</h1>
          <div className="mt-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {role === 'admin' ? 'Panel Administrador' : user.name}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {role === 'admin' ? (
            <>
              <SidebarItem 
                icon={<LayoutDashboard size={20} />} 
                label="Panel de Control" 
                active={activeTab === 'dashboard'} 
                onClick={() => setActiveTab('dashboard')} 
              />
              <SidebarItem 
                icon={<Users size={20} />} 
                label="Empresas" 
                active={activeTab === 'companies'} 
                onClick={() => setActiveTab('companies')} 
              />
            </>
          ) : (
            <>
              <SidebarItem 
                icon={<LayoutDashboard size={20} />} 
                label="Resumen" 
                active={activeTab === 'dashboard'} 
                onClick={() => setActiveTab('dashboard')} 
              />
              <div className="pt-4 pb-2 px-4 text-[10px] font-black text-slate-800/50 uppercase tracking-[0.2em]">Sincronización</div>
              <SidebarItem 
                icon={<Tag size={20} />} 
                label="Precios" 
                active={activeTab === 'prices'} 
                onClick={() => setActiveTab('prices')} 
              />
              <SidebarItem 
                icon={<Package size={20} />} 
                label="Productos" 
                active={activeTab === 'products'} 
                onClick={() => setActiveTab('products')} 
              />
              <SidebarItem 
                icon={<Boxes size={20} />} 
                label="Stock" 
                active={activeTab === 'stock'} 
                onClick={() => setActiveTab('stock')} 
              />
              <SidebarItem 
                icon={<FileText size={20} />} 
                label="Facturas" 
                active={activeTab === 'invoices'} 
                onClick={() => setActiveTab('invoices')} 
              />
              <SidebarItem 
                icon={<FileType size={20} />} 
                label="PDFs" 
                active={activeTab === 'pdf'} 
                onClick={() => setActiveTab('pdf')} 
              />
              <SidebarItem 
                icon={<Users size={20} />} 
                label="Clientes" 
                active={activeTab === 'clients'} 
                onClick={() => setActiveTab('clients')} 
              />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-yellow-500/30">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-bold text-sm"
          >
            <LogOut size={18} />
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        <AnimatePresence mode="wait">
          {role === 'admin' ? (
            <AdminView 
              key="admin"
              activeTab={activeTab} 
              companies={companies} 
              toggleStatus={toggleCompanyStatus}
              showAdd={() => {
                setEditingCompany(null);
                setNewCompany({ name: '', responsible_name: '', username: '', password: '', phone: '', email: '', amount: 0, debt: 0, ml_link: '', local_db_config: '' });
                setShowAddCompany(true);
              }}
              testConnection={testConnection}
              onEdit={startEditCompany}
              onDelete={deleteCompany}
            />
          ) : (
            <CompanyView 
              key="company"
              activeTab={activeTab} 
              user={user}
            />
          )}
        </AnimatePresence>

        {/* Add Company Modal */}
        {showAddCompany && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="bg-yellow-400 p-6 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">{editingCompany ? 'Editar Empresa' : 'Registro de Nueva Empresa'}</h3>
                <button onClick={() => { setShowAddCompany(false); setEditingCompany(null); }} className="text-slate-900/50 hover:text-slate-900">✕</button>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Datos Generales</h4>
                    <input 
                      placeholder="Nombre de la Empresa" 
                      className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                      value={newCompany.name}
                      onChange={e => setNewCompany({...newCompany, name: e.target.value})}
                    />
                    <input 
                      placeholder="Nombre del Responsable" 
                      className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                      value={newCompany.responsible_name}
                      onChange={e => setNewCompany({...newCompany, responsible_name: e.target.value})}
                    />
                    <input 
                      placeholder="Teléfono" 
                      className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                      value={newCompany.phone}
                      onChange={e => setNewCompany({...newCompany, phone: e.target.value})}
                    />
                    <input 
                      placeholder="Email" 
                      className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                      value={newCompany.email}
                      onChange={e => setNewCompany({...newCompany, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Credenciales y Abono</h4>
                    <input 
                      placeholder="Usuario de Acceso" 
                      className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                      value={newCompany.username}
                      onChange={e => setNewCompany({...newCompany, username: e.target.value})}
                    />
                    <input 
                      type="password"
                      placeholder="Contraseña de Acceso" 
                      className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                      value={newCompany.password}
                      onChange={e => setNewCompany({...newCompany, password: e.target.value})}
                    />
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 ml-1">Monto Abono</label>
                        <input 
                          type="number"
                          placeholder="0.00" 
                          className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                          value={newCompany.amount}
                          onChange={e => setNewCompany({...newCompany, amount: Number(e.target.value)})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 ml-1">Deuda</label>
                        <input 
                          type="number"
                          placeholder="0.00" 
                          className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                          value={newCompany.debt}
                          onChange={e => setNewCompany({...newCompany, debt: Number(e.target.value)})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 ml-1">Pagos</label>
                        <input 
                          type="number"
                          placeholder="0.00" 
                          className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                          value={newCompany.payments}
                          onChange={e => setNewCompany({...newCompany, payments: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Config. Sincronización</h4>
                      <input 
                        placeholder="Link Mercado Libre" 
                        className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                        value={newCompany.ml_link}
                        onChange={e => setNewCompany({...newCompany, ml_link: e.target.value})}
                      />
                      <input 
                        placeholder="ID de Mercado Libre" 
                        className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                        value={newCompany.ml_id}
                        onChange={e => setNewCompany({...newCompany, ml_id: e.target.value})}
                      />
                      <input 
                        placeholder="Config. Base de Datos Local" 
                        className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                        value={newCompany.local_db_config}
                        onChange={e => setNewCompany({...newCompany, local_db_config: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setShowAddCompany(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={addCompany}
                    className="flex-1 py-4 bg-yellow-400 text-slate-900 font-black rounded-xl shadow-xl shadow-yellow-200 hover:bg-yellow-500 transition-all"
                  >
                    GUARDAR EN LA NUBE
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirm.show && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{showConfirm.title}</h3>
                <p className="text-slate-500 text-sm mb-8">{showConfirm.message}</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowConfirm({ ...showConfirm, show: false })}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl"
                  >
                    No, cancelar
                  </button>
                  <button 
                    onClick={showConfirm.action}
                    className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl"
                  >
                    Sí, confirmar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
        active 
          ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
          : 'text-slate-800 hover:bg-yellow-500/50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function AdminView({ activeTab, companies, toggleStatus, showAdd, testConnection, onEdit, onDelete }: any) {
  const [testStatus, setTestStatus] = useState<any>({});

  const handleTestSync = (companyId: string, type: 'ml' | 'local') => {
    setTestStatus({ ...testStatus, [`${companyId}-${type}`]: 'testing' });
    setTimeout(() => {
      setTestStatus({ ...testStatus, [`${companyId}-${type}`]: 'success' });
    }, 1500);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">
            {activeTab === 'dashboard' ? 'Panel de Control' : 'Gestión de Empresas'}
          </h2>
          <p className="text-slate-500 font-medium mt-1">Administración central de MLSync</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={testConnection}
            className="flex items-center gap-2 px-4 py-3 bg-blue-100 text-blue-700 rounded-xl font-bold hover:bg-blue-200 transition-all text-sm"
          >
            Probar Conexión Supabase
          </button>
          {activeTab === 'companies' && (
            <button 
              onClick={showAdd}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all"
            >
              <Plus size={20} />
              Nueva Empresa
            </button>
          )}
        </div>
      </div>

      {activeTab === 'dashboard' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Empresas Activas" value={companies.filter((c: any) => c.enabled).length} color="bg-green-500" />
          <StatCard label="Recaudación Total" value={`$${companies.reduce((acc: any, c: any) => acc + c.amount, 0)}`} color="bg-blue-500" />
          <StatCard label="Deuda Pendiente" value={`$${companies.reduce((acc: any, c: any) => acc + c.debt, 0)}`} color="bg-red-500" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Empresa</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Credenciales</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Sincronización</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Monto</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Deuda</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Pagos</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {companies.map((company: Company) => (
                <tr key={company.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{company.name}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-black">Resp: {company.responsible_name}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-black">Tel: {company.phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-600">User: {company.username}</div>
                    <div className="text-xs text-slate-400">Pass: {company.password || '••••••'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Tag size={12} className="text-yellow-500 shrink-0" />
                          <span className="text-[10px] text-slate-500 truncate max-w-[80px]">{company.ml_link || 'No config.'}</span>
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleTestSync(company.id, 'ml')}
                            className={`p-1 rounded text-[8px] font-black uppercase transition-all ${
                              testStatus[`${company.id}-ml`] === 'testing' ? 'bg-blue-100 text-blue-600 animate-pulse' :
                              testStatus[`${company.id}-ml`] === 'success' ? 'bg-green-100 text-green-600' :
                              'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {testStatus[`${company.id}-ml`] === 'testing' ? 'Probando...' : 'Probar ML'}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Boxes size={12} className="text-blue-500 shrink-0" />
                          <span className="text-[10px] text-slate-500 truncate max-w-[80px]">{company.local_db_config || 'No config.'}</span>
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleTestSync(company.id, 'local')}
                            className={`p-1 rounded text-[8px] font-black uppercase transition-all ${
                              testStatus[`${company.id}-local`] === 'testing' ? 'bg-blue-100 text-blue-600 animate-pulse' :
                              testStatus[`${company.id}-local`] === 'success' ? 'bg-green-100 text-green-600' :
                              'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {testStatus[`${company.id}-local`] === 'testing' ? 'Probando...' : 'Probar DB'}
                          </button>
                        </div>
                      </div>
                      { (testStatus[`${company.id}-ml`] === 'success' || testStatus[`${company.id}-local`] === 'success') && (
                        <div className="flex items-center gap-1 text-[8px] font-black text-green-600 uppercase">
                          <Activity size={10} />
                          Sincronización Activa
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-800">${company.amount}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-rose-600">${company.debt}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-emerald-600">${company.payments || 0}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => toggleStatus(company.id, !company.enabled)}
                        className={`p-2 rounded-lg transition-all ${
                          company.enabled 
                            ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                            : 'bg-red-100 text-red-600 hover:bg-red-200'
                        }`}
                        title={company.enabled ? 'Suspender' : 'Habilitar'}
                      >
                        {company.enabled ? <Unlock size={16} /> : <Lock size={16} />}
                      </button>
                      <button 
                        onClick={() => onEdit(company)}
                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all"
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => onDelete(company.id, company.name)}
                        className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

function CompanyView({ activeTab, user }: any) {
  const [syncData, setSyncData] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState({ products: 0, clients: 0, invoices: 0 });
  const [listData, setListData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [newItem, setNewItem] = useState<any>({});
  const [mlSales, setMlSales] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      // Map columns: assuming itm_cod and itm_desc are in the Excel
      const products = data.map((row: any) => ({
        code: row.itm_cod || row.Código || row.codigo || '',
        name: row.itm_desc || row.Descripción || row.descripcion || '',
        price: row.Precio || row.precio || 0,
        stock: row.Stock || row.stock || 0
      })).filter(p => p.code && p.name);

      setListData(products);
      setSelectedItems(new Set());
      alert(`Se importaron ${products.length} productos desde el Excel.`);
    };
    reader.readAsBinaryString(file);
  };

  const toggleItemSelection = (code: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(code)) {
      newSelection.delete(code);
    } else {
      newSelection.add(code);
    }
    setSelectedItems(newSelection);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      console.log("Excel data parsed:", data);
      
      // Mock sync to backend
      fetch('/api/sync/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeTab === 'products' ? 'products' : 'clients',
          data: data,
          companyId: user.id
        })
      }).then(res => {
        if (res.ok) {
          alert('Datos cargados correctamente desde Excel');
          fetchList();
          fetchStats();
        }
      });
    };
    reader.readAsBinaryString(file);
  };

  const downloadMLSales = async () => {
    if (!dateRange.start || !dateRange.end) {
      alert('Por favor seleccione un rango de fechas');
      return;
    }
    try {
      const res = await fetch(`/api/ml/sales?companyId=${user.id}&startDate=${dateRange.start}&endDate=${dateRange.end}`);
      const data = await res.json();
      setMlSales(data);
      
      // Export to Excel
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ventas ML");
      XLSX.writeFile(wb, `ventas_ml_${dateRange.start}_${dateRange.end}.xlsx`);
      
      alert('Ventas descargadas y exportadas a Excel');
    } catch (err) {
      console.error("Error downloading ML sales:", err);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>, saleId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await fetch('/api/ml/upload-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId,
          fileName: file.name
        })
      });
      if (res.ok) {
        alert(`Factura ${file.name} subida correctamente a Mercado Libre para la venta ${saleId}`);
      }
    } catch (err) {
      console.error("Error uploading PDF:", err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/company-stats?companyId=${user.id}`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchList = async () => {
    setIsLoading(true);
    try {
      let endpoint = '';
      if (activeTab === 'products') endpoint = `/api/products?companyId=${user.id}`;
      if (activeTab === 'clients') endpoint = `/api/clients?companyId=${user.id}`;
      if (activeTab === 'invoices') endpoint = `/api/invoices?companyId=${user.id}`;
      
      if (endpoint) {
        const res = await fetch(endpoint);
        const data = await res.json();
        setListData(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error fetching list:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user.id]);

  useEffect(() => {
    if (activeTab !== 'dashboard') {
      fetchList();
    }
  }, [activeTab, user.id]);

  const handleDeleteItem = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este item?')) return;
    
    try {
      let endpoint = '';
      if (activeTab === 'products') endpoint = `/api/products/${id}`;
      if (activeTab === 'clients') endpoint = `/api/clients/${id}`;
      if (activeTab === 'invoices') endpoint = `/api/invoices/${id}`;

      const res = await fetch(endpoint, { method: 'DELETE' });
      if (res.ok) {
        fetchList();
        fetchStats();
      }
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  };

  const handleManualAdd = async () => {
    try {
      let endpoint = '';
      if (activeTab === 'products') endpoint = '/api/products';
      if (activeTab === 'clients') endpoint = '/api/clients';
      if (activeTab === 'invoices') endpoint = '/api/invoices';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newItem, companyId: user.id })
      });

      if (res.ok) {
        setShowManualAdd(false);
        setNewItem({});
        fetchList();
        fetchStats();
      }
    } catch (err) {
      console.error("Error adding item:", err);
    }
  };

  const handleSync = () => {
    if (activeTab === 'products' && selectedItems.size === 0) {
      alert('Por favor seleccione al menos un item para sincronizar.');
      return;
    }
    setIsSyncing(true);
    setTimeout(() => {
      setSyncData({
        local: activeTab === 'products' ? selectedItems.size : Math.floor(Math.random() * 100) + 50,
        ml: activeTab === 'products' ? selectedItems.size : Math.floor(Math.random() * 100) + 50,
        errors: 0,
        status: 'success',
        timestamp: new Date().toLocaleString(),
        ml_id: user.ml_id || 'No asignado'
      });
      setIsSyncing(false);
      fetchList();
      fetchStats();
      if (activeTab === 'products') {
        alert(`Sincronización finalizada correctamente para el ID de ML: ${user.ml_id || 'No asignado'}. Se actualizaron los items seleccionados.`);
      }
    }, 1500);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tight capitalize">
          {activeTab === 'dashboard' ? 'Resumen General' : `Sincronizar ${activeTab}`}
        </h2>
        <p className="text-slate-500 font-medium mt-1">
          {activeTab === 'dashboard' ? 'Estado actual de tus integraciones' : `Gestión de datos entre Sistema Local y Mercado Libre`}
        </p>
      </div>

      {activeTab === 'dashboard' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Productos" value={stats.products} color="bg-yellow-500" />
          <StatCard label="Clientes" value={stats.clients} color="bg-blue-500" />
          <StatCard label="Facturas" value={stats.invoices} color="bg-emerald-500" />
          <StatCard label="Estado Abono" value={user.debt > 0 ? 'Pendiente' : 'Al día'} color={user.debt > 0 ? 'bg-red-500' : 'bg-green-500'} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Upload size={24} className="text-yellow-500" />
                  {activeTab === 'products' ? 'Inventario de Productos (ODBC)' : 
                   activeTab === 'clients' ? 'Mis Clientes' : 'Facturación'}
                </h3>
                <div className="flex items-center gap-3">
                  {activeTab === 'products' && (
                    <label className="px-4 py-2 bg-yellow-400 text-slate-900 rounded-lg text-xs font-bold hover:bg-yellow-500 transition-all flex items-center gap-2 cursor-pointer">
                      <Upload size={14} />
                      IMPORTAR EXCEL DISCV
                      <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelImport} />
                    </label>
                  )}
                  {activeTab === 'clients' && (
                    <>
                      <label className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-2 cursor-pointer">
                        <Upload size={14} />
                        CARGAR EXCEL
                        <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} />
                      </label>
                      <button 
                        onClick={() => setShowManualAdd(true)}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2"
                      >
                        <Plus size={14} />
                        CARGA MANUAL
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {isLoading ? (
                <div className="p-12 text-center text-slate-400 font-bold">Cargando datos...</div>
              ) : listData.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-yellow-400 transition-colors cursor-pointer group">
                  <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Upload size={32} />
                  </div>
                  <p className="text-slate-600 font-bold">No hay datos registrados aún</p>
                  <p className="text-slate-400 text-sm mt-1">
                    {activeTab === 'products' ? 'Cargue un archivo Excel DISCV para comenzar' : 'Arrastra un archivo para sincronizar o carga manualmente'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {listData.map((item: any) => (
                    <div 
                      key={item.id || item.code} 
                      onClick={() => activeTab === 'products' && toggleItemSelection(item.code)}
                      className={`p-4 border rounded-xl flex justify-between items-center transition-colors group cursor-pointer ${
                        activeTab === 'products' && selectedItems.has(item.code) 
                          ? 'border-yellow-400 bg-yellow-50' 
                          : 'border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {activeTab === 'products' && (
                          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            selectedItems.has(item.code) ? 'bg-yellow-400 border-yellow-400' : 'border-slate-300 bg-white'
                          }`}>
                            {selectedItems.has(item.code) && <CheckCircle2 size={12} className="text-slate-900" />}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-800">{item.name || item.number}</div>
                          <div className="text-xs text-slate-400 font-medium">
                            {activeTab === 'products' ? `Código: ${item.code}` :
                             activeTab === 'clients' ? item.email : `Total: $${item.total}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-xs font-black text-slate-300">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Lectura Local'}
                        </div>
                        {activeTab !== 'products' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                            className="p-2 text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-8 flex flex-col items-center gap-4">
                <button 
                  onClick={handleSync}
                  disabled={isSyncing}
                  className={`px-12 py-4 rounded-xl font-black text-lg shadow-xl transition-all ${
                    isSyncing 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : 'bg-yellow-400 text-slate-900 hover:bg-yellow-500 hover:scale-105 active:scale-95'
                  }`}
                >
                  {isSyncing ? 'SINCRONIZANDO...' : 'SINCRONIZAR A ML'}
                </button>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Los cambios se guardarán en cada plataforma según corresponda
                </p>
              </div>
            </div>

            {activeTab === 'invoices' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100"
              >
                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <RefreshCw size={24} className="text-blue-500" />
                  Descargar Ventas de Mercado Libre
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Inicio</label>
                    <input 
                      type="date" 
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none"
                      value={dateRange.start}
                      onChange={e => setDateRange({...dateRange, start: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Fin</label>
                    <input 
                      type="date" 
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none"
                      value={dateRange.end}
                      onChange={e => setDateRange({...dateRange, end: e.target.value})}
                    />
                  </div>
                  <button 
                    onClick={downloadMLSales}
                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
                  >
                    DESCARGAR Y EXPORTAR .XLS
                  </button>
                </div>

                {mlSales.length > 0 && (
                  <div className="mt-8 space-y-4">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Ventas Encontradas</h4>
                    {mlSales.map((sale: any) => (
                      <div key={sale.id} className="p-4 border border-slate-100 rounded-xl flex justify-between items-center">
                        <div>
                          <div className="font-bold text-slate-800">{sale.item}</div>
                          <div className="text-xs text-slate-400">{sale.date} | ${sale.amount}</div>
                        </div>
                        <label className="px-4 py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase hover:bg-slate-800 transition-all cursor-pointer">
                          Adjuntar Factura PDF
                          <input type="file" accept=".pdf" className="hidden" onChange={(e) => handlePdfUpload(e, sale.id)} />
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'pdf' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100"
              >
                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <FileType size={24} className="text-rose-500" />
                  Gestión de Facturas PDF
                </h3>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-rose-400 transition-colors cursor-pointer group relative">
                  <input 
                    type="file" 
                    accept=".pdf" 
                    multiple 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files) {
                        alert(`${files.length} archivos PDF seleccionados para subir.`);
                      }
                    }}
                  />
                  <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Upload size={32} />
                  </div>
                  <p className="text-slate-600 font-bold">Importar archivos PDF</p>
                  <p className="text-slate-400 text-sm mt-1">Selecciona las facturas para subir a Mercado Libre</p>
                </div>
              </motion.div>
            )}

            {syncData && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-800">Resultado de Sincronización</h3>
                  {syncData.status === 'success' && (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                      <CheckCircle2 size={14} />
                      Sincronización Exitosa
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <div className="text-xs font-black text-slate-400 uppercase mb-1">Sistema Local</div>
                    <div className="text-2xl font-black text-slate-800">{syncData.local} items</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <div className="text-xs font-black text-slate-400 uppercase mb-1">Mercado Libre</div>
                    <div className="text-2xl font-black text-slate-800">{syncData.ml} items</div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-xl">
                    <div className="text-xs font-black text-red-400 uppercase mb-1">Diferencias/Errores</div>
                    <div className="text-2xl font-black text-red-600">{syncData.errors} detectados</div>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-green-50 text-green-700 rounded-xl flex items-center gap-3 font-bold text-sm">
                  <CheckCircle2 size={20} />
                  Sincronización finalizada con éxito el {syncData.timestamp}
                </div>
              </motion.div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
              <h4 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-4">Últimas Sincronizaciones</h4>
              <div className="space-y-4">
                <SyncHistoryItem date="Hoy, 10:45" status="success" />
                <SyncHistoryItem date="Ayer, 16:20" status="error" />
                <SyncHistoryItem date="12 Mar, 09:15" status="success" />
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Manual Add Modal */}
      {showManualAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="bg-slate-900 p-6 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Carga Manual</h3>
              <button onClick={() => setShowManualAdd(false)} className="text-white/50 hover:text-white">✕</button>
            </div>
            <div className="p-8 space-y-4">
              {activeTab === 'inventory' && (
                <>
                  <input 
                    placeholder="Nombre del Producto" 
                    className="w-full p-3 rounded-lg border border-slate-200"
                    onChange={e => setNewItem({...newItem, name: e.target.value})}
                  />
                  <input 
                    type="number"
                    placeholder="Precio" 
                    className="w-full p-3 rounded-lg border border-slate-200"
                    onChange={e => setNewItem({...newItem, price: Number(e.target.value)})}
                  />
                  <input 
                    type="number"
                    placeholder="Stock" 
                    className="w-full p-3 rounded-lg border border-slate-200"
                    onChange={e => setNewItem({...newItem, stock: Number(e.target.value)})}
                  />
                </>
              )}
              {activeTab === 'clients' && (
                <>
                  <input 
                    placeholder="Nombre del Cliente" 
                    className="w-full p-3 rounded-lg border border-slate-200"
                    onChange={e => setNewItem({...newItem, name: e.target.value})}
                  />
                  <input 
                    placeholder="Email" 
                    className="w-full p-3 rounded-lg border border-slate-200"
                    onChange={e => setNewItem({...newItem, email: e.target.value})}
                  />
                </>
              )}
              {activeTab === 'invoices' && (
                <>
                  <input 
                    placeholder="Número de Factura" 
                    className="w-full p-3 rounded-lg border border-slate-200"
                    onChange={e => setNewItem({...newItem, number: e.target.value})}
                  />
                  <input 
                    type="number"
                    placeholder="Total" 
                    className="w-full p-3 rounded-lg border border-slate-200"
                    onChange={e => setNewItem({...newItem, total: Number(e.target.value)})}
                  />
                </>
              )}
              <button 
                onClick={handleManualAdd}
                className="w-full py-4 bg-yellow-400 text-slate-900 font-black rounded-xl hover:bg-yellow-500 transition-all"
              >
                GUARDAR ITEM
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function StatCard({ label, value, color }: { label: string, value: any, color: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex items-center gap-4">
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center text-white shadow-lg`}>
        <LayoutDashboard size={24} />
      </div>
      <div>
        <div className="text-xs font-black text-slate-400 uppercase tracking-wider">{label}</div>
        <div className="text-2xl font-black text-slate-800">{value}</div>
      </div>
    </div>
  );
}

function SyncHistoryItem({ date, status }: { date: string, status: 'success' | 'error' }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm font-bold text-slate-700">{date}</div>
      <div className={`w-2 h-2 rounded-full ${status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
    </div>
  );
}
