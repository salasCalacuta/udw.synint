import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

let supabase: any;

if (!supabaseUrl || !supabaseKey) {
  console.error("************************************************************");
  console.error("ERROR CRÍTICO: Faltan las variables de Supabase.");
  console.error("Asegúrate de configurar SUPABASE_URL y SUPABASE_ANON_KEY");
  console.error("en el panel de Environment de Render.");
  console.error("************************************************************");
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (err: any) {
    console.error("Error al inicializar Supabase:", err.message);
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health-check", async (req, res) => {
    try {
      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ success: false, message: "Variables de entorno SUPABASE_URL o SUPABASE_ANON_KEY no configuradas en Secrets." });
      }
      const { data, error } = await supabase.from('companies').select('count', { count: 'exact', head: true });
      if (error) throw error;
      res.json({ success: true, message: "Conexión con Supabase establecida correctamente." });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Error al conectar con Supabase: " + err.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { username, password, isAdmin } = req.body;
    console.log(`Login attempt: user=${username}, isAdmin=${isAdmin}`);

    if (isAdmin) {
      if (username === "udwadmin" && password === "udw2017") {
        console.log("Admin login successful");
        return res.json({ success: true, user: { username: "udwadmin", role: "admin" } });
      }
      console.log("Admin login failed: invalid credentials");
      return res.status(401).json({ success: false, message: "Credenciales de administrador incorrectas" });
    } else {
      try {
        const { data: company, error } = await supabase
          .from('companies')
          .select('*')
          .eq('username', username)
          .eq('password', password)
          .single();

        if (error || !company) {
          console.log(`Company login failed for ${username}: ${error?.message || 'not found'}`);
          return res.status(401).json({ success: false, message: "Credenciales de empresa incorrectas" });
        }

        if (!company.enabled) {
          console.log(`Company login blocked for ${username}: disabled`);
          return res.status(403).json({ success: false, message: "Acceso denegado por el administrador." });
        }

        // Single Session Logic: Check if session already exists
        if (company.session_token) {
          console.log(`Company login blocked for ${username}: session already active`);
          return res.status(403).json({ 
            success: false, 
            message: "Este usuario ya tiene una sesión activa en otro navegador. Debe cerrar la sesión anterior para ingresar." 
          });
        }

        // Generate new session token
        const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
        await supabase
          .from('companies')
          .update({ session_token: sessionToken })
          .eq('id', company.id);

        console.log(`Company login successful for ${username}, new session: ${sessionToken}`);
        return res.json({ success: true, user: { ...company, session_token: sessionToken, role: 'company' } });
      } catch (err) {
        console.error("Login Error:", err);
        return res.status(500).json({ success: false, message: "Error en el servidor de base de datos" });
      }
    }
  });

  app.post("/api/check-session", async (req, res) => {
    const { companyId, sessionToken } = req.body;
    if (!companyId || !sessionToken) return res.json({ valid: false });

    try {
      const { data, error } = await supabase
        .from('companies')
        .select('session_token')
        .eq('id', companyId)
        .single();

      if (error || !data) return res.json({ valid: false });
      return res.json({ valid: data.session_token === sessionToken });
    } catch (err) {
      return res.json({ valid: false });
    }
  });

  app.post("/api/logout", async (req, res) => {
    const { companyId } = req.body;
    if (!companyId) return res.json({ success: false });

    try {
      await supabase
        .from('companies')
        .update({ session_token: null })
        .eq('id', companyId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false });
    }
  });

  app.get("/api/companies", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*');
      
      if (error) {
        console.error("Fetch Companies Error:", JSON.stringify(error, null, 2));
        return res.status(500).json({ success: false, message: error.message, details: error });
      }
      res.json(data || []);
    } catch (err) {
      console.error("Unexpected Fetch Error:", err);
      res.status(500).json({ success: false, message: "Error inesperado al obtener empresas" });
    }
  });

  app.post("/api/companies", async (req, res) => {
    try {
      const { name, responsible_name, username, password, phone, email, amount, debt, payments, ml_link, ml_id, local_db_config } = req.body;
      
      const payload = { 
        name, 
        responsible_name, 
        username, 
        password, 
        phone, 
        email, 
        amount: Number(amount) || 0, 
        debt: Number(debt) || 0,
        payments: Number(payments) || 0,
        ml_link: ml_link || '',
        ml_id: ml_id || '',
        local_db_config: local_db_config || '',
        enabled: true 
      };

      const { data, error } = await supabase
        .from('companies')
        .insert([payload])
        .select()
        .single();
      
      if (error) {
        console.error("Insert Company Error:", JSON.stringify(error, null, 2));
        return res.status(500).json({ success: false, message: error.message, details: error });
      }
      res.json(data);
    } catch (err) {
      console.error("Unexpected Insert Error:", err);
      res.status(500).json({ success: false, message: "Error inesperado al insertar empresa" });
    }
  });

  app.patch("/api/companies/:id", async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('companies')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();
    
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.delete("/api/companies/:id", async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);
    
    if (error) return res.status(500).json(error);
    res.json({ success: true });
  });

  // Products API
  app.get("/api/products", async (req, res) => {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: "companyId is required" });
    const { data, error } = await supabase.from('products').select('*').eq('company_id', companyId);
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.post("/api/products", async (req, res) => {
    const { data, error } = await supabase.from('products').insert([req.body]).select().single();
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.delete("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
  });

  // Clients API
  app.get("/api/clients", async (req, res) => {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: "companyId is required" });
    const { data, error } = await supabase.from('clients').select('*').eq('company_id', companyId);
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.post("/api/clients", async (req, res) => {
    const { data, error } = await supabase.from('clients').insert([req.body]).select().single();
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.delete("/api/clients/:id", async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
  });

  // Invoices API
  app.get("/api/invoices", async (req, res) => {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: "companyId is required" });
    const { data, error } = await supabase.from('invoices').select('*, clients(*)').eq('company_id', companyId);
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.post("/api/invoices", async (req, res) => {
    const { data, error } = await supabase.from('invoices').insert([req.body]).select().single();
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
  });

  // Stats API for Company Dashboard
  app.get("/api/company-stats", async (req, res) => {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: "companyId is required" });
    
    try {
      const [products, clients, invoices] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', companyId)
      ]);

      res.json({
        products: products.count || 0,
        clients: clients.count || 0,
        invoices: invoices.count || 0
      });
    } catch (err) {
      res.status(500).json({ error: "Error fetching stats" });
    }
  });

  // Mercado Libre Mock APIs
  app.get("/api/ml/sales", (req, res) => {
    const { startDate, endDate, companyId } = req.query;
    console.log(`Fetching ML sales for company ${companyId} from ${startDate} to ${endDate}`);
    
    // Mock sales data
    const mockSales = [
      { id: 'ML1', date: '2024-03-01', item: 'Producto A', amount: 1500, status: 'paid' },
      { id: 'ML2', date: '2024-03-05', item: 'Producto B', amount: 2500, status: 'paid' },
      { id: 'ML3', date: '2024-03-10', item: 'Producto C', amount: 1200, status: 'pending' },
    ];
    
    res.json(mockSales);
  });

  app.post("/api/ml/upload-invoice", (req, res) => {
    const { saleId, fileName } = req.body;
    console.log(`Uploading invoice ${fileName} for sale ${saleId} to ML`);
    res.json({ success: true, message: "Factura subida correctamente a Mercado Libre" });
  });

  app.post("/api/sync/excel", async (req, res) => {
    const { type, data, companyId } = req.body;
    console.log(`Syncing ${type} from Excel for company ${companyId}`);
    
    try {
      if (type === 'products') {
        const { error } = await supabase.from('products').insert(data.map((item: any) => ({ ...item, company_id: companyId })));
        if (error) throw error;
      } else if (type === 'clients') {
        const { error } = await supabase.from('clients').insert(data.map((item: any) => ({ ...item, company_id: companyId })));
        if (error) throw error;
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ODBC Parser (Simulated for .dat file upload)
  app.post("/api/parse-odbc", (req, res) => {
    const { fileContent } = req.body; // Base64 or string
    if (!fileContent) return res.status(400).json({ error: "No file content provided" });

    try {
      const buffer = Buffer.from(fileContent, 'base64');
      const text = buffer.toString('latin1'); // Using latin1 for extended characters
      
      // Based on the provided sample, it looks like fixed width records.
      // Let's try to find records. Each record seems to start with a code.
      // Sample: "393          Acquas TE C/ ROSCA CENTRAL 1/2X1/2      un"
      // itm_cod: 13 chars
      // itm_desc: 40 chars
      // itm_med: 3 chars
      
      const lines = text.split('\n');
      const products = [];
      
      for (const line of lines) {
        if (line.length > 50) {
          const itm_cod = line.substring(0, 13).trim();
          const itm_desc = line.substring(13, 53).trim();
          
          if (itm_cod && itm_desc && !isNaN(Number(itm_cod))) {
            products.push({
              code: itm_cod,
              name: itm_desc,
              price: 0,
              stock: 0
            });
          }
        }
      }
      
      res.json({ success: true, products });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Error parsing file: " + err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
