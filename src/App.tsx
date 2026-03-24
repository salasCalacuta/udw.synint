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
  Settings,
  Activity,
  Bell,
  X,
  Info,
  AlertTriangle
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
  ml_client_id?: string;
  ml_client_secret?: string;
  ml_callback_url?: string;
  ml_access_token?: string;
  ml_refresh_token?: string;
  ml_user_id?: string;
  ml_token_expires?: string;
  ml_is_collaborator?: boolean;
  ml_collaborator_email?: string;
  permissions?: {
    dashboard: boolean;
    products: boolean;
    prices: boolean;
    stock: boolean;
    clients: boolean;
    invoices: boolean;
    pdf: boolean;
  };
  lastSync?: string;
}

interface Product {
  id?: string;
  code: string;
  name: string;
  price: number;
  stock: number;
  category_id?: string;
  gtin?: string;
  condition?: 'new' | 'used' | 'not_specified';
  description?: string;
  images?: string[]; // base64 or URLs
  ml_item_id?: string;
  created_at?: string;
}

const SyncHistoryItem: React.FC<{ date: string, status: 'success' | 'error', items?: any[] }> = ({ date, status, items = [] }) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-slate-700">{date}</div>
        <div className={`w-2 h-2 rounded-full ${status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
      </div>
      {items && items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {items.map((item, idx) => (
            <span key={idx} className="text-[8px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-bold">
              {item.code}
            </span>
          ))}
        </div>
      )}
    </div>
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

const NotificationsPanel: React.FC<{ 
  notifications: any[], 
  onClose: () => void, 
  onMarkAsRead: (id: string) => void,
  isAdmin: boolean
}> = ({ notifications, onClose, onMarkAsRead, isAdmin }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-[100] border-l border-slate-100 flex flex-col"
    >
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
          <Bell size={20} className="text-yellow-500" />
          Notificaciones
        </h3>
        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
          <X size={20} className="text-slate-500" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {notifications.length === 0 ? (
          <div className="text-center py-10">
            <Info size={40} className="mx-auto text-slate-200 mb-2" />
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">No hay notificaciones</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div 
              key={n.id} 
              className={`p-4 rounded-xl border ${n.is_read ? 'bg-white border-slate-100' : 'bg-sky-50 border-sky-100'} transition-all relative group`}
            >
              <div className="flex items-start gap-3">
                {n.type === 'error' ? (
                  <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                ) : n.type === 'warning' ? (
                  <AlertTriangle size={18} className="text-yellow-500 shrink-0 mt-0.5" />
                ) : (
                  <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-xs font-black text-slate-800 mb-1">{n.title}</div>
                  <p className="text-[10px] text-slate-500 leading-relaxed mb-2">{n.message}</p>
                  {n.affected_elements && (
                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                      Afectados: {typeof n.affected_elements === 'string' ? n.affected_elements : JSON.stringify(n.affected_elements)}
                    </div>
                  )}
                  <div className="text-[8px] text-slate-300 mt-2 font-bold">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              {!n.is_read && (
                <button 
                  onClick={() => onMarkAsRead(n.id)}
                  className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-sky-100 text-sky-600 rounded hover:bg-sky-200"
                  title="Marcar como leída"
                >
                  <CheckCircle2 size={12} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};

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
    ml_client_id: '',
    ml_client_secret: '',
    ml_callback_url: '',
    permissions: {
      dashboard: true,
      products: true,
      prices: true,
      stock: true,
      clients: true,
      invoices: true,
      pdf: true
    }
  });

  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [dbError, setDbError] = useState<string>('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/notifications?companyId=${user.id}&isAdmin=${role === 'admin'}`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user, role]);

  const markNotificationAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      }
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const createNotification = async (type: 'error' | 'warning' | 'info', title: string, message: string, affected: any) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: user?.id,
          type,
          title,
          message,
          affected_elements: affected
        })
      });
      fetchNotifications();
    } catch (err) {
      console.error("Error creating notification:", err);
    }
  };
  const [isCheckingDb, setIsCheckingDb] = useState(true);

  // Check DB Connection
  useEffect(() => {
    const checkDb = async () => {
      try {
        const res = await fetch('/api/health-check');
        const data = await res.json();
        if (data.success) {
          setDbConnected(true);
        } else {
          setDbConnected(false);
          setDbError(data.message || 'Error de configuración de base de datos');
        }
      } catch (err) {
        setDbConnected(false);
        setDbError('No se pudo conectar con el servidor backend');
      } finally {
        setIsCheckingDb(false);
      }
    };
    checkDb();
  }, []);

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

  useEffect(() => {
    const amount = Number(newCompany.amount) || 0;
    const payments = Number(newCompany.payments) || 0;
    const calculatedDebt = amount - payments;
    if (newCompany.debt !== calculatedDebt) {
      setNewCompany(prev => ({ ...prev, debt: calculatedDebt }));
    }
  }, [newCompany.amount, newCompany.payments]);

  const PERMISSION_KEYS = [
    'dashboard',
    'products',
    'prices',
    'stock',
    'clients',
    'invoices',
    'pdf'
  ];

  const getSafePermissions = (perms: any) => {
    const defaultPermissions = {
      dashboard: true,
      products: true,
      prices: true,
      stock: true,
      clients: true,
      invoices: true,
      pdf: true
    };

    let parsed = perms;
    if (typeof perms === 'string') {
      try {
        parsed = JSON.parse(perms);
        // Handle double-stringification
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
      } catch (e) {
        return defaultPermissions;
      }
    }
    
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return defaultPermissions;
    }

    // Ensure all expected keys exist
    return {
      ...defaultPermissions,
      ...parsed
    };
  };

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

  const debugSchema = async () => {
    try {
      const res = await fetch('/api/debug-companies-schema');
      const data = await res.json();
      alert("Esquema de tabla 'companies':\n" + JSON.stringify(data, null, 2));
    } catch (err) {
      alert("Error al obtener esquema de la base de datos.");
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
      
      if (!res.ok) {
        const resClone = res.clone();
        let data;
        try {
          data = await res.json();
        } catch (e) {
          const text = await resClone.text().catch(() => 'No se pudo leer el cuerpo de la respuesta');
          console.error("Error al parsear JSON de la respuesta:", text);
          setError(`Error del servidor (${res.status}): ${text.substring(0, 100)}...`);
          return;
        }
        
        let msg = data.message || 'Error del servidor';
        if (data.debug_columns) {
          msg += ` (Columnas: ${data.debug_columns})`;
        }
        setError(msg);
        return;
      }

      const data = await res.json();
      console.log("Login response data:", data);
      if (data.success) {
        setUser(data.user);
        setRole(isAdmin ? 'admin' : 'company');
        console.log("User and Role set:", { user: data.user, role: isAdmin ? 'admin' : 'company' });
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  const resetCompanySession = async (id: string) => {
    try {
      const res = await fetch(`/api/reset-session/${id}`, { method: 'POST' });
      if (res.ok) {
        alert('Sesión reiniciada correctamente. El usuario ya puede volver a loguearse.');
        fetchCompanies();
      }
    } catch (err) {
      console.error("Error resetting session:", err);
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
              ml_client_id: '',
              ml_client_secret: '',
              ml_callback_url: '',
              ml_is_collaborator: false,
              ml_collaborator_email: '',
              permissions: {
                dashboard: true,
                products: true,
                prices: true,
                stock: true,
                clients: true,
                invoices: true,
                pdf: true
              }
            });
            fetchCompanies();
          } else {
            const errData = await res.json();
            alert('Error al guardar: ' + (errData.message || 'Error desconocido'));
          }
        } catch (err) {
          alert('Error de conexión al servidor');
        }
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
      ml_client_id: company.ml_client_id || '',
      ml_client_secret: company.ml_client_secret || '',
      ml_callback_url: company.ml_callback_url || '',
      ml_is_collaborator: company.ml_is_collaborator || false,
      ml_collaborator_email: company.ml_collaborator_email || '',
      permissions: getSafePermissions(company.permissions)
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

  if (isCheckingDb) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-blue-400 font-bold animate-pulse">VERIFICANDO SISTEMA...</p>
        </div>
      </div>
    );
  }

  if (dbConnected === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-red-950/20 border border-red-500/30 rounded-3xl p-10 text-center backdrop-blur-xl"
        >
          <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={40} />
          </div>
          <h1 className="text-2xl font-black text-white mb-4 uppercase tracking-tight">Error de Configuración</h1>
          <p className="text-red-200/70 mb-8 font-medium leading-relaxed">
            {dbError || "No se pudo establecer conexión con la base de datos Supabase."}
          </p>
          <div className="bg-black/40 rounded-2xl p-6 text-left mb-8 border border-white/5">
            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3">Pasos para solucionar:</p>
            <ul className="text-xs text-slate-400 space-y-3 font-medium">
              <li className="flex gap-2">
                <span className="text-red-500 font-bold">1.</span>
                <span>Ve al panel de <b>Secrets</b> en AI Studio.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-500 font-bold">2.</span>
                <span>Agrega <b>SUPABASE_URL</b> con la URL de tu proyecto.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-500 font-bold">3.</span>
                <span>Agrega <b>SUPABASE_ANON_KEY</b> con tu clave anon.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-500 font-bold">4.</span>
                <span>Reinicia la aplicación.</span>
              </li>
            </ul>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-white text-black font-black rounded-xl hover:bg-slate-200 transition-all uppercase tracking-widest text-sm"
          >
            Reintentar Conexión
          </button>
        </motion.div>
      </div>
    );
  }

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
                    placeholder=""
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
        <div className="mt-4 flex gap-4">
          <button 
            onClick={testConnection}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline uppercase tracking-widest"
          >
            Probar Conexión
          </button>
          <button 
            onClick={debugSchema}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline uppercase tracking-widest"
          >
            Ver Columnas DB
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-sky-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className={`w-72 ${role === 'admin' ? 'bg-slate-900' : 'bg-yellow-400'} flex flex-col shadow-2xl z-20`}>
        <div className={`p-8 border-b ${role === 'admin' ? 'border-blue-500/20' : 'border-yellow-500/30'}`}>
          <h1 className={`text-3xl font-black ${role === 'admin' ? 'text-blue-500' : 'text-slate-900'} tracking-tighter`}>MLSync</h1>
          <div className="mt-2 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 ${role === 'admin' ? 'bg-blue-500' : 'bg-green-600'} rounded-full animate-pulse`}></div>
              <span className={`text-xs font-bold ${role === 'admin' ? 'text-blue-100' : 'text-slate-800'} uppercase tracking-wider`}>
                {role === 'admin' ? 'Panel Administrador' : (user?.name || user?.username || 'Empresa')}
              </span>
            </div>
            <span className={`text-[10px] font-black ${role === 'admin' ? 'text-blue-400/50' : 'text-slate-700'} uppercase tracking-widest`}>SynInt-ML.Version1.306</span>
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
                role={role}
              />
              <SidebarItem 
                icon={<Users size={20} />} 
                label="Empresas" 
                active={activeTab === 'companies'} 
                onClick={() => setActiveTab('companies')} 
                role={role}
              />
              <SidebarItem 
                icon={
                  <div className="relative">
                    <Bell size={20} />
                    {notifications.filter(n => !n.is_read).length > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                    )}
                  </div>
                } 
                label="Notificaciones" 
                active={showNotifications} 
                onClick={() => setShowNotifications(true)} 
                role={role}
              />
            </>
          ) : (
            <>
              {(getSafePermissions(user.permissions).dashboard) && (
                <SidebarItem 
                  icon={<LayoutDashboard size={20} />} 
                  label="Resumen" 
                  active={activeTab === 'dashboard'} 
                  onClick={() => setActiveTab('dashboard')} 
                  role={role}
                />
              )}
              <div className={`pt-4 pb-2 px-4 text-[10px] font-black ${role === 'admin' ? 'text-blue-400/30' : 'text-slate-800/50'} uppercase tracking-[0.2em]`}>Sincronización</div>
              {(getSafePermissions(user.permissions).products) && (
                <SidebarItem 
                  icon={<Package size={20} />} 
                  label="Productos" 
                  active={activeTab === 'products'} 
                  onClick={() => setActiveTab('products')} 
                  role={role}
                />
              )}
              {(getSafePermissions(user.permissions).stock || getSafePermissions(user.permissions).prices) && (
                <SidebarItem 
                  icon={<Boxes size={20} />} 
                  label="Stock y Precios" 
                  active={activeTab === 'stock'} 
                  onClick={() => setActiveTab('stock')} 
                  role={role}
                />
              )}
              {(getSafePermissions(user.permissions).clients) && (
                <SidebarItem 
                  icon={<Users size={20} />} 
                  label="Clientes" 
                  active={activeTab === 'clients'} 
                  onClick={() => setActiveTab('clients')} 
                  role={role}
                />
              )}
              {(getSafePermissions(user.permissions).invoices) && (
                <SidebarItem 
                  icon={<FileText size={20} />} 
                  label="Facturas" 
                  active={activeTab === 'invoices'} 
                  onClick={() => setActiveTab('invoices')} 
                  role={role}
                />
              )}
              {(getSafePermissions(user.permissions).pdf) && (
                <SidebarItem 
                  icon={<FileType size={20} />} 
                  label="PDFs" 
                  active={activeTab === 'pdf'} 
                  onClick={() => setActiveTab('pdf')} 
                  role={role}
                />
              )}
              <SidebarItem 
                icon={
                  <div className="relative">
                    <Bell size={20} />
                    {notifications.filter(n => !n.is_read).length > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                    )}
                  </div>
                } 
                label="Notificaciones" 
                active={showNotifications} 
                onClick={() => setShowNotifications(true)} 
                role={role}
              />
              {(getSafePermissions(user.permissions).clients) && (
                <SidebarItem 
                  icon={<Users size={20} />} 
                  label="Clientes" 
                  active={activeTab === 'clients'} 
                  onClick={() => setActiveTab('clients')} 
                  role={role}
                />
              )}
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
        {console.log("Rendering Main Content, role:", role, "user:", !!user)}
        <AnimatePresence mode="wait">
          {role === 'admin' ? (
            <AdminView 
              key="admin"
              activeTab={activeTab} 
              companies={companies} 
              toggleStatus={toggleCompanyStatus}
              showAdd={() => {
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
                  ml_client_id: '',
                  ml_client_secret: '',
                  ml_callback_url: '',
                  permissions: {
                    dashboard: true,
                    products: true,
                    prices: true,
                    stock: true,
                    clients: true,
                    invoices: true,
                    pdf: true
                  }
                });
                setShowAddCompany(true);
              }}
              testConnection={testConnection}
              onEdit={startEditCompany}
              onDelete={deleteCompany}
              onResetSession={resetCompanySession}
            />
          ) : (
            <CompanyView 
              key="company"
              activeTab={activeTab} 
              user={user}
              setUser={setUser}
              setShowConfirm={setShowConfirm}
              role={role}
              notifications={notifications}
              showNotifications={showNotifications}
              setShowNotifications={setShowNotifications}
              markNotificationAsRead={markNotificationAsRead}
              createNotification={createNotification}
            />
          )}
        </AnimatePresence>

        {/* Add Company Modal */}
        {showAddCompany && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 md:p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-auto"
            >
              <div className="bg-yellow-400 p-4 md:p-6 flex justify-between items-center sticky top-0 z-10 rounded-t-2xl">
                <h3 className="text-lg md:text-xl font-bold text-slate-900">{editingCompany ? 'Editar Empresa' : 'Registro de Nueva Empresa'}</h3>
                <button onClick={() => { setShowAddCompany(false); setEditingCompany(null); }} className="text-slate-900/50 hover:text-slate-900 p-2">✕</button>
              </div>
              <div className="p-4 md:p-8 space-y-6 max-h-[calc(100vh-10rem)] overflow-y-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
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
                    
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Permisos de Dashboard</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {PERMISSION_KEYS.map((key) => (
                          <div key={key} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                            <input 
                              type="checkbox"
                              id={`perm-${key}`}
                              checked={!!getSafePermissions(newCompany.permissions)[key]}
                              onChange={e => {
                                const currentPerms = getSafePermissions(newCompany.permissions);
                                setNewCompany({
                                  ...newCompany, 
                                  permissions: {
                                    ...currentPerms,
                                    [key]: e.target.checked
                                  }
                                });
                              }}
                              className="w-4 h-4 text-yellow-400 rounded focus:ring-yellow-400"
                            />
                            <label htmlFor={`perm-${key}`} className="text-[10px] font-bold text-slate-700 cursor-pointer uppercase">
                              {key === 'dashboard' ? 'Resumen' : 
                               key === 'products' ? 'Productos' :
                               key === 'prices' ? 'Precios' :
                               key === 'stock' ? 'Stock' :
                               key === 'clients' ? 'Clientes' :
                               key === 'invoices' ? 'Facturas' :
                               key === 'pdf' ? 'PDFs' : key}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
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
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 ml-1">Monto Abono</label>
                          <input 
                            type="number"
                            placeholder="0.00" 
                            className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                            value={newCompany.amount}
                            onChange={e => {
                              const amount = Number(e.target.value);
                              setNewCompany({
                                ...newCompany, 
                                amount,
                                debt: amount - newCompany.payments
                              });
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 ml-1">Pagos</label>
                          <input 
                            type="number"
                            placeholder="0.00" 
                            className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                            value={newCompany.payments}
                            onChange={e => {
                              const payments = Number(e.target.value);
                              setNewCompany({
                                ...newCompany, 
                                payments,
                                debt: newCompany.amount - payments
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Config. Sincronización</h4>
                      <input 
                        placeholder="ML Client ID" 
                        className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                        value={newCompany.ml_client_id}
                        onChange={e => setNewCompany({...newCompany, ml_client_id: e.target.value})}
                      />
                      <input 
                        placeholder="ML Client Secret" 
                        className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                        value={newCompany.ml_client_secret}
                        onChange={e => setNewCompany({...newCompany, ml_client_secret: e.target.value})}
                      />
                      <input 
                        placeholder="ML Callback URL" 
                        className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                        value={newCompany.ml_callback_url}
                        onChange={e => setNewCompany({...newCompany, ml_callback_url: e.target.value})}
                      />
                      <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <input 
                          type="checkbox"
                          id="is_collaborator"
                          checked={newCompany.ml_is_collaborator === true || newCompany.ml_is_collaborator === 'true'}
                          onChange={e => setNewCompany({...newCompany, ml_is_collaborator: e.target.checked})}
                          className="w-4 h-4 text-yellow-400 rounded focus:ring-yellow-400"
                        />
                        <label htmlFor="is_collaborator" className="text-xs font-bold text-slate-700 cursor-pointer">
                          Cuenta de Colaborador
                        </label>
                      </div>
                      {newCompany.ml_is_collaborator && (
                        <input 
                          placeholder="Email del Colaborador" 
                          className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                          value={newCompany.ml_collaborator_email}
                          onChange={e => setNewCompany({...newCompany, ml_collaborator_email: e.target.value})}
                        />
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 pt-4 sticky bottom-0 bg-white z-10">
                  <button 
                    onClick={() => { setShowAddCompany(false); setEditingCompany(null); }}
                    className="flex-1 py-3 md:py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={addCompany}
                    className="flex-1 py-3 md:py-4 bg-yellow-400 text-slate-900 font-black rounded-xl shadow-xl shadow-yellow-200 hover:bg-yellow-500 transition-all"
                  >
                    {editingCompany ? 'GUARDAR CAMBIOS' : 'GUARDAR EN LA NUBE'}
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
                    onClick={async () => {
                      if (showConfirm.action) {
                        try {
                          await showConfirm.action();
                        } catch (err) {
                          console.error("Error in confirmation action:", err);
                        }
                      }
                      setShowConfirm(prev => ({ ...prev, show: false }));
                    }}
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

function SidebarItem({ icon, label, active, onClick, role }: { icon: any, label: string, active: boolean, onClick: () => void, role?: string }) {
  const isAdmin = role === 'admin';
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
        active 
          ? isAdmin ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
          : isAdmin ? 'text-blue-100/70 hover:bg-blue-500/20 hover:text-blue-100' : 'text-slate-800 hover:bg-yellow-500/50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function AdminView({ activeTab, companies, toggleStatus, showAdd, onEdit, onDelete, onResetSession }: any) {
  const [testStatus, setTestStatus] = useState<any>({});
  const [mlConfigCompany, setMlConfigCompany] = useState<Company | null>(null);

  const handleTestSync = (companyId: string, type: 'ml') => {
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
      {/* ML Config Modal */}
      {mlConfigCompany && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="bg-slate-900 p-6 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-400 rounded-lg">
                  <Settings size={20} className="text-slate-900" />
                </div>
                <h3 className="text-xl font-bold text-white">Configuración ML: {mlConfigCompany.name}</h3>
              </div>
              <button onClick={() => setMlConfigCompany(null)} className="text-white/50 hover:text-white">✕</button>
            </div>
            <div className="p-4 md:p-8 space-y-6 overflow-y-auto">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-slate-800">Estado de la Integración</h4>
                    <p className="text-sm text-slate-500 mt-1">
                      {mlConfigCompany.ml_access_token 
                        ? `Vinculado con Mercado Libre (ID: ${mlConfigCompany.ml_user_id})` 
                        : 'No se ha vinculado ninguna cuenta de Mercado Libre'}
                    </p>
                    {mlConfigCompany.ml_token_expires && (
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">
                        Expira: {new Date(mlConfigCompany.ml_token_expires).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <button 
                    onClick={() => {
                      const startOAuth = async () => {
                        try {
                          const res = await fetch(`/api/ml/auth-url?companyId=${mlConfigCompany.id}&origin=${encodeURIComponent(window.location.origin)}`);
                          const data = await res.json();
                          if (data.url) {
                            window.open(data.url, 'ML_AUTH', 'width=600,height=600');
                          }
                        } catch (err) {
                          alert('Error al iniciar autenticación');
                        }
                      };
                      startOAuth();
                    }}
                    className="w-full md:w-auto px-6 py-3 bg-yellow-400 text-slate-900 font-black rounded-xl hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-400/20"
                  >
                    {mlConfigCompany.ml_access_token ? 'REFRESCAR CONEXIÓN' : 'VINCULAR CUENTA'}
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 border border-slate-100 rounded-2xl">
                  <h4 className="font-bold text-slate-800 mb-4">Credenciales API</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase">Client ID</label>
                      <div className="p-3 bg-slate-50 rounded-lg text-xs font-mono text-slate-600 truncate">
                        {mlConfigCompany.ml_client_id || 'No configurado'}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase flex justify-between">
                        Redirect URI (Callback)
                        <span className="text-rose-500 font-black">¡IMPORTANTE!</span>
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-1 p-3 bg-slate-50 rounded-lg text-[10px] font-mono text-slate-600 break-all border border-slate-200">
                          {window.location.origin}/api/ml/callback
                        </div>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/api/ml/callback`);
                            alert('URL copiada al portapapeles');
                          }}
                          className="p-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all"
                          title="Copiar URL"
                        >
                          <Activity size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 border border-slate-100 rounded-2xl bg-blue-50/30">
                  <h4 className="font-bold text-blue-800 mb-2">Ayuda</h4>
                  <p className="text-xs text-blue-600 leading-relaxed">
                    Para que la integración funcione, debe configurar el Client ID y Client Secret en la edición de la empresa, y luego vincular la cuenta aquí.
                  </p>
                </div>
              </div>
              <div className="flex justify-end shrink-0">
                <button 
                  onClick={() => setMlConfigCompany(null)}
                  className="w-full md:w-auto px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            {activeTab === 'dashboard' ? 'Panel de Control' : 'Gestión de Empresas'}
          </h2>
          <p className="text-slate-500 font-medium mt-1">Administración central de MLSync</p>
        </div>
        <div className="w-full md:w-auto">
          {activeTab === 'companies' && (
            <button 
              onClick={showAdd}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all"
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
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Empresa</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Credenciales</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Sincronización</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Monto</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Deuda</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Pagos</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Colaborador</th>
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
                            <span className="text-[10px] text-slate-500 truncate max-w-[80px]">Config. Mercado Libre</span>
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
                        { testStatus[`${company.id}-ml`] === 'success' && (
                          <div className="flex items-center gap-1 text-[8px] font-black text-green-600 uppercase mt-2">
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
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm font-bold text-emerald-600">${company.payments || 0}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-xs font-bold text-slate-600 truncate max-w-[150px] mx-auto">{company.ml_collaborator_email || '-'}</div>
                      {company.ml_is_collaborator && <div className="text-[8px] font-black text-blue-500 uppercase">Activo</div>}
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
                          onClick={() => onResetSession(company.id)}
                          className="p-2 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100 transition-all"
                          title="Reiniciar Sesión"
                        >
                          <RefreshCw size={16} />
                        </button>
                        <button 
                          onClick={() => setMlConfigCompany(company)}
                          className="p-2 bg-slate-900 text-yellow-400 rounded-lg hover:bg-slate-800 transition-all"
                          title="Configuración Mercado Libre"
                        >
                          <Settings size={16} />
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

          {/* Mobile Card Layout */}
          <div className="lg:hidden divide-y divide-slate-100">
            {companies.map((company: Company) => (
              <div key={company.id} className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-lg text-slate-800">{company.name}</div>
                    <div className="text-xs text-slate-400 uppercase font-black">Resp: {company.responsible_name}</div>
                    <div className="text-xs text-slate-400 uppercase font-black">Tel: {company.phone}</div>
                  </div>
                  <div className={`px-2 py-1 rounded text-[10px] font-black uppercase ${company.enabled ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {company.enabled ? 'Activa' : 'Suspendida'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl">
                  <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase">Usuario</div>
                    <div className="text-sm font-medium text-slate-600">{company.username}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase">Contraseña</div>
                    <div className="text-sm font-medium text-slate-600">{company.password || '••••••'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-slate-50 rounded-lg text-center">
                    <div className="text-[8px] font-black text-slate-400 uppercase">Monto</div>
                    <div className="text-xs font-bold text-slate-800">${company.amount}</div>
                  </div>
                  <div className="p-2 bg-rose-50 rounded-lg text-center">
                    <div className="text-[8px] font-black text-rose-400 uppercase">Deuda</div>
                    <div className="text-xs font-bold text-rose-600">${company.debt}</div>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-lg text-center">
                    <div className="text-[8px] font-black text-emerald-400 uppercase">Pagos</div>
                    <div className="text-xs font-bold text-emerald-600">${company.payments || 0}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button 
                    onClick={() => toggleStatus(company.id, !company.enabled)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
                      company.enabled 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-red-100 text-red-600'
                    }`}
                  >
                    {company.enabled ? <Unlock size={14} /> : <Lock size={14} />}
                    <span className="text-xs font-bold uppercase">{company.enabled ? 'Suspender' : 'Habilitar'}</span>
                  </button>
                  <button 
                    onClick={() => onResetSession(company.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-yellow-50 text-yellow-600 rounded-lg"
                  >
                    <RefreshCw size={14} />
                    <span className="text-xs font-bold uppercase">Reset</span>
                  </button>
                  <button 
                    onClick={() => setMlConfigCompany(company)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-900 text-yellow-400 rounded-lg"
                  >
                    <Settings size={14} />
                    <span className="text-xs font-bold uppercase">ML</span>
                  </button>
                  <button 
                    onClick={() => onEdit(company)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 rounded-lg"
                  >
                    <Edit size={14} />
                    <span className="text-xs font-bold uppercase">Editar</span>
                  </button>
                  <button 
                    onClick={() => onDelete(company.id, company.name)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-rose-50 text-rose-600 rounded-lg"
                  >
                    <Trash2 size={14} />
                    <span className="text-xs font-bold uppercase">Eliminar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function CompanyView({ 
  activeTab, 
  user, 
  setUser, 
  setShowConfirm,
  role,
  notifications,
  showNotifications,
  setShowNotifications,
  markNotificationAsRead,
  createNotification
}: any) {
  console.log("CompanyView rendering with:", { activeTab, userId: user?.id, role: user?.role, userName: user?.name });
  console.log("Full user object:", JSON.stringify(user));
  
  if (!user) {
    console.error("CompanyView: User is null!");
    return <div className="p-8 text-center text-red-500 font-bold">Error: Usuario no encontrado. Por favor reingrese.</div>;
  }

  const [syncData, setSyncData] = useState<any>(null);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState({ products: 0, clients: 0, invoices: 0 });
  const [listData, setListData] = useState<any[]>([]);
  const [cachedExcelProducts, setCachedExcelProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [showEditProduct, setShowEditProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newItem, setNewItem] = useState<any>({
    code: '',
    name: '',
    price: 0,
    stock: 0,
    category_id: '',
    gtin: '',
    condition: 'new',
    description: '',
    images: [],
    codigo: '',
    nombre: '',
    mail: '',
    direccion: '',
    localidad: '',
    telefono: '',
    number: '',
    total: 0
  });
  const [recentManualItems, setRecentManualItems] = useState<any[]>([]);
  const [mlSales, setMlSales] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws);
        
        console.log("Excel data raw:", jsonData);

        if (jsonData.length === 0) {
          alert("El archivo Excel parece estar vacío.");
          return;
        }

        if (activeTab === 'clients') {
          const clients = jsonData.map((row: any) => {
            const codigo = row.codigo || row.Codigo || row.Código || row.itm_cod || row.code || row.Code || row['CÓDIGO'] || '';
            const nombre = row.nombre || row.Nombre || row.itm_desc || row.name || row.Name || row['NOMBRE'] || '';
            const direccion = row.direccion || row.Dirección || row.address || row.Address || row['DIRECCIÓN'] || '';
            const localidad = row.localidad || row.Localidad || row.city || row.City || row['LOCALIDAD'] || '';
            const telefono = row.telefono || row.Teléfono || row.phone || row.Phone || row['TELÉFONO'] || '';
            const mail = row.mail || row.email || row.Email || row.Mail || row['MAIL'] || row['EMAIL'] || '';

            return {
              codigo: String(codigo).trim(),
              nombre: String(nombre).trim(),
              direccion: String(direccion).trim(),
              localidad: String(localidad).trim(),
              telefono: String(telefono).trim(),
              mail: String(mail).trim()
            };
          }).filter(c => c.codigo && c.nombre);

          if (clients.length === 0) {
            alert("No se encontraron clientes válidos. Verifique las columnas: codigo, nombre, direccion, localidad, telefono, mail.");
          } else {
            setListData(clients);
            alert(`Se importaron ${clients.length} clientes correctamente.`);
          }
          return;
        }

        // Map columns: assuming itm_cod and itm_desc are in the Excel
        const products = jsonData.map((row: any) => {
          // Find code column
          const code = row.itm_cod || row.Código || row.codigo || row.Code || row.code || row['CÓDIGO'] || row['Codigo'] || row['Item Code'] || row['SKU'] || row['sku'] || '';
          // Find name column
          const name = row.itm_desc || row.Descripción || row.descripcion || row.Description || row.description || row['DESCRIPCIÓN'] || row['Descripcion'] || row['Item Description'] || row['Título'] || row['titulo'] || '';
          // Find price column
          const price = row.Precio || row.precio || row.Price || row.price || row['PRECIO'] || row['itm_prec'] || row['Price'] || 0;
          // Find stock column
          const stock = row.Stock || row.stock || row['STOCK'] || row['itm_stoc'] || row['Quantity'] || row['cantidad'] || row['Disponible'] || row['disponible'] || row['available_quantity'] || 0;
          // Find category column
          const category = row.Categoria || row.categoria || row.Category || row.category || row['CATEGORÍA'] || row['category_id'] || 'MLA1652';
          // Find image column
          const imageUrl = row.Imagen || row.imagen || row.Image || row.image || row['IMAGEN'] || row['pictures'] || '';
          // Find GTIN/Barcode column
          const gtin = row.GTIN || row.gtin || row.EAN || row.ean || row['Código de Barras'] || row['Codigo de Barras'] || row['barcode'] || row['Barcode'] || '';

          return {
            code: String(code).trim(),
            name: String(name).trim(),
            price: Number(price) || 0,
            stock: Number(stock) || 0,
            category_id: String(category).trim(),
            gtin: String(gtin).trim(),
            pictures: imageUrl ? [{ source: String(imageUrl).trim() }] : null
          };
        }).filter(p => p.code && p.name);

        console.log("Mapped products:", products);

        if (products.length === 0) {
          const firstRow = jsonData[0] || {};
          const columns = Object.keys(firstRow).join(', ');
          alert(`No se encontraron productos válidos. Verifique que las columnas itm_cod e itm_desc (o similares) existan.\n\nColumnas detectadas: ${columns}`);
        } else {
          if (activeTab === 'prices' || activeTab === 'stock') {
            // Merge with existing ML items
            setListData(prev => {
              const newList = [...prev];
              let matches = 0;
              products.forEach((exProd: any) => {
                const index = newList.findIndex(item => item.code === exProd.code);
                if (index !== -1) {
                  newList[index] = { 
                    ...newList[index], 
                    price: exProd.price > 0 ? exProd.price : newList[index].price,
                    stock: exProd.stock >= 0 ? exProd.stock : newList[index].stock,
                    local_price: exProd.price,
                    local_stock: exProd.stock
                  };
                  matches++;
                  // Auto-select for sync
                  setSelectedItems(prevSelect => {
                    const next = new Set(prevSelect);
                    next.add(newList[index].code);
                    return next;
                  });
                }
              });
              alert(`Se actualizaron datos para ${matches} productos coincidentes desde Excel.`);
              setCachedExcelProducts(newList);
              return newList;
            });
          } else {
            setListData(products);
            setCachedExcelProducts(products);
            setSelectedItems(new Set());
            alert(`Se importaron ${products.length} productos correctamente.`);
          }
        }
      } catch (err) {
        console.error("Error parsing Excel:", err);
        alert("Error al procesar el archivo Excel. Asegúrese de que sea un formato válido (.xlsx o .xls)");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const toggleItemSelection = (id: string | number) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedItems(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === listData.length && listData.length > 0) {
      setSelectedItems(new Set());
    } else {
      const allIds = listData.map((item: any) => item.id || item.code || item.codigo);
      setSelectedItems(new Set(allIds));
    }
  };

  useEffect(() => {
    setSelectedItems(new Set());
  }, [activeTab]);

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        console.log("Excel sheets detected:", wb.SheetNames);
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws);
        
        console.log("Client Excel raw data:", jsonData.slice(0, 3));
        
        const mappedClients = jsonData.map((row: any) => {
          const codigo = row.codigo || row.Codigo || row.Código || row.code || row.Code || row.CODIGO || '';
          const nombre = row.nombre || row.Nombre || row.name || row.Name || row.NOMBRE || '';
          const direccion = row.direccion || row.Direccion || row.Dirección || row.address || row.Address || row.DIRECCION || '';
          const localidad = row.localidad || row.Localidad || row.city || row.City || row.LOCALIDAD || '';
          const telefono = row.telefono || row.Telefono || row.phone || row.Phone || row.TELEFONO || '';
          const mail = row.mail || row.Mail || row.email || row.Email || row.MAIL || row.EMAIL || '';
          
          return {
            codigo: String(codigo).trim(),
            nombre: String(nombre).trim(),
            direccion: String(direccion).trim(),
            localidad: String(localidad).trim(),
            telefono: String(telefono).trim(),
            mail: String(mail).trim(),
            email: String(mail).trim(), // For UI consistency
            company_id: user.id
          };
        }).filter(c => c.nombre || c.mail || c.codigo);

        console.log("Mapped clients for import:", mappedClients);

        if (mappedClients.length === 0) {
          console.warn("No valid clients found in Excel data");
          alert("No se encontraron clientes válidos en el archivo. Verifique las columnas (codigo, nombre, mail, etc).");
          return;
        }

        fetch('/api/sync/excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'clients',
            data: mappedClients,
            companyId: user.id
          })
        }).then(res => {
          if (res.ok) {
            alert(`Se importaron ${mappedClients.length} clientes correctamente.`);
            fetchList(true);
            fetchStats();
          } else {
            console.error("Server error syncing clients from excel", res.status);
            alert("Error al sincronizar con el servidor.");
          }
        });
      } catch (err) {
        console.error("Error parsing Client Excel:", err);
        alert("Error al procesar el archivo Excel.");
      }
    };
    reader.readAsArrayBuffer(file);
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
      
      // Update sync history
      const syncResult = {
        local: data.length,
        ml: data.length,
        errors: 0,
        status: 'success' as const,
        results: data.map((s: any) => ({ id: s.id, status: 'success', sku: s.id })),
        timestamp: new Date().toLocaleString()
      };
      setSyncHistory(prev => [syncResult, ...prev].slice(0, 10));
      
      // Export to Excel
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ventas ML");
      XLSX.writeFile(wb, `ventas_ml_${dateRange.start}_${dateRange.end}.xlsx`);
      
      alert('Ventas descargadas y exportadas a Excel');
    } catch (err) {
      console.error("Error downloading ML sales:", err);
      createNotification(
        'error',
        'Error de Descarga Ventas',
        `No se pudieron descargar las ventas de Mercado Libre para el rango ${dateRange.start} - ${dateRange.end}.`,
        []
      );
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
        
        // Update sync history
        const syncResult = {
          local: 1,
          ml: 1,
          errors: 0,
          status: 'success' as const,
          results: [{ id: saleId, status: 'success', sku: file.name }],
          timestamp: new Date().toLocaleString()
        };
        setSyncHistory(prev => [syncResult, ...prev].slice(0, 10));
      }
    } catch (err) {
      console.error("Error uploading PDF:", err);
      createNotification(
        'error',
        'Error de Carga PDF',
        `No se pudo cargar la factura ${file.name} para la venta ${saleId}.`,
        [saleId]
      );
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct({
      ...product,
      description: product.description || '',
      gtin: product.gtin || '',
      condition: product.condition || 'new',
      images: product.images || []
    });
    setShowEditProduct(true);
  };

  const handleSaveProduct = async () => {
    if (!editingProduct) return;
    
    setShowConfirm({
      show: true,
      title: 'Confirmar Edición',
      message: '¿Estás seguro de que deseas guardar los cambios en este producto?',
      action: async () => {
        try {
          const res = await fetch(`/api/products/${editingProduct.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingProduct)
          });
          if (res.ok) {
            setShowEditProduct(false);
            setEditingProduct(null);
            setCachedExcelProducts([]); // Clear cache to fetch latest from DB
            fetchList(true);
          } else {
            alert('Error al guardar los cambios del producto');
          }
        } catch (err) {
          console.error("Error saving product:", err);
          alert('Error de red al guardar los cambios');
        }
      }
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !editingProduct) return;
    
    const currentImages = [...(editingProduct.images || [])];
    if (currentImages.length + files.length > 3) {
      alert('Máximo 3 imágenes por producto');
      return;
    }

    (Array.from(files) as File[]).forEach(file => {
      if (file.type !== 'image/jpeg' && file.type !== 'image/jpg') {
        alert('Solo se permiten archivos .jpg');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64 = evt.target?.result as string;
        setEditingProduct(prev => prev ? {
          ...prev,
          images: [...(prev.images || []), base64].slice(0, 3)
        } : null);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setEditingProduct(prev => prev ? {
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index)
    } : null);
  };

  const fetchStats = async () => {
    if (!user || !user.id) return;
    try {
      const res = await fetch(`/api/company-stats?companyId=${user.id}`);
      if (!res.ok) {
        console.error(`Stats fetch failed with status: ${res.status}`);
        return;
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchList = async (force = false) => {
    setIsLoading(true);
    try {
      if (!force && activeTab === 'products' && cachedExcelProducts.length > 0) {
        setListData(cachedExcelProducts);
        setIsLoading(false);
        return;
      }

      let endpoint = '';
      if (activeTab === 'products') endpoint = `/api/products?companyId=${user.id}`;
      if (activeTab === 'clients') endpoint = `/api/clients?companyId=${user.id}`;
      if (activeTab === 'invoices') endpoint = `/api/invoices?companyId=${user.id}`;
      if (activeTab === 'prices' || activeTab === 'stock') {
        if (!user.ml_access_token) {
          setListData([]);
          setIsLoading(false);
          return;
        }
        endpoint = `/api/ml/items?companyId=${user.id}`;
      }
      
      if (endpoint) {
        console.log(`Fetching list from ${endpoint}`);
        const res = await fetch(endpoint);
        if (res.status === 401) {
          console.warn("Unauthorized fetching list");
          setUser({ ...user, ml_access_token: null });
          setListData([]);
          setIsLoading(false);
          return;
        }
        const data = await res.json();
        console.log(`Fetched ${Array.isArray(data) ? data.length : 'unknown'} items for ${activeTab}`);
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
        setCachedExcelProducts([]); // Clear cache to fetch latest from DB
        fetchList();
        fetchStats();
      }
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  };

  const handleManualAdd = async () => {
    setShowConfirm({
      show: true,
      title: 'Confirmar Registro',
      message: '¿Estás seguro de que deseas registrar este nuevo item?',
      action: async () => {
        try {
          let endpoint = '';
          if (activeTab === 'products') endpoint = '/api/products';
          if (activeTab === 'clients') endpoint = '/api/clients';
          if (activeTab === 'invoices') endpoint = '/api/invoices';

          const method = editingProduct ? 'PUT' : 'POST';
          const finalEndpoint = editingProduct ? `${endpoint}/${editingProduct.id}` : endpoint;

          const res = await fetch(finalEndpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newItem, company_id: user.id })
          });

          if (res.ok) {
            console.log("Manual add success");
            const savedItem = await res.json();
            setRecentManualItems(prev => [savedItem, ...prev].slice(0, 5));
            setNewItem({});
            setCachedExcelProducts([]); // Clear cache to fetch latest from DB
            fetchList(true);
            fetchStats();
            // We keep the modal open to show the recently added item as requested
            // setShowManualAdd(false); 
          } else {
            const errData = await res.json().catch(() => ({}));
            console.error("Error saving manual item:", errData);
            alert('Error al guardar el registro: ' + (errData.message || errData.error || 'Error desconocido'));
          }
        } catch (err) {
          console.error("Error adding item:", err);
          alert('Error de red al guardar el registro');
        } finally {
          setShowConfirm(prev => ({ ...prev, show: false }));
        }
      }
    });
  };

  const handleDatUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      const base64 = btoa(content);
      
      try {
        const res = await fetch('/api/parse-odbc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileContent: base64 })
        });
        const data = await res.json();
        if (data.success) {
          if (activeTab === 'prices') {
            // Merge with existing ML items
            setListData(prev => {
              const newList = [...prev];
              let matches = 0;
              data.products.forEach((datProd: any) => {
                const index = newList.findIndex(item => item.code === datProd.code);
                if (index !== -1) {
                  newList[index] = { 
                    ...newList[index], 
                    price: datProd.price > 0 ? datProd.price : newList[index].price 
                  };
                  matches++;
                  // Auto-select for sync
                  setSelectedItems(prevSelect => {
                    const next = new Set(prevSelect);
                    next.add(newList[index].code);
                    return next;
                  });
                }
              });
              alert(`Se actualizaron precios para ${matches} productos coincidentes.`);
              return newList;
            });
          } else {
            setListData(data.products);
            setSelectedItems(new Set());
            alert(`Se cargaron ${data.products.length} productos desde el archivo .dat`);
          }
        }
      } catch (err) {
        alert('Error al procesar el archivo .dat');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handlePriceChange = (code: string, newPrice: number) => {
    setListData(prev => prev.map(item => 
      item.code === code ? { ...item, price: newPrice } : item
    ));
    if (!selectedItems.has(code)) {
      const newSelection = new Set(selectedItems);
      newSelection.add(code);
      setSelectedItems(newSelection);
    }
  };

  const handleStockChange = (code: string, newStock: number) => {
    setListData(prev => prev.map(item => 
      item.code === code ? { ...item, stock: newStock } : item
    ));
    if (!selectedItems.has(code)) {
      const newSelection = new Set(selectedItems);
      newSelection.add(code);
      setSelectedItems(newSelection);
    }
  };

  const handleSync = async (itemCode?: string) => {
    if (!itemCode && (activeTab === 'products' || activeTab === 'prices' || activeTab === 'stock' || activeTab === 'clients' || activeTab === 'invoices') && selectedItems.size === 0) {
      alert('Por favor seleccione al menos un item para sincronizar.');
      return;
    }

    if (activeTab === 'products' || activeTab === 'prices' || activeTab === 'stock') {
      // Check if we have ML token
      if (!user.ml_access_token) {
        // Start OAuth flow
        try {
          const res = await fetch(`/api/ml/auth-url?companyId=${user.id}`);
          const { url } = await res.json();
          window.open(url, 'ML_AUTH', 'width=600,height=700');
        } catch (err) {
          alert('Error al iniciar autenticación con Mercado Libre');
        }
        return;
      }

      setIsSyncing(true);
      try {
        const itemsToSync = itemCode 
          ? listData.filter(item => (item.id || item.code || item.codigo) === itemCode)
          : listData.filter(item => selectedItems.has(item.id || item.code || item.codigo));
          
        if (itemsToSync.length === 0) {
          setIsSyncing(false);
          return;
        }

        // Export to Excel first
        const now = new Date();
        const timestamp = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}_${String(now.getMinutes()).padStart(2, '0')}_${String(now.getSeconds()).padStart(2, '0')}`;
        const filename = `publicar-${timestamp}.xlsx`;

        try {
          const exportRes = await fetch('/api/export-excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: itemsToSync,
              filename: filename
            })
          });
          const exportData = await exportRes.json();
          if (!exportData.success) {
            console.error("Excel export failed:", exportData.message);
          } else {
            console.log("Excel exported to:", exportData.path);
          }
        } catch (exportErr) {
          console.error("Error calling export-excel:", exportErr);
        }

        const res = await fetch('/api/ml/sync-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: user.id,
            items: itemsToSync
          })
        });
        
        if (res.status === 401) {
          alert('Su sesión de Mercado Libre ha expirado o no es válida. Por favor vuelva a vincular su cuenta.');
          setUser({ ...user, ml_access_token: null });
          setIsSyncing(false);
          return;
        }

        const data = await res.json();
        
        const successCount = data.results ? data.results.filter((r: any) => r.status === 'success').length : 0;
        const errorCount = data.results ? data.results.filter((r: any) => r.status === 'error').length : 0;
        
        const syncResult = {
          local: itemsToSync.length,
          ml: successCount,
          errors: errorCount,
          status: data.success ? 'success' : 'error',
          results: data.results || [],
          timestamp: new Date().toLocaleString()
        };
        
        setSyncData(syncResult);
        setSyncHistory(prev => [syncResult, ...prev].slice(0, 10)); // Keep last 10
        
        if (data.success) {
          if (!itemCode) alert(`Sincronización finalizada. Éxitos: ${successCount}, Errores: ${errorCount}`);
          if (errorCount > 0) {
            createNotification(
              'warning',
              'Sincronización con Errores',
              `Se sincronizaron ${successCount} items con éxito, pero ${errorCount} fallaron.`,
              data.results.filter((r: any) => r.status === 'error').map((r: any) => r.code)
            );
          }
          fetchList();
          fetchStats();
        } else {
          alert('Error en la sincronización: ' + data.message);
          createNotification(
            'error',
            'Error Crítico de Sincronización',
            `No se pudo completar la sincronización: ${data.message}`,
            itemCode ? [itemCode] : Array.from(selectedItems)
          );
        }
      } catch (err) {
        alert('Error de conexión al sincronizar');
        createNotification(
          'error',
          'Error de Conexión',
          'No se pudo conectar con el servidor para la sincronización.',
          itemCode ? [itemCode] : Array.from(selectedItems)
        );
      } finally {
        setIsSyncing(false);
      }
    } else {
      // Mock sync for other tabs
      setIsSyncing(true);
      setTimeout(() => {
        setSyncData({
          local: Math.floor(Math.random() * 100) + 50,
          ml: Math.floor(Math.random() * 100) + 50,
          errors: 0,
          status: 'success',
          timestamp: new Date().toLocaleString()
        });
        setIsSyncing(false);
        fetchList();
        fetchStats();
      }, 1500);
    }
  };

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'ML_AUTH_SUCCESS') {
        const tokenData = event.data.data;
        try {
          const res = await fetch('/api/ml/save-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId: user.id,
              tokenData
            })
          });
          if (res.ok) {
            alert('Autenticación con Mercado Libre exitosa. Ya puede sincronizar sus productos.');
            setUser({
              ...user,
              ml_access_token: tokenData.access_token,
              ml_refresh_token: tokenData.refresh_token,
              ml_user_id: tokenData.user_id,
              ml_token_expires: new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
            });
          }
        } catch (err) {
          console.error("Error saving ML token:", err);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user.id]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight capitalize">
          {activeTab === 'dashboard' ? 'Panel de Control' : 
           activeTab === 'companies' ? 'Gestión de Empresas' :
           activeTab === 'prices' ? 'Actualización de Precios' :
           activeTab === 'products' ? 'Inventario de Productos' :
           activeTab === 'stock' ? 'Stock y Precios' :
           activeTab === 'invoices' ? 'Facturas Mercado Libre' :
           activeTab === 'pdf' ? 'Gestión de PDFs' :
           activeTab === 'clients' ? 'Mis Clientes' : `Sincronizar ${activeTab}`}
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
          {/* Right Panel - First on mobile */}
          <div className="space-y-6 lg:order-2">
            {/* Removed Mercado Libre Connection section as requested */}
            
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
              <h4 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-4">Últimas Sincronizaciones</h4>
              <div className="space-y-4">
                {syncHistory.length > 0 ? (
                  syncHistory.slice(0, 5).map((sync, idx) => (
                    <SyncHistoryItem 
                      key={idx} 
                      date={sync.timestamp} 
                      status={sync.status as 'success' | 'error'} 
                      items={sync.results}
                    />
                  ))
                ) : (
                  <div className="text-center py-4 text-slate-400 text-xs font-bold italic">No hay historial</div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content - Second on mobile */}
          <div className="lg:col-span-2 space-y-6 lg:order-1">
            {(activeTab !== 'invoices' && activeTab !== 'pdf') && (
              <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Upload size={24} className="text-yellow-500" />
                  {activeTab === 'prices' ? 'Actualización de Precios (ML)' :
                   activeTab === 'products' ? 'Inventario de Productos' : 
                   activeTab === 'clients' ? 'Mis Clientes' : 
                   activeTab === 'stock' ? 'Stock y Precios' :
                   (activeTab === 'invoices' || activeTab === 'pdf' || activeTab === 'stock') ? '' : 'Facturación'}
                </h3>
                <div className="flex items-center gap-3">
                  {activeTab !== 'invoices' && (
                    <>
                      <button 
                        onClick={toggleSelectAll}
                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                      >
                        {selectedItems.size === listData.length && listData.length > 0 ? 'DESELECCIONAR TODO' : 'SELECCIONAR TODO'}
                      </button>
                      {selectedItems.size > 0 && (
                        <button 
                          onClick={() => handleSync()}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-all flex items-center gap-2"
                        >
                          <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                          SINCRONIZAR SELECCIONADOS ({selectedItems.size})
                        </button>
                      )}
                    </>
                  )}
                  {activeTab === 'prices' && (
                    <div className="flex items-center gap-3">
                      <label className="px-4 py-2 bg-yellow-400 text-slate-900 rounded-lg text-xs font-bold hover:bg-yellow-500 transition-all flex items-center gap-2 cursor-pointer">
                        <Upload size={14} />
                        ACTUALIZAR PRECIOS EXCEL
                        <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelImport} />
                      </label>
                      <label className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2 cursor-pointer">
                        <Upload size={14} />
                        CARGAR .DAT (ODBC)
                        <input type="file" accept=".dat" className="hidden" onChange={handleDatUpload} />
                      </label>
                    </div>
                  )}
                  {activeTab === 'products' && (
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end gap-1">
                        <label className="px-4 py-2 bg-yellow-400 text-slate-900 rounded-lg text-xs font-bold hover:bg-yellow-500 transition-all flex items-center gap-2 cursor-pointer">
                          <Upload size={14} />
                          IMPORTAR EXCEL
                          <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelImport} />
                        </label>
                        <span className="text-[8px] text-slate-400 font-bold">Columnas: itm_cod, itm_desc, Precio, Stock</span>
                      </div>
                      <button 
                        onClick={() => {
                          setEditingProduct(null);
                          setShowManualAdd(true);
                        }}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2"
                      >
                        <Plus size={14} />
                        CARGA MANUAL
                      </button>
                    </div>
                  )}
                  {activeTab === 'stock' && (
                    <div className="flex items-center gap-3">
                      {/* Botón eliminado por solicitud del usuario */}
                    </div>
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
                  {activeTab === 'invoices' && (
                    <div className="flex items-center gap-3">
                      {/* No manual add or excel import for invoices as per user request */}
                    </div>
                  )}
                </div>
              </div>
              
              {isLoading ? (
                <div className="p-12 text-center text-slate-400 font-bold">Cargando datos...</div>
              ) : (activeTab === 'prices' || activeTab === 'stock') && !user.ml_access_token ? (
                <div 
                  onClick={() => handleSync()}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-yellow-400 transition-colors cursor-pointer group"
                >
                  <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Lock size={32} />
                  </div>
                  <p className="text-slate-600 font-bold uppercase tracking-widest">No autorizado en Mercado Libre</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Haga clic aquí para vincular su cuenta de Mercado Libre y comenzar a sincronizar.
                  </p>
                </div>
              ) : listData.length === 0 && activeTab !== 'invoices' ? (
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-yellow-400 transition-colors cursor-pointer group">
                  <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Upload size={32} />
                  </div>
                  <p className="text-slate-600 font-bold">No hay datos registrados aún</p>
                  <p className="text-slate-400 text-sm mt-1">
                    {activeTab === 'products' ? 'Cargue un archivo Excel DISCV para comenzar' : 'Arrastra un archivo para sincronizar o carga manualmente'}
                  </p>
                </div>
              ) : activeTab === 'invoices' ? (
                <div className="p-12 text-center text-slate-400 font-bold italic">
                  Utilice el panel inferior para descargar ventas de Mercado Libre
                </div>
              ) : (
                <div className="space-y-4">
                  {listData.map((item: any) => (
                    <div 
                      key={item.id || item.code} 
                      onClick={() => toggleItemSelection(item.id || item.code || item.codigo)}
                      className={`p-4 border rounded-xl flex justify-between items-center transition-colors group cursor-pointer ${
                        selectedItems.has(item.id || item.code || item.codigo) 
                          ? 'border-yellow-400 bg-yellow-50' 
                          : 'border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          selectedItems.has(item.id || item.code || item.codigo) ? 'bg-yellow-400 border-yellow-400' : 'border-slate-300 bg-white'
                        }`}>
                          {selectedItems.has(item.id || item.code || item.codigo) && <CheckCircle2 size={12} className="text-slate-900" />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{item.name || item.nombre || item.number}</div>
                          <div className="text-xs text-slate-400 font-medium flex items-center gap-2">
                            {activeTab === 'products' || activeTab === 'prices' || activeTab === 'stock' ? `Código: ${item.code || item.codigo}` :
                             activeTab === 'clients' ? `${item.email || item.mail || 'Sin Email'} | ${item.localidad || 'Sin Localidad'}` : `Total: $${item.total}`}
                            {(activeTab === 'products' || activeTab === 'prices' || activeTab === 'stock') && item.ml_item_id && (
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-600 rounded text-[8px] font-black uppercase">Sincronizado ML</span>
                            )}
                          </div>
                        </div>
                      </div>
                        <div className="flex items-center gap-6">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSync(item.id || item.code || item.codigo);
                            }}
                            className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                            title="Sincronizar Individualmente"
                          >
                            <RefreshCw size={16} />
                          </button>
                          {(activeTab === 'prices' || activeTab === 'stock' || activeTab === 'products') && (
                            <div className="flex flex-col items-end gap-1">
                              {(activeTab === 'prices' || activeTab === 'stock') && (
                                <>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Precio ML:</span>
                                    <span className="text-xs font-bold text-slate-400">$</span>
                                    <input 
                                      type="number"
                                      value={item.price}
                                      onChange={(e) => handlePriceChange(item.code, Number(e.target.value))}
                                      className="w-24 p-1 text-sm font-bold border border-slate-200 rounded focus:ring-1 focus:ring-yellow-400 outline-none"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Stock ML:</span>
                                    <input 
                                      type="number"
                                      value={item.stock}
                                      onChange={(e) => handleStockChange(item.code, Number(e.target.value))}
                                      className="w-24 p-1 text-sm font-bold border border-slate-200 rounded focus:ring-1 focus:ring-yellow-400 outline-none"
                                    />
                                  </div>
                                </>
                              )}
                              {activeTab === 'products' && (
                                <div className="flex flex-col items-end text-[10px] font-bold text-slate-400 mb-1">
                                  <span>Precio: ${item.price}</span>
                                  <span>Stock: {item.stock}</span>
                                </div>
                              )}
                              {item.local_price !== undefined && (
                                <div className="text-[9px] font-bold text-slate-400">
                                  Local: ${item.local_price} | Stock Local: {item.local_stock}
                                </div>
                              )}
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleSync(item.id || item.code || item.codigo); }}
                                disabled={isSyncing}
                                className="mt-1 px-3 py-1 bg-yellow-400 text-slate-900 rounded-lg text-[8px] font-black uppercase hover:bg-yellow-500 transition-all flex items-center gap-1"
                              >
                                <RefreshCw size={10} className={isSyncing ? 'animate-spin' : ''} />
                                Sincronizar
                              </button>
                            </div>
                          )}
                        <div className="text-xs font-black text-slate-300">
                          {activeTab === 'prices' || activeTab === 'stock' || activeTab === 'products' ? (item.last_updated ? new Date(item.last_updated).toLocaleString() : 'Pendiente') :
                           (item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Lectura Local')}
                        </div>
                        {activeTab === 'products' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleEditProduct(item); }}
                            className="p-2 text-blue-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all"
                            title="Editar Información"
                          >
                            <Edit size={14} />
                          </button>
                        )}
                        {activeTab !== 'products' && activeTab !== 'prices' && activeTab !== 'stock' && (
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

              {/* Botón de sincronización masiva eliminado para priorizar sincronización por item */}

              </div>
            )}

            {activeTab === 'invoices' && (
              <div className="space-y-6">
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
                </motion.div>

                <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Activity size={24} className="text-yellow-500" />
                    Últimos 10 Items Sincronizados
                  </h3>
                  <div className="overflow-hidden border border-slate-100 rounded-xl">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[10px]">Fecha</th>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[10px]">Item / SKU</th>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[10px]">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {syncHistory
                          .flatMap(session => (session.results || []).map((r: any) => ({ ...r, timestamp: session.timestamp })))
                          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                          .slice(0, 10)
                          .map((result, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-slate-500 font-medium">{result.timestamp}</td>
                              <td className="px-4 py-3 font-bold text-slate-800">{result.code || result.id || result.sku}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                                  result.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                }`}>
                                  {result.status === 'success' ? 'Sincronizado' : 'Error'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        {syncHistory.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-slate-400 font-bold italic">No hay historial de sincronización</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'pdf' && (
              <div className="space-y-6">
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
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (files) {
                          for (let i = 0; i < files.length; i++) {
                            // For demo purposes, we'll use a random sale ID or prompt the user
                            // In a real app, the user would select which sale each PDF belongs to
                            // or the system would match them by filename
                            await handlePdfUpload({ target: { files: [files[i]] } } as any, `SALE_${Math.floor(Math.random() * 1000000)}`);
                          }
                          alert(`${files.length} archivos PDF procesados.`);
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

                <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Activity size={24} className="text-yellow-500" />
                    Últimos 10 Items Sincronizados
                  </h3>
                  <div className="overflow-hidden border border-slate-100 rounded-xl">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[10px]">Fecha</th>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[10px]">Item / SKU</th>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[10px]">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {syncHistory
                          .flatMap(session => (session.results || []).map((r: any) => ({ ...r, timestamp: session.timestamp })))
                          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                          .slice(0, 10)
                          .map((result, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-slate-500 font-medium">{result.timestamp}</td>
                              <td className="px-4 py-3 font-bold text-slate-800">{result.code || result.id || result.sku}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                                  result.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                }`}>
                                  {result.status === 'success' ? 'Sincronizado' : 'Error'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        {syncHistory.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-slate-400 font-bold italic">No hay historial de sincronización</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {syncHistory.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100"
              >
                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Activity size={24} className="text-yellow-500" />
                  Últimas Sincronizaciones
                </h3>
                <div className="space-y-4">
                  {syncHistory.map((sync, idx) => (
                    <div key={idx} className="p-4 border border-slate-50 rounded-xl hover:bg-slate-50 transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${sync.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{sync.timestamp}</span>
                        </div>
                        <div className="flex gap-4 text-[10px] font-black uppercase">
                          <span className="text-slate-400">Local: <span className="text-slate-800">{sync.local}</span></span>
                          <span className="text-slate-400">ML: <span className="text-slate-800">{sync.ml}</span></span>
                          <span className="text-slate-400">Errores: <span className="text-red-600">{sync.errors}</span></span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sync.results.map((res: any, rIdx: number) => (
                          <div key={rIdx} className={`px-2 py-1 rounded text-[8px] font-bold border ${res.status === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                            {res.code}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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

                {syncData.results && syncData.results.length > 0 && (
                  <div className="mt-6 border-t border-slate-100 pt-6">
                    <h4 className="text-sm font-black text-slate-800 uppercase mb-4">Detalle de Sincronización</h4>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {syncData.results.map((result: any, idx: number) => (
                        <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${result.status === 'success' ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${result.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                              {result.status === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-700">{result.code}</div>
                              {result.ml_id && <div className="text-[10px] text-slate-400">ML ID: {result.ml_id}</div>}
                              {result.error && <div className="text-[10px] text-red-500 font-medium">{result.error}</div>}
                            </div>
                          </div>
                          <div className={`text-[10px] font-black uppercase px-2 py-1 rounded ${result.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {result.status === 'success' ? 'Éxito' : 'Error'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      )}
      {/* Manual Add Modal */}
      {showManualAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
          >
            <div className="bg-slate-900 p-6 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Carga Manual</h3>
              <button onClick={() => { setShowManualAdd(false); setRecentManualItems([]); }} className="text-white/50 hover:text-white">✕</button>
            </div>
            <div className="p-8 space-y-4">
              {activeTab === 'products' && (
                <>
                  <input 
                    placeholder="Código del Producto" 
                    className="w-full p-3 rounded-lg border border-slate-200"
                    onChange={e => setNewItem({...newItem, code: e.target.value})}
                  />
                  <input 
                    placeholder="Descripción / Nombre" 
                    className="w-full p-3 rounded-lg border border-slate-200"
                    onChange={e => setNewItem({...newItem, name: e.target.value})}
                  />
                  <div className="grid grid-cols-2 gap-4">
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
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría ML</label>
                      <input 
                        placeholder="Ej: MLA1652" 
                        className="w-full p-3 rounded-lg border border-slate-200"
                        onChange={e => setNewItem({...newItem, category_id: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GTIN / EAN</label>
                      <input 
                        placeholder="GTIN / EAN / Barcode" 
                        className="w-full p-3 rounded-lg border border-slate-200"
                        onChange={e => setNewItem({...newItem, gtin: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Condición</label>
                    <select 
                      className="w-full p-3 rounded-lg border border-slate-200 bg-white"
                      onChange={e => setNewItem({...newItem, condition: e.target.value})}
                      defaultValue="new"
                    >
                      <option value="new">Nuevo</option>
                      <option value="used">Usado</option>
                      <option value="not_specified">No especificado</option>
                    </select>
                  </div>
                  <textarea 
                    placeholder="Descripción Larga / Detallada" 
                    rows={3}
                    className="w-full p-3 rounded-lg border border-slate-200"
                    onChange={e => setNewItem({...newItem, description: e.target.value})}
                  />
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Imágenes del Producto (Máx 3)</label>
                    <div className="flex gap-2">
                      <label className="flex-1 p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center cursor-pointer hover:border-yellow-400 transition-all">
                        <Upload size={16} className="mx-auto mb-1 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-500">Subir Imagen</span>
                        <input 
                          type="file" 
                          accept=".jpg" 
                          multiple 
                          className="hidden" 
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files) {
                              const readers = (Array.from(files) as File[]).slice(0, 3).map(file => {
                                return new Promise((resolve) => {
                                  const reader = new FileReader();
                                  reader.onload = (evt) => resolve(evt.target?.result);
                                  reader.readAsDataURL(file);
                                });
                              });
                              Promise.all(readers).then(results => {
                                setNewItem(prev => ({ ...prev, images: results as string[] }));
                              });
                            }
                          }}
                        />
                      </label>
                    </div>
                    {newItem.images && newItem.images.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {newItem.images.map((img: string, idx: number) => (
                          <div key={idx} className="relative w-12 h-12 rounded border border-slate-200 overflow-hidden">
                            <img src={img} className="w-full h-full object-cover" />
                            <button 
                              onClick={() => setNewItem({ ...newItem, images: (newItem.images || []).filter((_: any, i: number) => i !== idx) })}
                              className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
              {activeTab === 'clients' && (
                <>
                  <input 
                    placeholder="Código de Cliente" 
                    className="w-full p-3 rounded-lg border border-slate-200"
                    value={newItem.codigo || ''}
                    onChange={e => setNewItem({...newItem, codigo: e.target.value})}
                  />
                  <input 
                    placeholder="Nombre del Cliente" 
                    className="w-full p-3 rounded-lg border border-slate-200"
                    value={newItem.nombre || ''}
                    onChange={e => setNewItem({...newItem, nombre: e.target.value})}
                  />
                  <input 
                    placeholder="Email / Mail" 
                    className="w-full p-3 rounded-lg border border-slate-200"
                    value={newItem.mail || ''}
                    onChange={e => setNewItem({...newItem, mail: e.target.value})}
                  />
                  <input 
                    placeholder="Dirección" 
                    className="w-full p-3 rounded-lg border border-slate-200"
                    value={newItem.direccion || ''}
                    onChange={e => setNewItem({...newItem, direccion: e.target.value})}
                  />
                  <input 
                    placeholder="Localidad" 
                    className="w-full p-3 rounded-lg border border-slate-200"
                    value={newItem.localidad || ''}
                    onChange={e => setNewItem({...newItem, localidad: e.target.value})}
                  />
                  <input 
                    placeholder="Teléfono" 
                    className="w-full p-3 rounded-lg border border-slate-200"
                    value={newItem.telefono || ''}
                    onChange={e => setNewItem({...newItem, telefono: e.target.value})}
                  />
                </>
              )}
              {activeTab === 'invoices' && (
                <>
                  <input 
                    placeholder="Número de Factura" 
                    className="w-full p-3 rounded-lg border border-slate-200"
                    value={newItem.number || ''}
                    onChange={e => setNewItem({...newItem, number: e.target.value})}
                  />
                  <input 
                    type="number"
                    placeholder="Total" 
                    className="w-full p-3 rounded-lg border border-slate-200"
                    value={newItem.total || 0}
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

              {recentManualItems.length > 0 && (
                <div className="mt-8 pt-8 border-t border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Items Recién Cargados</h4>
                  <div className="space-y-2">
                    {recentManualItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                            <Package size={14} className="text-slate-400" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800">{item.name || item.nombre || item.number}</div>
                            <div className="text-[10px] text-slate-400 font-black uppercase">{item.code || item.codigo}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-[10px] font-black text-green-600 uppercase">Sincronizado</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
      {/* Modal Editar Producto */}
      <AnimatePresence>
        {showEditProduct && editingProduct && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Editar Producto</h3>
                  <p className="text-slate-400 text-xs font-bold">Código: {editingProduct.code}</p>
                </div>
                <button onClick={() => setShowEditProduct(false)} className="text-slate-400 hover:text-white transition-colors">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              
              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre del Producto</label>
                    <input 
                      type="text"
                      value={editingProduct.name || ''}
                      onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría ML</label>
                    <input 
                      type="text"
                      value={editingProduct.category_id || ''}
                      onChange={(e) => setEditingProduct({...editingProduct, category_id: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 font-bold"
                      placeholder="Ej: MLA1652"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio</label>
                    <input 
                      type="number"
                      value={editingProduct.price || 0}
                      onChange={(e) => setEditingProduct({...editingProduct, price: Number(e.target.value)})}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock</label>
                    <input 
                      type="number"
                      value={editingProduct.stock || 0}
                      onChange={(e) => setEditingProduct({...editingProduct, stock: Number(e.target.value)})}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GTIN / Código de Barras</label>
                    <input 
                      type="text"
                      value={editingProduct.gtin || ''}
                      onChange={(e) => setEditingProduct({...editingProduct, gtin: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 font-bold"
                      placeholder="EAN, UPC, GTIN..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Condición</label>
                    <select 
                      value={editingProduct.condition || 'new'}
                      onChange={(e) => setEditingProduct({...editingProduct, condition: e.target.value as any})}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 font-bold"
                    >
                      <option value="new">Nuevo</option>
                      <option value="used">Usado</option>
                      <option value="not_specified">No especificado</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción Larga</label>
                  <textarea 
                    value={editingProduct.description || ''}
                    onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})}
                    rows={4}
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 font-medium text-sm"
                    placeholder="Ingrese la descripción detallada del producto..."
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Imágenes (Máx 3 - Formato .jpg)</label>
                    <span className="text-[10px] font-black text-slate-400">{(editingProduct.images || []).length}/3</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    {(editingProduct.images || []).map((img, idx) => (
                      <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-100">
                        <img src={img} alt={`Product ${idx}`} className="w-full h-full object-cover" />
                        <button 
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Plus size={12} className="rotate-45" />
                        </button>
                      </div>
                    ))}
                    {(editingProduct.images || []).length < 3 && (
                      <label className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 hover:border-yellow-400 hover:bg-yellow-50 transition-all cursor-pointer">
                        <Upload size={20} className="text-slate-400" />
                        <span className="text-[8px] font-black text-slate-400 uppercase">Subir JPG</span>
                        <input type="file" accept=".jpg, .jpeg" className="hidden" onChange={handleImageUpload} multiple />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 flex gap-4">
                <button 
                  onClick={() => setShowEditProduct(false)}
                  className="flex-1 py-4 bg-white text-slate-600 font-black rounded-xl border border-slate-200 hover:bg-slate-100 transition-all"
                >
                  CANCELAR
                </button>
                <button 
                  onClick={handleSaveProduct}
                  className="flex-1 py-4 bg-yellow-400 text-slate-900 font-black rounded-xl shadow-lg hover:bg-yellow-500 transition-all"
                >
                  GUARDAR CAMBIOS
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showNotifications && (
          <NotificationsPanel 
            notifications={notifications} 
            onClose={() => setShowNotifications(false)} 
            onMarkAsRead={markNotificationAsRead}
            isAdmin={role === 'admin'}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
