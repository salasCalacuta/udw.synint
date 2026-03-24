import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

let supabase: any;

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const isConfigValid = supabaseUrl && supabaseKey && 
    !supabaseUrl.includes("your-project-id") && 
    !supabaseUrl.includes("YOUR_SUPABASE_URL") && 
    !supabaseKey.includes("your-anon-key") && 
    !supabaseKey.includes("YOUR_SUPABASE_ANON_KEY") && 
    isValidUrl(supabaseUrl);

if (!isConfigValid) {
  console.error("************************************************************");
  console.error("ERROR CRÍTICO: Configuración de Supabase inválida o faltante.");
  console.error("Asegúrate de configurar SUPABASE_URL y SUPABASE_ANON_KEY");
  console.error("en el panel de Secrets de AI Studio.");
  console.error("URL actual:", supabaseUrl || "(vacío)");
  console.error("************************************************************");
}

try {
  // Initialize even if config is invalid to avoid "undefined" errors, 
  // but only if URL is somewhat valid for createClient
  if (isValidUrl(supabaseUrl)) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (err: any) {
  console.error("Error al inicializar Supabase:", err.message);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Middleware to check if Supabase is initialized
  app.use("/api", (req, res, next) => {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        message: "Servicio de base de datos no disponible. Verifica la configuración de Supabase (URL y Key)." 
      });
    }
    next();
  });

  // API Routes
  app.get("/api/debug-companies-schema", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      // Try to get one row to see columns
      const { data, error } = await supabase.from('companies').select('*').limit(1);
      if (error) {
        return res.status(500).json({ error: error.message, details: error });
      }
      if (!data || data.length === 0) {
        return res.json({ message: "No companies found to inspect schema", columns: [] });
      }
      const columns = Object.keys(data[0]);
      res.json({ columns, sample: data[0] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/health-check", async (req, res) => {
    try {
      // The middleware already ensures supabase is defined
      const { data, error } = await supabase.from('companies').select('count', { count: 'exact', head: true });
      if (error) {
        return res.status(500).json({ 
          success: false, 
          message: "Error al consultar Supabase: " + error.message,
          details: error 
        });
      }
      res.json({ 
        success: true, 
        message: "Conexión con Supabase establecida correctamente.",
        configValid: isConfigValid
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Error inesperado al conectar con Supabase: " + err.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { username, password, isAdmin } = req.body;
    console.log(`Login attempt: user=${username}, isAdmin=${isAdmin}`);

    if (isAdmin) {
      console.log(`Admin login attempt for user: ${username}`);
      if ((username === "dashudw" && password === "uDw_2017#Tm!CtrLM") || (username === "udw.desarrollos@gmail.com" && password === "uDw_2017#Tm!CtrLM")) {
        console.log("Admin login successful");
        return res.json({ success: true, user: { username: username, role: "admin" } });
      }
      console.log(`Admin login failed: invalid credentials for user ${username}`);
      return res.status(401).json({ success: false, message: "Credenciales de administrador incorrectas" });
    } else {
      console.log(`Company login attempt for user: ${username}`);
      if (!supabase) {
        console.error("Supabase client not initialized");
        return res.status(500).json({ success: false, message: "Error de configuración del servidor (Supabase)" });
      }
      try {
        // First, let's check what columns we have to be sure
        const { data: sampleData, error: schemaError } = await supabase.from('companies').select('*').limit(1);
        let availableColumns: string[] = [];
        if (sampleData && sampleData.length > 0) {
          availableColumns = Object.keys(sampleData[0]);
        }

        // Try to find the company. We'll try 'username' and 'password' first.
        // If they don't exist, we might need to use other column names if we can guess them.
        const query = supabase.from('companies').select('*');
        
        if (availableColumns.includes('username')) {
          query.eq('username', username);
        } else if (availableColumns.includes('email')) {
          query.eq('email', username);
        } else {
          // Fallback if we don't know the column name
          query.eq('username', username);
        }

        if (availableColumns.includes('password')) {
          query.eq('password', password);
        } else if (availableColumns.includes('pass')) {
          query.eq('pass', password);
        } else {
          query.eq('password', password);
        }

        const { data: company, error } = await query.maybeSingle();

      if (error) {
        console.error(`Database error during company login for ${username}:`, error);
        if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
          return res.status(403).json({ 
            success: false, 
            message: "Error de autenticación con la base de datos (403). Verifique la configuración de Supabase.",
            details: error 
          });
        }
        return res.status(500).json({ 
          success: false, 
          message: "Error al consultar la base de datos: " + error.message,
          debug_columns: availableColumns.join(', ')
        });
      }

        if (!company) {
          console.log(`Company login failed for ${username}: not found`);
          return res.status(401).json({ 
            success: false, 
            message: "Credenciales de empresa incorrectas",
            debug_columns: availableColumns.join(', ')
          });
        }

        if (company.enabled === false) { // Explicit check for false
          console.log(`Company login blocked for ${username}: disabled`);
          return res.status(401).json({ success: false, message: "Acceso denegado por el administrador." });
        }

        // Single Session Logic: Check if session already exists
        // Only if session_token column exists
        if (availableColumns.includes('session_token') && company.session_token) {
          console.log(`Company login blocked for ${username}: session already active`);
          return res.status(401).json({ 
            success: false, 
            message: "Este usuario ya tiene una sesión activa en otro navegador. Debe cerrar la sesión anterior para ingresar." 
          });
        }

        // Generate new session token
        const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
        
        if (availableColumns.includes('session_token')) {
          const { error: updateError } = await supabase
            .from('companies')
            .update({ session_token: sessionToken })
            .eq('id', company.id);

          if (updateError) {
            console.error(`Error updating session token for ${username}:`, updateError);
            return res.status(500).json({ success: false, message: "Error al actualizar la sesión: " + updateError.message });
          }
        }

        console.log(`Company login successful for ${username}, new session: ${sessionToken}`);
        const userToReturn = { ...company, session_token: sessionToken, role: 'company' };
        if (typeof userToReturn.permissions === 'string') {
          try {
            userToReturn.permissions = JSON.parse(userToReturn.permissions);
          } catch (e) {
            console.error("Error parsing permissions for user:", userToReturn.username);
          }
        }
        return res.json({ success: true, user: userToReturn });
      } catch (err: any) {
        console.error("Login Error:", err);
        return res.status(500).json({ 
          success: false, 
          message: "Error inesperado en el servidor: " + err.message 
        });
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
        .maybeSingle();

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

  app.post("/api/reset-session/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await supabase
        .from('companies')
        .update({ session_token: null })
        .eq('id', id);
      console.log(`Session reset for company ${id}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false });
    }
  });

  app.post("/api/refresh-access", async (req, res) => {
    const { username, password } = req.body;
    try {
      const { data: company, error } = await supabase
        .from('companies')
        .select('id')
        .eq('username', username)
        .eq('password', password)
        .maybeSingle();

      if (error || !company) {
        return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
      }

      await supabase
        .from('companies')
        .update({ session_token: null })
        .eq('id', company.id);

      res.json({ success: true, message: "Acceso refrescado. Ya puede volver a ingresar." });
    } catch (err) {
      res.status(500).json({ success: false, message: "Error al refrescar acceso" });
    }
  });

  // Mercado Libre OAuth
  app.get("/api/ml/auth-url", async (req, res) => {
    const { companyId, origin } = req.query;
    if (!companyId) return res.status(400).json({ error: "companyId is required" });

    try {
      const { data: company, error } = await supabase
        .from('companies')
        .select('ml_client_id, ml_callback_url')
        .eq('id', companyId)
        .maybeSingle();

      if (error || !company) {
        return res.status(404).json({ error: "Empresa no encontrada" });
      }

      const clientId = company.ml_client_id || process.env.ML_CLIENT_ID;
      // Use origin from client if available, fallback to APP_URL
      const baseUrl = (origin as string) || process.env.APP_URL || '';
      const redirectUri = company.ml_callback_url || `${baseUrl}/api/ml/callback`;
      
      console.log(`Generating ML Auth URL for company ${companyId}. Redirect URI: ${redirectUri}`);
      
      const authUrl = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${companyId}:${encodeURIComponent(baseUrl)}`;
      res.json({ url: authUrl });
    } catch (err: any) {
      console.error("Error generating ML auth URL:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ml/callback", async (req, res) => {
    const { code, state } = req.query;

    if (!code) return res.status(400).send("No code provided");
    if (!state) return res.status(400).send("No state provided");

    const [companyId, encodedBaseUrl] = (state as string).split(':');
    const baseUrl = encodedBaseUrl ? decodeURIComponent(encodedBaseUrl) : process.env.APP_URL;

    try {
      const { data: company, error: compError } = await supabase
        .from('companies')
        .select('ml_client_id, ml_client_secret, ml_callback_url')
        .eq('id', companyId)
        .maybeSingle();

      if (compError || !company) throw new Error("Empresa no encontrada");

      const clientId = company.ml_client_id || process.env.ML_CLIENT_ID;
      const clientSecret = company.ml_client_secret || process.env.ML_CLIENT_SECRET;
      const redirectUri = company.ml_callback_url || `${baseUrl}/api/ml/callback`;

      console.log(`ML Callback for company ${companyId}. Using redirectUri: ${redirectUri}`);

      const response = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId!,
          client_secret: clientSecret!,
          code: code as string,
          redirect_uri: redirectUri
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error_description || data.error);

      // We need to know which company this is for. 
      // Ideally we'd use 'state' to pass the companyId.
      // For now, let's return the data to the frontend or handle it if state is present.
      
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'ML_AUTH_SUCCESS', data: ${JSON.stringify(data)} }, '*');
              window.close();
            </script>
            <p>Autenticación exitosa. Esta ventana se cerrará automáticamente.</p>
          </body>
        </html>
      `);
    } catch (err: any) {
      res.status(500).send("Error during ML OAuth: " + err.message);
    }
  });

  app.post("/api/ml/save-token", async (req, res) => {
    const { companyId, tokenData } = req.body;
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          ml_access_token: tokenData.access_token,
          ml_refresh_token: tokenData.refresh_token,
          ml_user_id: tokenData.user_id,
          ml_token_expires: new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        })
        .eq('id', companyId);

      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/ml/sync-items", async (req, res) => {
    const { companyId, items } = req.body;
    const results: any[] = [];
    try {
      const { data: company, error: compError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();

      if (compError || !company) return res.status(404).json({ error: "Empresa no encontrada" });
      if (!company.ml_access_token) return res.status(401).json({ error: "No autorizado en Mercado Libre" });

      for (const item of items) {
        const isUpdate = !!item.id && item.id.startsWith('MLA');
        
        const mlItem: any = isUpdate ? {
          price: Number(item.price),
          available_quantity: Number(item.stock),
        } : {
          title: item.name,
          price: Number(item.price),
          available_quantity: Number(item.stock),
          seller_custom_field: item.code,
        };

        // Handle GTIN/Identifiers
        if (item.gtin) {
          const attributes = mlItem.attributes || [];
          const gtinAttrIndex = attributes.findIndex((a: any) => a.id === 'GTIN');
          if (gtinAttrIndex !== -1) {
            attributes[gtinAttrIndex].value_name = item.gtin;
          } else {
            attributes.push({ id: 'GTIN', value_name: item.gtin });
          }
          mlItem.attributes = attributes;
        }

        if (!isUpdate) {
          mlItem.category_id = item.category_id || "MLA1652";
          mlItem.currency_id = "ARS";
          mlItem.buying_mode = "buy_it_now";
          mlItem.listing_type_id = "gold_special";
          mlItem.condition = item.condition || "new";
          
          if (item.images && item.images.length > 0) {
            mlItem.pictures = item.images.map((img: string) => ({ source: img }));
          } else {
            mlItem.pictures = item.pictures || [
              { source: "https://picsum.photos/seed/product/800/600" }
            ];
          }
        }

        const url = isUpdate 
          ? `https://api.mercadolibre.com/items/${item.id}`
          : "https://api.mercadolibre.com/items";
        
        const response = await fetch(url, {
          method: isUpdate ? "PUT" : "POST",
          headers: {
            "Authorization": `Bearer ${company.ml_access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(mlItem)
        });

        if (response.status === 401) {
          return res.status(401).json({ error: "No autorizado en Mercado Libre" });
        }

        const data = await response.json();
        if (data.id) {
          // Update description if provided
          if (item.description) {
            await fetch(`https://api.mercadolibre.com/items/${data.id}/description`, {
              method: "PUT",
              headers: {
                "Authorization": `Bearer ${company.ml_access_token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ plain_text: item.description })
            });
          }

          if (!isUpdate) {
            await supabase
              .from('products')
              .update({ ml_item_id: data.id })
              .eq('code', item.code)
              .eq('company_id', companyId);
          }

          results.push({ code: item.code, ml_id: data.id, status: 'success' });
        } else {
          results.push({ code: item.code, error: data.message || 'Error desconocido', status: 'error' });
        }
      }

      res.json({ success: true, results });
    } catch (err: any) {
      console.error("Error in sync-items:", err);
      res.status(500).json({ 
        success: false, 
        message: err.message,
        results: results || [] 
      });
    }
  });

  app.post("/api/export-excel", async (req, res) => {
    try {
      const { items, filename } = req.body;
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ success: false, message: "No se proporcionaron items para exportar" });
      }

      // Group items by category_id
      const groupedItems: { [key: string]: any[] } = {};
      items.forEach(item => {
        const category = item.category_id || 'Sin Categoria';
        if (!groupedItems[category]) groupedItems[category] = [];
        groupedItems[category].push({
          Codigo: item.code || item.codigo || '',
          Nombre: item.name || item.nombre || '',
          Precio: item.price || item.total || 0,
          Stock: item.stock || 0,
          GTIN: item.gtin || '',
          Condicion: item.condition || 'new',
          Descripcion: item.description || ''
        });
      });

      const wb = XLSX.utils.book_new();
      Object.keys(groupedItems).forEach(category => {
        const ws = XLSX.utils.json_to_sheet(groupedItems[category]);
        XLSX.utils.book_append_sheet(wb, ws, category.substring(0, 31)); // Sheet name limit 31 chars
      });

      // Determine the export path
      let exportPath = "D:\\PROYECTOS\\Nerds\\SynInt-ML\\ArchivosSincronizacion";
      
      // If not on Windows or path doesn't exist, use a local folder
      if (process.platform !== 'win32') {
        exportPath = path.join(process.cwd(), "ArchivosSincronizacion");
      }

      if (!fs.existsSync(exportPath)) {
        try {
          fs.mkdirSync(exportPath, { recursive: true });
        } catch (err) {
          console.error("Error creating export directory:", err);
          // Fallback to local folder if D: drive is not accessible
          exportPath = path.join(process.cwd(), "ArchivosSincronizacion");
          if (!fs.existsSync(exportPath)) fs.mkdirSync(exportPath, { recursive: true });
        }
      }

      const fullPath = path.join(exportPath, filename);
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(fullPath, buf);

      res.json({ success: true, path: fullPath });
    } catch (err: any) {
      console.error("Error exporting Excel:", err);
      res.status(500).json({ success: false, message: "Error al exportar Excel: " + err.message });
    }
  });

  app.get("/api/companies", async (req, res) => {
    if (!supabase) {
      console.error("Supabase client not initialized");
      return res.status(500).json({ success: false, message: "Error de configuración del servidor (Supabase)" });
    }
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*');
      
      if (error) {
        console.error("Fetch Companies Error:", JSON.stringify(error, null, 2));
        return res.status(500).json({ success: false, message: error.message, details: error });
      }
      
      const companies = (data || []).map((company: any) => {
        if (typeof company.permissions === 'string') {
          try {
            company.permissions = JSON.parse(company.permissions);
          } catch (e) {
            console.error("Error parsing permissions for company:", company.name);
          }
        }
        return company;
      });
      
      res.json(companies);
    } catch (err) {
      console.error("Unexpected Fetch Error:", err);
      res.status(500).json({ success: false, message: "Error inesperado al obtener empresas" });
    }
  });

  app.post("/api/companies", async (req, res) => {
    if (!supabase) {
      console.error("Supabase client not initialized");
      return res.status(500).json({ success: false, message: "Error de configuración del servidor (Supabase)" });
    }
    try {
      const { 
        name, responsible_name, username, password, phone, email, 
        amount, debt, payments, 
        ml_client_id, ml_client_secret, ml_callback_url,
        ml_is_collaborator, ml_collaborator_email,
        permissions
      } = req.body;
      
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
        ml_client_id: ml_client_id || '',
        ml_client_secret: ml_client_secret || '',
        ml_callback_url: ml_callback_url || '',
        ml_is_collaborator: !!ml_is_collaborator,
        ml_collaborator_email: ml_collaborator_email || '',
        enabled: true,
        permissions: typeof (permissions || {}) === 'object' ? JSON.stringify(permissions || {
          dashboard: true,
          products: true,
          prices: true,
          stock: true,
          clients: true,
          invoices: true,
          pdf: true
        }) : permissions
      };

      const { data, error } = await supabase
        .from('companies')
        .insert([payload])
        .select()
        .maybeSingle();
      
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
    if (!supabase) {
      console.error("Supabase client not initialized");
      return res.status(500).json({ success: false, message: "Error de configuración del servidor (Supabase)" });
    }
    const { id } = req.params;
    const { 
      name, responsible_name, username, password, phone, email, 
      amount, debt, payments, 
      ml_client_id, ml_client_secret, ml_callback_url,
      ml_is_collaborator, ml_collaborator_email,
      permissions, enabled
    } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (responsible_name !== undefined) updateData.responsible_name = responsible_name;
    if (username !== undefined) updateData.username = username;
    if (password !== undefined) updateData.password = password;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (amount !== undefined) updateData.amount = Number(amount) || 0;
    if (debt !== undefined) updateData.debt = Number(debt) || 0;
    if (payments !== undefined) updateData.payments = Number(payments) || 0;
    if (ml_client_id !== undefined) updateData.ml_client_id = ml_client_id;
    if (ml_client_secret !== undefined) updateData.ml_client_secret = ml_client_secret;
    if (ml_callback_url !== undefined) updateData.ml_callback_url = ml_callback_url;
    if (ml_is_collaborator !== undefined) updateData.ml_is_collaborator = !!ml_is_collaborator;
    if (ml_collaborator_email !== undefined) updateData.ml_collaborator_email = ml_collaborator_email;
    if (permissions !== undefined) {
      updateData.permissions = typeof permissions === 'object' ? JSON.stringify(permissions) : permissions;
    }
    if (enabled !== undefined) updateData.enabled = enabled;

    const { data, error } = await supabase
      .from('companies')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();
    
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
    const { data, error } = await supabase.from('products').insert([req.body]).select().maybeSingle();
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.put("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    const { code, name, price, stock, category_id, gtin, condition, description, images } = req.body;
    const { data, error } = await supabase
      .from('products')
      .update({ code, name, price, stock, category_id, gtin, condition, description, images })
      .eq('id', id)
      .select()
      .maybeSingle();
    
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
    const { data, error } = await supabase.from('clients').insert([req.body]).select().maybeSingle();
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.put("/api/clients/:id", async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('clients')
      .update(req.body)
      .eq('id', id)
      .select()
      .maybeSingle();
    
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
    const { data, error } = await supabase.from('invoices').insert([req.body]).select().maybeSingle();
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
    console.log(`Syncing ${type} from Excel for company ${companyId}. Count: ${data?.length}`);
    
    try {
      if (type === 'products') {
        const { error } = await supabase.from('products').insert(data.map((item: any) => ({ ...item, company_id: companyId })));
        if (error) {
          console.error("Supabase products insert error:", error);
          throw error;
        }
      } else if (type === 'clients') {
        console.log("Upserting clients data:", JSON.stringify(data.slice(0, 2)));
        // Use a more robust upsert or just insert if onConflict fails
        const { error } = await supabase.from('clients').upsert(
          data.map((item: any) => ({ ...item, company_id: companyId })), 
          { onConflict: 'codigo,company_id', ignoreDuplicates: false }
        );
        if (error) {
          console.error("Supabase clients upsert error:", error);
          // Fallback: try inserting one by one or just throw
          throw error;
        }
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error(`Error in /api/sync/excel for ${type}:`, err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/ml/items", async (req, res) => {
    const { companyId } = req.query;
    try {
      const { data: company, error: compError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();

      if (compError || !company) return res.status(404).json({ error: "Empresa no encontrada" });
      if (!company.ml_access_token || !company.ml_user_id) return res.status(401).json({ error: "No autorizado en Mercado Libre" });

      // Fetch items IDs for the user
      const searchRes = await fetch(`https://api.mercadolibre.com/users/${company.ml_user_id}/items/search`, {
        headers: { "Authorization": `Bearer ${company.ml_access_token}` }
      });
      
      if (searchRes.status === 401) {
        return res.status(401).json({ error: "No autorizado en Mercado Libre" });
      }

      const searchData = await searchRes.json();
      
      if (!searchData.results || searchData.results.length === 0) {
        return res.json([]);
      }

      // Fetch details for each item
      const ids = searchData.results.slice(0, 50).join(','); // Limit to 50 for now
      const itemsRes = await fetch(`https://api.mercadolibre.com/items?ids=${ids}`, {
        headers: { "Authorization": `Bearer ${company.ml_access_token}` }
      });
      
      if (itemsRes.status === 401) {
        return res.status(401).json({ error: "No autorizado en Mercado Libre" });
      }

      const itemsData = await itemsRes.json();

      // Fetch local products to relate data
      const { data: localProducts } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId);

      const products = itemsData.map((item: any) => {
        const mlCode = item.body.seller_custom_field || item.body.id;
        const localMatch = localProducts?.find((lp: any) => lp.code === mlCode);
        
        return {
          id: item.body.id,
          code: mlCode,
          name: item.body.title,
          price: item.body.price,
          stock: item.body.available_quantity,
          local_price: localMatch?.price,
          local_stock: localMatch?.stock,
          last_updated: item.body.last_updated || new Date().toISOString()
        };
      });

      res.json(products);
    } catch (err: any) {
      console.error("Error fetching ML items:", err);
      res.status(500).json({ error: err.message });
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
          // Try to find a price at the end of the line or specific position
          // Assuming price might be in the last 10 characters
          const priceStr = line.substring(line.length - 10).trim().replace(',', '.');
          const price = parseFloat(priceStr) || 0;
          
          if (itm_cod && itm_desc) {
            products.push({
              code: itm_cod,
              name: itm_desc,
              price: price,
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

  // Notifications Routes
  app.get("/api/notifications", async (req, res) => {
    const { companyId, isAdmin } = req.query;
    try {
      let query = supabase.from('notifications').select('*').order('created_at', { ascending: false });
      
      if (isAdmin !== 'true' && companyId) {
        query = query.eq('company_id', companyId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      res.json({ success: true, notifications: data || [] });
    } catch (err: any) {
      // If table doesn't exist, return empty array instead of crashing
      if (err.code === '42P01') {
        return res.json({ success: true, notifications: [], message: "Tabla de notificaciones no existe" });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/notifications", async (req, res) => {
    const { company_id, type, title, message, affected_elements } = req.body;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert([{ 
          company_id, 
          type, 
          title, 
          message, 
          affected_elements: affected_elements ? JSON.stringify(affected_elements) : null,
          is_read: false 
        }])
        .select();
      if (error) throw error;
      res.json({ success: true, notification: data?.[0] });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
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
    console.log(`Serving static files from ${distPath}`);
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
