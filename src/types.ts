export interface UserProfile {
  uid: string;
  email: string;
  password?: string;
  company_name?: string;
  role?: 'admin' | 'user';
  status?: 'activo' | 'pasivo' | 'pendiente';
  subscription_status?: 'pagado' | 'pendiente';
  report_count?: number;
  meli_sync_status?: 'OK' | 'ERR';
  phone?: string;
  responsible_name?: string;
  total_amount?: number;
  paid_amount?: number;
  debt_amount?: number;
  meli_connected?: boolean;
  meli_user_id?: string;
  meli_access_token?: string;
  meli_refresh_token?: string;
  meli_token_expiry?: number;
  local_system_config?: {
    api_url: string;
    api_key: string;
  };
}

export interface SyncLog {
  id?: string;
  uid: string;
  timestamp: number;
  type: 'stock' | 'price' | 'invoice';
  status: 'success' | 'error';
  details?: string;
}

export interface MeliProduct {
  id: string;
  title: string;
  price: number;
  available_quantity: number;
  status: string;
  thumbnail: string;
}
