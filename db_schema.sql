-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT,
  responsible_name TEXT,
  username TEXT,
  password TEXT,
  phone TEXT,
  email TEXT,
  amount NUMERIC DEFAULT 0,
  debt NUMERIC DEFAULT 0,
  payments NUMERIC DEFAULT 0,
  ml_client_id TEXT,
  ml_client_secret TEXT,
  ml_callback_url TEXT,
  ml_is_collaborator BOOLEAN DEFAULT FALSE,
  ml_collaborator_email TEXT,
  ml_user TEXT,
  ml_pass TEXT,
  ml_access_token TEXT,
  ml_refresh_token TEXT,
  ml_user_id TEXT,
  ml_token_expires TIMESTAMP WITH TIME ZONE,
  enabled BOOLEAN DEFAULT TRUE,
  permissions TEXT,
  session_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT,
  message TEXT,
  type TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  affected_elements TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT,
  name TEXT,
  price NUMERIC DEFAULT 0,
  stock NUMERIC DEFAULT 0,
  category TEXT,
  category_id TEXT DEFAULT 'MLA1652',
  gtin TEXT,
  condition TEXT DEFAULT 'new',
  description TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  ml_item_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(code, company_id)
);

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  codigo TEXT,
  nombre TEXT,
  mail TEXT,
  direccion TEXT,
  localidad TEXT,
  telefono TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(codigo, company_id)
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  number TEXT,
  total NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  category_id TEXT,
  name TEXT,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'main',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subcategory table
CREATE TABLE IF NOT EXISTS subcategory (
  id SERIAL PRIMARY KEY,
  category_id TEXT,
  name TEXT,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add some indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_company_id ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company_id ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_categorias_company_id ON categorias(company_id);
CREATE INDEX IF NOT EXISTS idx_subcategory_company_id ON subcategory(company_id);
