-- SQL Schema for Supabase
-- Run this in your Supabase SQL Editor

-- 1. Profiles Table (Extends Auth.Users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  status TEXT DEFAULT 'pendiente' CHECK (status IN ('activo', 'pasivo', 'pendiente')),
  company_name TEXT,
  responsible_name TEXT,
  phone TEXT,
  total_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  debt_amount NUMERIC DEFAULT 0,
  subscription_status TEXT DEFAULT 'pendiente' CHECK (subscription_status IN ('pagado', 'pendiente')),
  meli_connected BOOLEAN DEFAULT false,
  meli_user_id TEXT,
  meli_access_token TEXT,
  meli_refresh_token TEXT,
  local_system_config JSONB DEFAULT '{}'::jsonb,
  report_count INTEGER DEFAULT 0,
  meli_sync_status TEXT DEFAULT 'OK',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Sync Logs Table
CREATE TABLE sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  details TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Row Level Security (RLS)

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Sync Logs Policies
CREATE POLICY "Users can view their own logs" ON sync_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own logs" ON sync_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all logs" ON sync_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, status)
  VALUES (new.id, new.email, 'user', 'pendiente');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
