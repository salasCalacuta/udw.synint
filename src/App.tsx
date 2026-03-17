import React, { useState, useEffect, createContext, useContext, Component, ErrorInfo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { UserProfile, SyncLog } from './types';
import { supabase } from './lib/supabase';
import { 
  LayoutDashboard, 
  Package, 
  Settings, 
  History, 
  LogOut, 
  LogIn, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2,
  ExternalLink,
  Plus,
  ArrowRight,
  FileText,
  Upload,
  Search,
  Building2,
  Trash2,
  XCircle,
  Edit,
  Eye,
  DollarSign,
  Phone,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- LocalStorage Helpers ---

const STORAGE_KEYS = {
  USERS: 'meli_sync_users',
  LOGS: 'meli_sync_logs',
  MELI_DATA: 'meli_sync_data',
  CURRENT_USER: 'meli_sync_current_user'
};

const getLocalData = (key: string) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

const setLocalData = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorInfo: string;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorInfo: '' };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message || 'Error desconocido' };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-zinc-950 p-6 text-center">
          <div className="max-w-md w-full bg-zinc-900 border border-red-500/20 rounded-3xl p-8">
            <AlertCircle className="text-red-500 w-12 h-12 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Algo salió mal</h2>
            <p className="text-zinc-400 mb-6 text-sm">
              Se produjo un error inesperado en la aplicación.
            </p>
            <div className="bg-black/50 rounded-xl p-4 mb-6 text-left overflow-auto max-h-32">
              <code className="text-red-400 text-xs">{this.state.errorInfo}</code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-2xl transition-all"
            >
              Reiniciar Aplicación
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Auth Context ---
interface AuthContextType {
  user: { uid: string; email: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email?: string, password?: string) => Promise<void>;
  register: (email: string, password: string, extraData?: Partial<UserProfile>) => Promise<UserProfile>;
  logout: () => Promise<void>;
  connectMeli: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

const ADMIN_EMAILS = ['udw.desarrollos@gmail.com', 'admin@udw.com'];
const isAdminEmail = (email: string) => 
  ADMIN_EMAILS.includes(email) || 
  email.includes('udw-admin') || 
  email.includes('udwadmin');

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<{ uid: string; email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  const ensureAdminRole = async (id: string, email: string, currentProfile: any) => {
    if (isAdminEmail(email) && currentProfile?.role !== 'admin') {
      console.log('Enforcing admin role for:', email);
      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update({ role: 'admin', status: 'activo' })
        .eq('id', id)
        .select()
        .single();
      
      if (!error && updatedProfile) {
        return updatedProfile;
      }
    }
    return currentProfile;
  };

  useEffect(() => {
    const initAuth = async () => {
      // 1. Check for auto-login parameter (Admin viewing client)
      const autoLoginUid = searchParams.get('autologin');
      if (autoLoginUid) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', autoLoginUid)
          .single();
        
        if (profileData) {
          const currentUser = { uid: profileData.id, email: profileData.email };
          setUser(currentUser);
          setProfile(profileData as any);
          setLoading(false);
          return;
        }
      }

      // 2. Check Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const currentUser = { uid: session.user.id, email: session.user.email || '' };
        setUser(currentUser);
        
        let { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        profileData = await ensureAdminRole(session.user.id, session.user.email || '', profileData);
        setProfile(profileData as any);
      }
      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const currentUser = { uid: session.user.id, email: session.user.email || '' };
        setUser(currentUser);
        let { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        profileData = await ensureAdminRole(session.user.id, session.user.email || '', profileData);
        setProfile(profileData as any);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [searchParams]);

  const login = async (email?: string, password?: string) => {
    if (!email || !password) throw new Error("Email y contraseña requeridos");
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    
    if (data.user) {
      let { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      
      profileData = await ensureAdminRole(data.user.id, data.user.email || '', profileData);
      
      setUser({ uid: data.user.id, email: data.user.email || '' });
      setProfile(profileData as any);
    }
  };

  const register = async (email: string, password: string, extraData: Partial<UserProfile> = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error("Error al crear usuario");

    const isAdmin = isAdminEmail(email);
    
    const newProfile = {
      id: data.user.id,
      email,
      role: isAdmin ? 'admin' : 'user',
      status: isAdmin ? 'activo' : 'pendiente',
      subscription_status: 'pendiente',
      meli_connected: false,
      report_count: 0,
      meli_sync_status: 'OK',
      ...extraData
    };

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(newProfile);

    if (profileError) throw profileError;
    
    return newProfile as any;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const connectMeli = async () => {
    try {
      const response = await fetch('/api/auth/url');
      const { url } = await response.json();
      const authWindow = window.open(url, 'meli_oauth', 'width=600,height=700');
      
      if (!authWindow) {
        alert("Por favor, permite las ventanas emergentes para conectar con Mercado Libre.");
      }
    } catch (error) {
      console.error("Error connecting to Meli:", error);
    }
  };

  // Listen for OAuth success message
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && user) {
        const { tokens } = event.data;
        
        try {
          const { data: updatedProfile, error } = await supabase
            .from('profiles')
            .update({
              meli_connected: true,
              meli_user_id: tokens.user_id.toString(),
              meli_access_token: tokens.access_token,
              meli_refresh_token: tokens.refresh_token,
              meli_sync_status: 'OK'
            })
            .eq('id', user.uid)
            .select()
            .single();

          if (error) throw error;
          
          if (updatedProfile) {
            setProfile(updatedProfile as any);
            alert('Conexión con Mercado Libre exitosa');
          }
        } catch (err: any) {
          console.error('Error saving Meli tokens:', err);
          alert('Error al guardar la conexión con Mercado Libre: ' + err.message);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, logout, connectMeli }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Components ---

const Sidebar = () => {
  const { logout, profile } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Productos', path: '/products', icon: Package },
    { name: 'Facturas', path: '/invoices', icon: FileText },
    { name: 'Clientes', path: '/customers', icon: Building2 },
    { name: 'Sincronización', path: '/sync', icon: RefreshCw },
    { name: 'Historial', path: '/history', icon: History },
  ];

  const adminItems = [
    { name: 'Gestión Usuarios', path: '/admin/users', icon: Settings },
    { name: 'Solicitudes', path: '/admin/requests', icon: AlertCircle },
    { name: 'Abonos', path: '/admin/subscriptions', icon: FileText },
  ];

  return (
    <div className="w-64 bg-yellow-400 text-black flex flex-col h-screen border-r border-yellow-500">
      <div className="p-6">
        <h1 className="text-xl font-bold text-black flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <RefreshCw className="text-yellow-400 w-5 h-5" />
          </div>
          SynInt
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {profile?.role === 'user' && (
          <>
            <p className="px-4 text-[10px] font-bold text-black/40 uppercase tracking-widest mb-2">Menú</p>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive 
                      ? 'bg-black text-yellow-400 font-medium shadow-lg shadow-black/10' 
                      : 'hover:bg-black/5 hover:text-black'
                  }`}
                >
                  <item.icon size={20} />
                  {item.name}
                </Link>
              );
            })}
          </>
        )}

        {profile?.role === 'admin' && (
          <>
            <div className="mt-6 mb-2 px-4">
              <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest">Administración</p>
            </div>
            {adminItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive 
                      ? 'bg-black text-yellow-400 font-medium shadow-lg shadow-black/10' 
                      : 'hover:bg-black/5 hover:text-black'
                  }`}
                >
                  <item.icon size={20} />
                  {item.name}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-yellow-500">
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-yellow-400 font-bold text-xs">
            {profile?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm text-black font-bold truncate">{profile?.email}</p>
            <p className="text-[10px] text-black/60 uppercase tracking-wider">
              {profile?.role === 'admin' ? 'Administrador' : (profile?.meli_connected ? 'Conectado' : 'Desconectado')}
            </p>
          </div>
        </div>
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-black/60 hover:bg-black/10 hover:text-black transition-all"
        >
          <LogOut size={20} />
          Cerrar Sesión
        </button>
      </div>
      <div className="px-6 py-2">
        <p className="text-[9px] text-black/30 uppercase font-bold tracking-tighter">
          Local Storage Mode
        </p>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center bg-zinc-950 text-white">Cargando...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
};

// --- Admin Components ---

const AdminUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    company_name: '',
    phone: '',
    status: 'activo' as const,
    subscription_status: 'pendiente' as const
  });

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'user');
    
    if (error) {
      console.error('Error loading users:', error);
    } else {
      // Map Supabase fields to UserProfile interface
      const mappedUsers = data.map((u: any) => ({
        uid: u.id,
        ...u
      }));
      setUsers(mappedUsers);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const updateStatus = async (uid: string, status: any) => {
    const { error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', uid);
    
    if (error) console.error(error);
    else loadUsers();
  };

  const updateSubscription = async (uid: string, subscription_status: any) => {
    const { error } = await supabase
      .from('profiles')
      .update({ subscription_status })
      .eq('id', uid);
    
    if (error) console.error(error);
    else loadUsers();
  };

  const handleDeleteUser = async (uid: string) => {
    // El botón de eliminar no hace nada por requerimiento
    console.log('Intento de eliminar usuario:', uid);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    // For adding a user manually, we'd use supabase.auth.admin or just a profile insert if auth is handled elsewhere.
    // Since we don't have admin auth keys here, we'll just insert the profile.
    const uid = Math.random().toString(36).substring(7); // Placeholder for real auth id
    
    const profileData = {
      id: uid,
      email: newUser.email,
      company_name: newUser.company_name,
      phone: newUser.phone,
      role: 'user',
      status: newUser.status,
      subscription_status: newUser.subscription_status,
      report_count: 0,
      meli_sync_status: 'OK',
      meli_connected: false,
      debt_amount: 0
    };

    const { error } = await supabase.from('profiles').insert(profileData);
    if (error) console.error(error);
    else {
      loadUsers();
      setShowAddModal(false);
      setNewUser({
        email: '',
        password: '',
        company_name: '',
        phone: '',
        status: 'activo',
        subscription_status: 'pendiente'
      });
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    const { error } = await supabase
      .from('profiles')
      .update({
        company_name: editingUser.company_name,
        responsible_name: editingUser.responsible_name,
        email: editingUser.email,
        phone: editingUser.phone,
        status: editingUser.status,
        subscription_status: editingUser.subscription_status
      })
      .eq('id', editingUser.uid);

    if (error) console.error(error);
    else {
      loadUsers();
      setShowEditModal(false);
      setEditingUser(null);
    }
  };

  const openDashboard = (uid: string) => {
    // Direct access with autologin parameter
    window.open(`/?autologin=${uid}`, '_blank');
  };

  const syncToSupabase = async () => {
    setLoading(true);
    try {
      const allUsers = getLocalData(STORAGE_KEYS.USERS) || {};
      const uids = Object.keys(allUsers);
      
      let successCount = 0;
      for (const uid of uids) {
        const u = allUsers[uid];
        const { error } = await supabase.from('profiles').upsert({
          id: uid,
          email: u.email,
          company_name: u.company_name,
          responsible_name: u.responsible_name,
          phone: u.phone,
          role: u.role || 'user',
          status: u.status || 'pendiente',
          subscription_status: u.subscription_status || 'pendiente',
          local_system_config: u.local_system_config || {}
        });
        if (!error) successCount++;
      }
      
      alert(`Sincronización completada: ${successCount} perfiles actualizados en Supabase.`);
      loadUsers();
    } catch (err: any) {
      alert('Error en la sincronización: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-black">Gestión de Usuarios</h2>
          <p className="text-black/60">Administra los clientes activos y sus estados.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={syncToSupabase}
            disabled={loading}
            className="bg-zinc-100 text-zinc-600 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-200 transition-all"
            title="Sincronizar datos locales con Supabase"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={20} />
            Sincronizar Supabase
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-black text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg shadow-black/10"
          >
            <Plus size={20} />
            Nuevo Usuario
          </button>
        </div>
      </header>

      <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Empresa / Responsable</th>
                <th className="px-6 py-4 font-medium">Estado</th>
                <th className="px-6 py-4 font-medium">Abono</th>
                <th className="px-6 py-4 font-medium">Reportes</th>
                <th className="px-6 py-4 font-medium">Meli</th>
                <th className="px-6 py-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map(u => (
                <tr key={u.uid} className="hover:bg-zinc-50 transition-all">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-black">{u.company_name || 'Sin Nombre'}</span>
                      <span className="text-xs text-black/60 font-medium">{u.responsible_name || 'Sin Responsable'}</span>
                      <span className="text-[10px] text-black/40">{u.email}</span>
                      {u.phone && <span className="text-[10px] text-zinc-400 flex items-center gap-1"><Phone size={10}/> {u.phone}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={u.status || 'pendiente'} 
                      onChange={(e) => updateStatus(u.uid, e.target.value)}
                      className={`text-xs border-none rounded-lg px-2 py-1 focus:ring-2 focus:ring-yellow-400 font-bold ${
                        u.status === 'activo' ? 'bg-emerald-100 text-emerald-700' : 
                        u.status === 'pasivo' ? 'bg-zinc-100 text-zinc-700' : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      <option value="activo">Activo</option>
                      <option value="pasivo">Pasivo</option>
                      <option value="pendiente">Pendiente</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={u.subscription_status || 'pendiente'} 
                      onChange={(e) => updateSubscription(u.uid, e.target.value)}
                      className={`text-xs border-none rounded-lg px-2 py-1 focus:ring-2 focus:ring-yellow-400 font-bold ${
                        u.subscription_status === 'pagado' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      <option value="pagado">Pagado</option>
                      <option value="pendiente">Pendiente</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <FileText size={14} />
                      <span className="text-sm font-medium">{u.report_count || 0}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                      u.meli_sync_status === 'OK' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                    }`}>
                      {u.meli_sync_status || 'OK'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => openDashboard(u.uid)}
                        className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Ver Dashboard"
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => { setEditingUser(u); setShowEditModal(true); }}
                        className="p-2 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                        title="Editar Datos"
                      >
                        <Edit size={16} />
                      </button>
                      <Link 
                        to={`/admin/config/${u.uid}`}
                        className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        title="Configurar Credenciales"
                      >
                        <Settings size={16} />
                      </Link>
                      <button 
                        onClick={() => handleDeleteUser(u.uid)}
                        className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Eliminar Empresa"
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
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-black">Nuevo Usuario</h3>
                <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-black">
                  <XCircle size={24} />
                </button>
              </div>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Nombre Empresa</label>
                  <input 
                    required
                    type="text" 
                    value={newUser.company_name}
                    onChange={(e) => setNewUser({...newUser, company_name: e.target.value})}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                    placeholder="Ej: Tech Solutions"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Email</label>
                  <input 
                    required
                    type="email" 
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                    placeholder="ejemplo@correo.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Teléfono</label>
                  <input 
                    type="tel" 
                    value={newUser.phone}
                    onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                    placeholder="+54 9 11 ..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Contraseña</label>
                  <input 
                    required
                    type="password" 
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Estado</label>
                    <select 
                      value={newUser.status}
                      onChange={(e) => setNewUser({...newUser, status: e.target.value as any})}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                    >
                      <option value="activo">Activo</option>
                      <option value="pasivo">Pasivo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Abono</label>
                    <select 
                      value={newUser.subscription_status}
                      onChange={(e) => setNewUser({...newUser, subscription_status: e.target.value as any})}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                    >
                      <option value="pagado">Pagado</option>
                      <option value="pendiente">Pendiente</option>
                    </select>
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-black text-white font-bold py-4 rounded-2xl mt-4 hover:bg-zinc-800 transition-all shadow-lg shadow-black/10"
                >
                  Crear Usuario
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {showEditModal && editingUser && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-black">Editar Empresa</h3>
                <button onClick={() => { setShowEditModal(false); setEditingUser(null); }} className="text-zinc-400 hover:text-black">
                  <XCircle size={24} />
                </button>
              </div>
              <form onSubmit={handleEditUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Nombre Empresa</label>
                  <input 
                    required
                    type="text" 
                    value={editingUser.company_name}
                    onChange={(e) => setEditingUser({...editingUser, company_name: e.target.value})}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Email</label>
                  <input 
                    required
                    type="email" 
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Teléfono</label>
                  <input 
                    type="tel" 
                    value={editingUser.phone || ''}
                    onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Contraseña</label>
                  <input 
                    required
                    type="text" 
                    value={editingUser.password || ''}
                    onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-black text-white font-bold py-4 rounded-2xl mt-4 hover:bg-zinc-800 transition-all shadow-lg shadow-black/10"
                >
                  Guardar Cambios
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminAbonos = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'user');
    
    if (error) console.error(error);
    else {
      setUsers(data.map((u: any) => ({ uid: u.id, ...u })));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const updateAmount = async (uid: string, field: 'total_amount' | 'paid_amount', value: number) => {
    const user = users.find(u => u.uid === uid);
    if (!user) return;

    const total = field === 'total_amount' ? value : (user.total_amount || 0);
    const paid = field === 'paid_amount' ? value : (user.paid_amount || 0);
    const debt = total - paid;
    const subscription_status = debt <= 0 ? 'pagado' : 'pendiente';

    const { error } = await supabase
      .from('profiles')
      .update({
        [field]: value,
        debt_amount: debt,
        subscription_status
      })
      .eq('id', uid);
    
    if (error) console.error(error);
    else loadUsers();
  };

  return (
    <div className="p-8 space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-black">Control de Abonos</h2>
        <p className="text-black/60">Seguimiento de pagos y deudas de clientes.</p>
      </header>

      <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Empresa</th>
                <th className="px-6 py-4 font-medium">Estado</th>
                <th className="px-6 py-4 font-medium">Abono</th>
                <th className="px-6 py-4 font-medium">Monto</th>
                <th className="px-6 py-4 font-medium">Pagos</th>
                <th className="px-6 py-4 font-medium">Deuda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map(u => (
                <tr key={u.uid} className="hover:bg-zinc-50 transition-all">
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-black">{u.company_name || 'Sin Nombre'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                      u.status === 'activo' ? 'bg-emerald-100 text-emerald-700' : 
                      u.status === 'pasivo' ? 'bg-zinc-100 text-zinc-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                      u.subscription_status === 'pagado' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {u.subscription_status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-400 text-xs">$</span>
                      <input 
                        type="number" 
                        value={u.total_amount || 0}
                        onChange={(e) => updateAmount(u.uid, 'total_amount', parseFloat(e.target.value))}
                        className="w-20 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-xs text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-400 text-xs">$</span>
                      <input 
                        type="number" 
                        value={u.paid_amount || 0}
                        onChange={(e) => updateAmount(u.uid, 'paid_amount', parseFloat(e.target.value))}
                        className="w-20 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-xs text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                      <button className="p-1 text-zinc-400 hover:text-black transition-all" title="Cargar Comprobante">
                        <Upload size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-bold ${u.debt_amount && u.debt_amount > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      ${u.debt_amount || 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ClientDashboardView = () => {
  const { userId } = useParams<{ userId: string }>();
  const [clientProfile, setClientProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      const fetchClient = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (data) {
          setClientProfile(data as any);
        }
        setLoading(false);
      };
      fetchClient();
    }
  }, [userId]);

  if (loading) return <div className="p-8">Cargando dashboard del cliente...</div>;
  if (!clientProfile) return <div className="p-8 text-red-500">Cliente no encontrado.</div>;

  return <Dashboard clientProfile={clientProfile} />;
};

const AdminRequests = () => {
  const [requests, setRequests] = useState<UserProfile[]>([]);

  const loadRequests = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'pendiente');
    
    if (error) console.error(error);
    else setRequests(data.map((u: any) => ({ uid: u.id, ...u })));
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const approve = async (uid: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'activo' })
      .eq('id', uid);
    
    if (error) console.error(error);
    else loadRequests();
  };

  const deny = async (uid: string) => {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', uid);
    
    if (error) console.error(error);
    else loadRequests();
  };

  return (
    <div className="p-8 space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-black">Solicitudes Pendientes</h2>
        <p className="text-black/60">Nuevos registros que requieren aprobación.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {requests.map(r => (
          <div key={r.uid} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-2xl flex items-center justify-center text-yellow-600">
                  <Building2 size={24} />
                </div>
                <div>
                  <p className="text-black font-bold">{r.company_name || 'Sin Empresa'}</p>
                  <p className="text-xs text-black/40">{r.email}</p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Key size={14} />
                  <span className="font-medium">Resp:</span> {r.responsible_name || 'N/A'}
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Phone size={14} />
                  <span className="font-medium">Tel:</span> {r.phone || 'N/A'}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button 
                onClick={() => approve(r.uid)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                Aprobar
              </button>
              <button 
                onClick={() => deny(r.uid)}
                className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                Denegar
              </button>
            </div>
          </div>
        ))}
        {requests.length === 0 && (
          <div className="col-span-full py-12 text-center text-black/40 bg-white rounded-3xl border border-dashed border-zinc-200">
            No hay solicitudes pendientes.
          </div>
        )}
      </div>
    </div>
  );
};

const AdminMeliConfig = () => {
  const { userId } = useParams<{ userId: string }>();
  const [clientProfile, setClientProfile] = useState<UserProfile | null>(null);
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const fetchClient = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (data) {
        setClientProfile(data as any);
        setApiUrl(data.local_system_config?.api_url || '');
        setApiKey(data.local_system_config?.api_key || '');
      }
    };
    fetchClient();
  }, [userId]);

  const saveConfig = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          local_system_config: { api_url: apiUrl, api_key: apiKey }
        })
        .eq('id', userId);

      if (error) throw error;
      alert('Configuración guardada correctamente en Supabase');
    } catch (err: any) {
      console.error(err);
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-black">Configuración Meli</h2>
          <p className="text-black/60">Configura la sincronización para {clientProfile?.email}</p>
        </div>
        <Link to="/admin/users" className="text-black/60 hover:text-black font-medium flex items-center gap-2">
          <ArrowRight className="rotate-180" size={18} />
          Volver
        </Link>
      </header>

      <div className="max-w-2xl bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-black">Sistema Local del Cliente</h3>
          <div>
            <label className="block text-xs font-bold text-black/40 uppercase mb-2">URL API Local</label>
            <input 
              type="url" 
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
              placeholder="https://sistema-cliente.com/api"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-black/40 uppercase mb-2">API Key Local</label>
            <input 
              type="password" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
              placeholder="••••••••••••••••"
            />
          </div>
        </div>

        <button 
          onClick={saveConfig}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50"
        >
          {saving ? <RefreshCw className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
          Guardar Configuración
        </button>
      </div>
    </div>
  );
};

// --- Pages ---

const Login = () => {
  const { login, register, logout, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [responsible, setResponsible] = useState('');
  const [phone, setPhone] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Admin Modal State
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState('');

  if (user) return <Navigate to="/" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);
    try {
      if (isRegister) {
        // Validaciones
        if (!email.includes('@') || !email.endsWith('.com')) {
          throw new Error('El email debe contener "@" y terminar en ".com"');
        }
        if (phone.replace(/\D/g, '').length !== 10) {
          throw new Error('El teléfono debe tener exactamente 10 dígitos');
        }

        // Se quita el campo contraseña del formulario, usamos una por defecto para la solicitud
        const defaultPassword = 'access_request_pending';
        
        await register(email, defaultPassword, {
          company_name: company,
          responsible_name: responsible,
          phone: phone
        });
        setSuccess(true);
        // Reset form
        setEmail('');
        setCompany('');
        setResponsible('');
        setPhone('');
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('invalid') && err.message?.toLowerCase().includes('credentials')) {
        setError('Email o contraseña incorrectos. Si solicitaste acceso, recuerda que tu solicitud debe ser aprobada.');
      } else {
        setError(err.message || 'Error al autenticar');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setLoading(true);
    try {
      // Map username to internal email
      const adminEmail = adminUser.includes('@') ? adminUser : `${adminUser}@meli-sync-v1.com`;
      
      try {
        await login(adminEmail, adminPass);
      } catch (loginErr: any) {
        const msg = loginErr.message?.toLowerCase() || '';
        const isInvalidCredentials = msg.includes('invalid') || msg.includes('credentials') || msg.includes('no encontrado');
        const isNotConfirmed = msg.includes('confirm') || msg.includes('verific');

        if (isNotConfirmed) {
          throw new Error("El email del administrador no ha sido confirmado. Por favor, desactive la confirmación de email en la configuración de Supabase Auth.");
        }

        // Auto-registration logic for the specific admin accounts
        if (isAdminEmail(adminEmail) && isInvalidCredentials) {
          try {
            await register(adminEmail, adminPass);
            // After registration, try to login again
            await login(adminEmail, adminPass);
          } catch (regErr: any) {
            const regMsg = regErr.message?.toLowerCase() || '';
            if (regMsg.includes('confirm')) {
              throw new Error("Registro exitoso, pero se requiere confirmación de email. Desactive 'Confirm Email' en Supabase > Auth > Providers > Email.");
            }
            throw loginErr;
          }
        } else {
          throw loginErr;
        }
      }
      setShowAdminModal(false);
    } catch (err: any) {
      setAdminError(err.message || 'Credenciales de administrador inválidas. Verifique usuario y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-black text-white p-6 relative">
      {/* Logo arriba a la izquierda */}
      <div className="absolute top-8 left-8 flex items-center gap-4">
        <img 
          src="/api/attachments/87820353-294c-474c-87d2-069094037561" 
          alt="Logo" 
          className="w-24 h-24 object-contain"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://via.placeholder.com/100?text=Logo";
          }}
        />
      </div>

      {/* Admin Login arriba a la derecha */}
      <div className="absolute top-8 right-8">
        <button 
          onClick={() => setShowAdminModal(true)}
          className="text-zinc-500 hover:text-white text-sm font-medium transition-all"
        >
          Admin Login
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-10 shadow-2xl"
        >
          <h2 className="text-3xl font-bold text-white mb-2 text-center">
            {isRegister ? 'Solicitar Acceso' : 'Bienvenido'}
          </h2>
          <p className="text-zinc-400 mb-8 text-center text-sm">
            {isRegister 
              ? 'Completa tus datos para que el administrador apruebe tu acceso.' 
              : 'Ingresa tus credenciales para acceder al sistema.'}
          </p>

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs p-4 rounded-xl flex items-center gap-2 mb-6">
              <CheckCircle2 size={14} />
              Solicitud enviada con éxito. El administrador revisará tu acceso.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Empresa</label>
                  <input 
                    type="text" 
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="Nombre de la empresa"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Responsable</label>
                  <input 
                    type="text" 
                    required
                    value={responsible}
                    onChange={(e) => setResponsible(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="Nombre del responsable"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Teléfono</label>
                  <input 
                    type="tel" 
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="+54 9 11 ..."
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Email</label>
              <input 
                type="text" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                placeholder="tu@email.com"
              />
            </div>
            {!isRegister && (
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Contraseña</label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="••••••••"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-4 rounded-xl flex items-center gap-2">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="animate-spin" size={20} /> : (isRegister ? 'Enviar Solicitud' : 'Entrar')}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button 
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
                setSuccess(false);
              }}
              className="text-zinc-500 hover:text-white text-sm font-medium transition-all underline underline-offset-4"
            >
              {isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Solicita acceso'}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showAdminModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdminModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative max-w-sm w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-white mb-6 text-center">Seccion Login Admin</h2>
              
              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Usuario</label>
                  <input 
                    type="text" 
                    required
                    value={adminUser}
                    onChange={(e) => setAdminUser(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="Usuario admin"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Clave</label>
                  <input 
                    type="password" 
                    required
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="••••••••"
                  />
                </div>

                {adminError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-3 rounded-xl flex items-center gap-2">
                    <AlertCircle size={14} />
                    {adminError}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Ingresar'}
                </button>
                
                <button 
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="w-full text-zinc-500 hover:text-white text-sm py-2 transition-all"
                >
                  Cancelar
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Dashboard = ({ clientProfile }: { clientProfile?: UserProfile }) => {
  const { profile: authProfile, connectMeli } = useAuth();
  const profile = clientProfile || authProfile;
  const [logs, setLogs] = useState<SyncLog[]>([]);

  if (authProfile?.role === 'admin' && !clientProfile) {
    return <Navigate to="/admin/users" />;
  }

  useEffect(() => {
    const fetchLogs = async () => {
      if (!profile?.uid) return;
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('user_id', profile.uid)
        .order('timestamp', { ascending: false })
        .limit(5);
      
      if (error) console.error(error);
      else setLogs(data as any);
    };

    fetchLogs();
  }, [profile?.uid]);

  return (
    <div className="p-8 space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-black">Dashboard</h2>
          <p className="text-black/60">Resumen de tu actividad y estado de conexión.</p>
        </div>
        {!profile?.meli_connected && (
          <button 
            onClick={connectMeli}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
          >
            <ExternalLink size={18} />
            Conectar Mercado Libre
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-zinc-200 p-6 rounded-3xl shadow-sm">
          <p className="text-zinc-500 text-sm uppercase tracking-wider mb-1">Estado Conexión</p>
          <div className="flex items-center gap-2">
            {profile?.meli_connected ? (
              <>
                <CheckCircle2 className="text-emerald-500" size={20} />
                <span className="text-xl font-bold text-black">Conectado</span>
              </>
            ) : (
              <>
                <AlertCircle className="text-amber-500" size={20} />
                <span className="text-xl font-bold text-black">Desconectado</span>
              </>
            )}
          </div>
        </div>
        <div className="bg-white border border-zinc-200 p-6 rounded-3xl shadow-sm">
          <p className="text-zinc-500 text-sm uppercase tracking-wider mb-1">Sincronizaciones Hoy</p>
          <p className="text-3xl font-bold text-black">24</p>
        </div>
        <div className="bg-white border border-zinc-200 p-6 rounded-3xl shadow-sm">
          <p className="text-zinc-500 text-sm uppercase tracking-wider mb-1">Errores Recientes</p>
          <p className="text-3xl font-bold text-red-500">0</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
            <h3 className="font-bold text-black">Actividad Reciente</h3>
            <Link to="/history" className="text-blue-600 text-sm hover:underline">Ver todo</Link>
          </div>
          <div className="divide-y divide-zinc-100">
            {logs.length > 0 ? logs.map(log => (
              <div key={log.id} className="p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  log.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                }`}>
                  {log.status === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-black font-medium capitalize">{log.type} Sync</p>
                  <p className="text-xs text-zinc-500">{new Date(log.timestamp).toLocaleString()}</p>
                </div>
                <p className="text-xs text-zinc-600">{log.details}</p>
              </div>
            )) : (
              <div className="p-12 text-center text-zinc-400">No hay actividad registrada.</div>
            )}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-3xl p-8 flex flex-col justify-center items-center text-center shadow-sm">
          <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mb-4">
            <Plus className="text-zinc-400" />
          </div>
          <h3 className="font-bold text-black mb-2">Nueva Sincronización</h3>
          <p className="text-zinc-500 text-sm mb-6">Inicia una actualización manual de stock o precios desde tu sistema local.</p>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20">
            Comenzar ahora
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

const Products = () => {
  const { profile } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchProducts = async () => {
    if (!profile?.meli_access_token) return;
    setLoading(true);
    try {
      // 1. Get user items
      const itemsRes = await fetch('/api/meli/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'GET',
          url: `/users/${profile.meli_user_id}/items/search`,
          token: profile.meli_access_token
        })
      });
      const itemsData = await itemsRes.json();
      
      if (itemsData.results && itemsData.results.length > 0) {
        // 2. Get details for each item
        const detailsRes = await fetch('/api/meli/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: 'GET',
            url: `/items?ids=${itemsData.results.slice(0, 12).join(',')}`,
            token: profile.meli_access_token
          })
        });
        const detailsData = await detailsRes.json();
        const fetchedProducts = detailsData.map((d: any) => d.body);
        setProducts(fetchedProducts);

        // Persist in LocalStorage
        if (profile.uid) {
          const meliData = getLocalData(STORAGE_KEYS.MELI_DATA) || {};
          meliData[profile.uid] = {
            ...meliData[profile.uid],
            products: fetchedProducts,
            last_updated: Date.now()
          };
          setLocalData(STORAGE_KEYS.MELI_DATA, meliData);
        }
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.meli_connected) {
      // Try to load from LocalStorage first
      const meliData = getLocalData(STORAGE_KEYS.MELI_DATA) || {};
      const userData = meliData[profile.uid];
      if (userData && userData.products) {
        setProducts(userData.products);
      } else {
        fetchProducts();
      }
    }
  }, [profile]);

  const filteredProducts = products.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-black">Productos</h2>
          <p className="text-black/60">Listado de tus publicaciones en Mercado Libre.</p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por título o ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-2 text-black focus:outline-none focus:border-blue-500 transition-all w-64 shadow-sm"
            />
          </div>
          <button 
            onClick={fetchProducts}
            disabled={loading}
            className="bg-white border border-zinc-200 hover:bg-zinc-50 text-black px-4 py-2 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </header>

      {!profile?.meli_connected ? (
        <div className="bg-white border border-zinc-200 p-12 rounded-3xl text-center shadow-sm">
          <AlertCircle className="text-amber-500 mx-auto mb-4" size={48} />
          <h3 className="text-xl font-bold text-black mb-2">Conexión Requerida</h3>
          <p className="text-zinc-500 mb-6">Debes conectar tu cuenta de Mercado Libre para ver tus productos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProducts.map(product => (
            <motion.div 
              key={product.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white border border-zinc-200 rounded-3xl overflow-hidden group shadow-sm hover:shadow-md transition-all"
            >
              <div className="aspect-video bg-zinc-50 relative overflow-hidden">
                <img 
                  src={product.thumbnail} 
                  alt={product.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white">
                  {product.status.toUpperCase()}
                </div>
              </div>
              <div className="p-6 space-y-4">
                <h3 className="font-bold text-black line-clamp-2 h-12">{product.title}</h3>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wider">Precio</p>
                    <p className="text-xl font-bold text-black">${product.price.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-zinc-500 text-xs uppercase tracking-wider">Stock</p>
                    <p className="text-xl font-bold text-black">{product.available_quantity}</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-zinc-100 flex justify-between items-center">
                  <span className="text-xs text-zinc-400 font-mono">{product.id}</span>
                  <a 
                    href={product.permalink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                  >
                    Ver en Meli <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
          {filteredProducts.length === 0 && !loading && (
            <div className="col-span-full py-20 text-center text-zinc-400">
              No se encontraron productos que coincidan con la búsqueda.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Invoices = () => {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingOrder, setUploadingOrder] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!profile?.meli_access_token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/meli/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'GET',
          url: `/orders/search?seller=${profile.meli_user_id}`,
          token: profile.meli_access_token
        })
      });
      const data = await res.json();
      const fetchedOrders = data.results || [];
      setOrders(fetchedOrders);

      // Persist in LocalStorage
      if (profile.uid) {
        const meliData = getLocalData(STORAGE_KEYS.MELI_DATA) || {};
        meliData[profile.uid] = {
          ...meliData[profile.uid],
          orders: fetchedOrders,
          last_updated: Date.now()
        };
        setLocalData(STORAGE_KEYS.MELI_DATA, meliData);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadInvoice = async (orderId: string) => {
    setUploadingOrder(orderId);
    // Simulate upload
    setTimeout(async () => {
      if (profile?.uid) {
        const { error } = await supabase.from('sync_logs').insert({
          user_id: profile.uid,
          type: 'invoice',
          status: 'success',
          details: `Factura subida para la orden #${orderId}`
        });
        if (error) console.error(error);
      }
      setUploadingOrder(null);
      setUploadSuccess(orderId);
      setTimeout(() => setUploadSuccess(null), 3000);
    }, 1500);
  };

  useEffect(() => {
    if (profile?.meli_connected) {
      // Try to load from LocalStorage first
      const meliData = getLocalData(STORAGE_KEYS.MELI_DATA) || {};
      const userData = meliData[profile.uid];
      if (userData && userData.orders) {
        setOrders(userData.orders);
      } else {
        fetchOrders();
      }
    }
  }, [profile]);

  return (
    <div className="p-8 space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-black">Facturación</h2>
          <p className="text-black/60">Gestiona las ventas y sube facturas para tus clientes.</p>
        </div>
        <button 
          onClick={fetchOrders}
          disabled={loading}
          className="bg-white border border-zinc-200 hover:bg-zinc-50 text-black px-4 py-2 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Actualizar Ventas
        </button>
      </header>

      <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-medium">Orden ID</th>
              <th className="px-6 py-4 font-medium">Cliente</th>
              <th className="px-6 py-4 font-medium">Total</th>
              <th className="px-6 py-4 font-medium">Estado Pago</th>
              <th className="px-6 py-4 font-medium">Factura</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {orders.map(order => (
              <tr key={order.id} className="hover:bg-zinc-50 transition-all">
                <td className="px-6 py-4 text-sm text-black font-mono">#{order.id}</td>
                <td className="px-6 py-4 text-sm text-zinc-600">
                  {order.buyer.first_name} {order.buyer.last_name}
                </td>
                <td className="px-6 py-4 text-sm text-black font-bold">
                  ${order.total_amount.toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                    order.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {uploadSuccess === order.id ? (
                    <span className="flex items-center gap-2 text-emerald-500 text-sm font-medium">
                      <CheckCircle2 size={14} />
                      Subida
                    </span>
                  ) : (
                    <button 
                      onClick={() => handleUploadInvoice(order.id)}
                      disabled={uploadingOrder === order.id}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50"
                    >
                      {uploadingOrder === order.id ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      {uploadingOrder === order.id ? 'Subiendo...' : 'Subir PDF'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-zinc-400">No se encontraron ventas recientes.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Sync = () => {
  const { profile } = useAuth();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async (type: 'stock' | 'price' | 'sales' | 'invoices') => {
    if (!profile?.local_system_config?.api_url) {
      alert("Debes configurar la URL de la API local en Configuración antes de sincronizar.");
      return;
    }

    setSyncing(true);
    try {
      // Simulate API call to local system
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (profile?.uid) {
        const { error } = await supabase.from('sync_logs').insert({
          user_id: profile.uid,
          type,
          status: 'success',
          details: `Sincronización de ${type} completada exitosamente desde ${profile.local_system_config.api_url}`
        });
        if (error) console.error(error);
      }
    } catch (error: any) {
      if (profile?.uid) {
        const { error: logError } = await supabase.from('sync_logs').insert({
          user_id: profile.uid,
          type,
          status: 'error',
          details: `Error en sincronización de ${type}: ${error.message}`
        });
        if (logError) console.error(logError);
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-black">Sincronización</h2>
        <p className="text-black/60">Actualiza masivamente la información de tus productos y ventas.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="bg-white border border-zinc-200 p-6 rounded-3xl space-y-4 shadow-sm">
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600">
            <Package size={20} />
          </div>
          <h3 className="text-lg font-bold text-black">Stock</h3>
          <p className="text-zinc-500 text-xs">Actualiza stock desde sistema local a ML.</p>
          <button 
            onClick={() => handleSync('stock')}
            disabled={syncing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-sm transition-all disabled:opacity-50"
          >
            {syncing ? '...' : 'Sincronizar'}
          </button>
        </div>

        <div className="bg-white border border-zinc-200 p-6 rounded-3xl space-y-4 shadow-sm">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
            <RefreshCw size={20} />
          </div>
          <h3 className="text-lg font-bold text-black">Precios</h3>
          <p className="text-zinc-500 text-xs">Actualiza precios desde sistema local a ML.</p>
          <button 
            onClick={() => handleSync('price')}
            disabled={syncing}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-sm transition-all disabled:opacity-50"
          >
            {syncing ? '...' : 'Sincronizar'}
          </button>
        </div>

        <div className="bg-white border border-zinc-200 p-6 rounded-3xl space-y-4 shadow-sm">
          <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-600">
            <FileText size={20} />
          </div>
          <h3 className="text-lg font-bold text-black">Ventas</h3>
          <p className="text-zinc-500 text-xs">Descarga facturas de ventas desde ML.</p>
          <button 
            onClick={() => handleSync('sales')}
            disabled={syncing}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-xl text-sm transition-all disabled:opacity-50"
          >
            {syncing ? '...' : 'Sincronizar'}
          </button>
        </div>

        <div className="bg-white border border-zinc-200 p-6 rounded-3xl space-y-4 shadow-sm">
          <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-600">
            <Upload size={20} />
          </div>
          <h3 className="text-lg font-bold text-black">Facturas</h3>
          <p className="text-zinc-500 text-xs">Sube facturas a tus clientes finales.</p>
          <button 
            onClick={() => handleSync('invoices')}
            disabled={syncing}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-xl text-sm transition-all disabled:opacity-50"
          >
            {syncing ? '...' : 'Sincronizar'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Customers = () => {
  const { profile } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [customers, setCustomers] = useState([
    { id: '1', name: 'Juan Pérez', email: 'juan@example.com', ml_status: 'OK', system_status: 'OK' },
    { id: '2', name: 'María García', email: 'maria@example.com', ml_status: 'OK', system_status: 'PENDING' },
    { id: '3', name: 'Comercial ABC', email: 'ventas@abc.com', ml_status: 'ERR', system_status: 'OK' },
  ]);

  const handleSync = async () => {
    if (!profile?.uid) return;
    setSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { error } = await supabase.from('sync_logs').insert({
      user_id: profile.uid,
      type: 'customers',
      status: 'success',
      details: "Sincronización de clientes completada exitosamente."
    });
    
    if (error) console.error(error);
    setSyncing(false);
    alert("Sincronización de clientes completada. Se encontraron 2 diferencias.");
  };

  return (
    <div className="p-8 space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-black">Clientes</h2>
          <p className="text-black/60">Sincroniza tus clientes locales con Mercado Libre.</p>
        </div>
        <button 
          onClick={handleSync}
          disabled={syncing}
          className="bg-black text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg shadow-black/10 disabled:opacity-50"
        >
          <RefreshCw className={syncing ? 'animate-spin' : ''} size={20} />
          {syncing ? 'Sincronizando...' : 'Sincronizar con ML'}
        </button>
      </header>

      <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Nombre / Razón Social</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Estado ML</th>
                <th className="px-6 py-4 font-medium">Estado Sistema</th>
                <th className="px-6 py-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-zinc-50 transition-all">
                  <td className="px-6 py-4 font-bold text-black">{c.name}</td>
                  <td className="px-6 py-4 text-zinc-500">{c.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                      c.ml_status === 'OK' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {c.ml_status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                      c.system_status === 'OK' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {c.system_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {c.ml_status !== c.system_status && (
                      <div className="flex items-center justify-end gap-2 text-red-500" title="Diferencia detectada">
                        <AlertCircle size={16} />
                        <span className="text-[10px] font-bold">Diferencia</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const { profile } = useAuth();
  const [config, setConfig] = useState({ api_url: '', api_key: '' });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean, message: string } | null>(null);

  useEffect(() => {
    if (profile?.local_system_config) {
      setConfig(profile.local_system_config);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile?.uid) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ local_system_config: config })
        .eq('id', profile.uid);
      
      if (error) throw error;
      alert("Configuración guardada en Supabase");
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Simulate API call to local system
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (config.api_url.includes('example.com') || !config.api_url) {
        throw new Error("URL inválida o no configurada");
      }
      setTestResult({ success: true, message: "Conexión establecida correctamente con el sistema local." });
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || "Error al conectar con el sistema local." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-2xl">
      <header>
        <h2 className="text-3xl font-bold text-black">Configuración</h2>
        <p className="text-black/60">Configura la conexión con tu sistema de facturación local.</p>
      </header>

      <div className="bg-white border border-zinc-200 p-8 rounded-3xl space-y-6 shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-500">URL de la API Local</label>
          <input 
            type="text" 
            value={config.api_url}
            onChange={(e) => setConfig({ ...config, api_url: e.target.value })}
            placeholder="https://tu-sistema.com/api"
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-black focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-500">API Key / Token</label>
          <input 
            type="password" 
            value={config.api_key}
            onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
            placeholder="••••••••••••••••"
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-black focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>

        {testResult && (
          <div className={`p-4 rounded-xl flex items-start gap-3 ${testResult.success ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
            {testResult.success ? <CheckCircle2 size={18} className="mt-0.5" /> : <AlertCircle size={18} className="mt-0.5" />}
            <p className="text-sm">{testResult.message}</p>
          </div>
        )}

        <div className="flex gap-4">
          <button 
            onClick={handleTestConnection}
            disabled={testing}
            className="flex-1 bg-white border border-zinc-200 hover:bg-zinc-50 text-black font-bold py-3 rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            {testing && <RefreshCw size={16} className="animate-spin" />}
            Probar Conexión
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl transition-all shadow-sm"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

const HistoryPage = () => {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<SyncLog[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!profile?.uid) return;
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('user_id', profile.uid)
        .order('timestamp', { ascending: false });
      
      if (error) console.error(error);
      else setLogs(data as any);
    };

    fetchLogs();
  }, [profile?.uid]);

  return (
    <div className="p-8 space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-black">Historial</h2>
        <p className="text-black/60">Registro completo de todas las sincronizaciones realizadas.</p>
      </header>

      <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-medium">Fecha</th>
              <th className="px-6 py-4 font-medium">Tipo</th>
              <th className="px-6 py-4 font-medium">Estado</th>
              <th className="px-6 py-4 font-medium">Detalles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-zinc-50 transition-all">
                <td className="px-6 py-4 text-sm text-zinc-600">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-black font-medium capitalize">{log.type}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                    log.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                  }`}>
                    {log.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-500">
                  {log.details}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-zinc-400">No hay registros aún.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <div className="flex bg-sky-100 min-h-screen">
                  <Sidebar />
                  <main className="flex-1 overflow-y-auto">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/products" element={<Products />} />
                      <Route path="/invoices" element={<Invoices />} />
                      <Route path="/customers" element={<Customers />} />
                      <Route path="/sync" element={<Sync />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/history" element={<HistoryPage />} />
                      
                      {/* Admin Routes */}
                      <Route path="/admin/users" element={<AdminUsers />} />
                      <Route path="/admin/requests" element={<AdminRequests />} />
                      <Route path="/admin/subscriptions" element={<AdminAbonos />} />
                      <Route path="/admin/config/:userId" element={<AdminMeliConfig />} />
                      <Route path="/admin/view-dashboard/:userId" element={<ClientDashboardView />} />
                    </Routes>
                  </main>
                </div>
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}
