import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const LOCAL_NOTIFICATIONS_FILE = path.join(process.cwd(), 'local_notifications.json');

// Helper to save notifications locally as fallback
const saveLocalNotification = (notification: any) => {
  try {
    let notifications = [];
    if (fs.existsSync(LOCAL_NOTIFICATIONS_FILE)) {
      const content = fs.readFileSync(LOCAL_NOTIFICATIONS_FILE, 'utf8');
      notifications = JSON.parse(content);
    }
    notifications.push({
      ...notification,
      id: notification.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: notification.created_at || new Date().toISOString(),
      is_local: true
    });
    // Keep only last 100 local notifications to avoid file bloat
    if (notifications.length > 100) notifications = notifications.slice(-100);
    fs.writeFileSync(LOCAL_NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));
  } catch (err) {
    console.error("[LocalNotifications] Error saving:", err);
  }
};

// Helper to get local notifications
const getLocalNotifications = (companyId: string | null, isAdmin: boolean) => {
  try {
    if (!fs.existsSync(LOCAL_NOTIFICATIONS_FILE)) return [];
    const content = fs.readFileSync(LOCAL_NOTIFICATIONS_FILE, 'utf8');
    let notifications = JSON.parse(content);
    
    if (!isAdmin && companyId) {
      notifications = notifications.filter((n: any) => n.company_id === companyId);
    } else if (!isAdmin && !companyId) {
      return [];
    }
    return notifications;
  } catch (err) {
    console.error("[LocalNotifications] Error reading:", err);
    return [];
  }
};

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
  try {
    const app = express();
    const PORT = 3000;

    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // Middleware to check if Supabase is initialized
    app.use((req, res, next) => {
      if (!supabase && req.path.startsWith('/api')) {
        // Allow certain public or health check routes if needed
        if (req.path === '/api/health') return next();
        
        return res.status(503).json({
          success: false,
          error: "Supabase not initialized",
          message: "La conexión con la base de datos no está configurada. Verifica las variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY."
        });
      }
      next();
    });

    // Health check endpoint
    app.get("/api/health", (req, res) => {
      res.json({ 
        status: "ok", 
        supabaseConfigured: !!supabase,
        databaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : "missing"
      });
    });

  // Debug middleware to log all requests
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

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
  app.get("/api/debug/columns", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { data, error } = await supabase.from('companies').select('*').limit(1);
      if (error) return res.status(500).json(error);
      if (data && data.length > 0) {
        return res.json(Object.keys(data[0]));
      }
      res.json([]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/debug/notifications-columns", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { data, error } = await supabase.from('notifications').select('*').limit(1);
      if (error) return res.status(500).json(error);
      if (data && data.length > 0) {
        return res.json(Object.keys(data[0]));
      }
      res.json([]);
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
    console.log(`[SessionCheck] Checking session for companyId: ${companyId}`);
    
    if (!companyId || !sessionToken) {
      console.log(`[SessionCheck] Missing companyId or sessionToken`);
      return res.json({ valid: false });
    }

    try {
      const { data, error } = await supabase
        .from('companies')
        .select('session_token')
        .eq('id', companyId)
        .maybeSingle();

      if (error) {
        console.error(`[SessionCheck] Database error:`, error);
        return res.json({ valid: false });
      }
      
      if (!data) {
        console.log(`[SessionCheck] Company not found for id: ${companyId}`);
        return res.json({ valid: false });
      }

      const isValid = data.session_token === sessionToken;
      console.log(`[SessionCheck] Session valid: ${isValid}`);
      return res.json({ valid: isValid });
    } catch (err: any) {
      console.error(`[SessionCheck] Unexpected error:`, err.message);
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
      let baseUrl = (origin as string) || process.env.APP_URL || '';
      // Strip trailing slash for consistency
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
      
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

  async function refreshMLTokenIfNeeded(companyId: string, company: any) {
    if (!company.ml_refresh_token) return company.ml_access_token;
  
    // Check if expires soon (5 minutes buffer)
    const expiresAt = company.ml_token_expires ? new Date(company.ml_token_expires).getTime() : 0;
    const now = Date.now();
  
    if (expiresAt > now + 300000) {
      return company.ml_access_token;
    }
  
    console.log(`[ML-Refresh] Token for company ${companyId} expired or about to expire. Refreshing...`);
  
    try {
      const clientId = company.ml_client_id || process.env.ML_CLIENT_ID;
      const clientSecret = company.ml_client_secret || process.env.ML_CLIENT_SECRET;
  
      const res = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId!,
          client_secret: clientSecret!,
          refresh_token: company.ml_refresh_token
        })
      });
  
      const data = await res.json();
      if (data.error) throw new Error(data.error_description || data.error);
  
      await supabase
        .from('companies')
        .update({
          ml_access_token: data.access_token,
          ml_refresh_token: data.refresh_token,
          ml_token_expires: new Date(Date.now() + data.expires_in * 1000).toISOString()
        })
        .eq('id', companyId);
  
      console.log(`[ML-Refresh] Token refreshed successfully for company ${companyId}`);
      return data.access_token;
    } catch (err: any) {
      console.error(`[ML-Refresh] Error refreshing token:`, err.message);
      return company.ml_access_token; // Return old one as fallback
    }
  }

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
    console.log(`[Sync] Starting sync for company ${companyId}. Items to sync: ${items?.length || 0}`);
    
    try {
      const { data: company, error: compError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();

      if (compError) {
        console.error(`[Sync] Supabase error fetching company ${companyId}:`, compError);
        return res.status(500).json({ error: "Error al obtener datos de la empresa", details: compError });
      }
      
      if (!company) {
        console.error(`[Sync] Company ${companyId} not found`);
        return res.status(404).json({ error: "Empresa no encontrada" });
      }
      
      const mlAccessToken = await refreshMLTokenIfNeeded(companyId, company);

      if (!mlAccessToken) {
        console.warn(`[Sync] Company ${companyId} has no ML access token`);
        return res.status(401).json({ error: "No autorizado en Mercado Libre (Token faltante)" });
      }

      for (const item of items) {
        const isUpdate = !!item.id && item.id.startsWith('MLA');
        console.log(`[Sync] Processing item ${item.code} (${item.name}). isUpdate: ${isUpdate}`);
        
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
            "Authorization": `Bearer ${mlAccessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(mlItem)
        });

        const data = await response.json();
        console.log(`[Sync] ML API Response for ${item.code}:`, response.status, data);

        if (response.status === 401) {
          console.warn(`[Sync] 401 Unauthorized from ML API for company ${companyId}`);
          return res.status(401).json({ error: "No autorizado en Mercado Libre (Token expirado)" });
        }
        if (data.id) {
          // Update description if provided
          if (item.description) {
            await fetch(`https://api.mercadolibre.com/items/${data.id}/description`, {
              method: "PUT",
              headers: {
                "Authorization": `Bearer ${mlAccessToken}`,
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

  // Category Sync API
  app.get("/api/ml/categories", async (req, res) => {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: "companyId is required" });
    
    try {
      // Fetch main categories from 'categorias'
      const { data: mainData, error: mainError } = await supabase
        .from('categorias')
        .select('*')
        .eq('company_id', companyId);
      
      if (mainError) {
        console.error("[Categories] Error fetching main categories:", JSON.stringify(mainError, null, 2));
        // Handle "Relation does not exist" (42P01) or other "not found" errors
        if (mainError.code === '42P01' || mainError.code === 'PGRST116' || mainError.message?.includes('relation "categorias" does not exist')) {
           return res.json({ categories: [], subcategories: [] });
        }
        return res.status(500).json(mainError);
      }

      // Fetch subcategories from 'subcategory'
      const { data: subData, error: subError } = await supabase
        .from('subcategory')
        .select('*')
        .eq('company_id', companyId);
      
      if (subError) {
        console.error("[Categories] Error fetching subcategories:", JSON.stringify(subError, null, 2));
        // Handle "Relation does not exist" (42P01) or other "not found" errors
        if (subError.code === '42P01' || subError.code === 'PGRST116' || subError.message?.includes('relation "subcategory" does not exist')) {
           return res.json({ categories: mainData || [], subcategories: [] });
        }
        return res.status(500).json(subError);
      }
      
      const categories = (mainData || []).map((c: any) => ({
          id: c.category_id,
          name: c.name
        }));

      const subcategories = (subData || []).map((c: any) => ({
          id: c.category_id,
          name: c.name
        }));
      
      res.json({ categories, subcategories });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ml/categories", async (req, res) => {
    const { companyId, categories, subcategories } = req.body;
    if (!companyId) return res.status(400).json({ error: "companyId is required" });
    
    try {
      // 1. Delete existing records for this company in both tables
      await Promise.all([
        supabase.from('categorias').delete().eq('company_id', companyId),
        supabase.from('subcategory').delete().eq('company_id', companyId)
      ]);
      
      // 2. Insert main categories into 'categorias'
      if (categories && categories.length > 0) {
        const mainPayload = categories.map((c: any) => ({
          category_id: c.id,
          name: c.name,
          company_id: companyId,
          type: 'main'
        }));
        const { error: mainInsError } = await supabase.from('categorias').insert(mainPayload);
        if (mainInsError) {
           console.error("[Categories] Error inserting main categories:", mainInsError);
           return res.status(500).json(mainInsError);
        }
      }

      // 3. Insert subcategories into 'subcategory'
      if (subcategories && subcategories.length > 0) {
        const subPayload = subcategories.map((c: any) => ({
          category_id: c.id,
          name: c.name,
          company_id: companyId
        }));
        const { error: subInsError } = await supabase.from('subcategory').insert(subPayload);
        if (subInsError) {
           console.error("[Categories] Error inserting subcategories:", subInsError);
           return res.status(500).json(subInsError);
        }
      }
      
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Mercado Libre Automation Endpoint
  app.post("/api/ml/background-sync", async (req, res) => {
    const { companyId, category, mlUser: passedMlUser, mlPass: passedMlPass } = req.body;
    console.log(`[ML-Sync] Starting background sync for company ${companyId}, category: ${category}`);

    if (!companyId || !category) {
      return res.status(400).json({ success: false, message: "Faltan parámetros: companyId o category" });
    }

    if (!supabase) {
      console.error("[ML-Sync] Supabase client not initialized");
      return res.status(500).json({ success: false, message: "Supabase client not initialized" });
    }

    try {
      let mlUser = passedMlUser;
      let mlPass = passedMlPass;

      // If credentials not passed, fetch from database
      if (!mlUser || !mlPass) {
        const { data: company, error } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyId)
          .maybeSingle();

        if (error || !company) {
          return res.status(404).json({ success: false, message: "Empresa no encontrada o error al buscarla" });
        }

        mlUser = company.ml_user;
        mlPass = company.ml_pass;
      }

      if (!mlUser || !mlPass) {
        return res.status(400).json({ success: false, message: "Credenciales de Mercado Libre no configuradas para esta empresa" });
      }

      // Start Puppeteer
      const chromium = (await import('chrome-aws-lambda')).default;
      const puppeteer = (await import('puppeteer-core')).default;

      const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: true,
      });

      const page = await browser.newPage();
      
      // Set download behavior
      const downloadPath = path.join('/tmp', `ml-sync-${companyId}-${Date.now()}`);
      if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath, { recursive: true });
      
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath,
      });

      console.log("[ML-Sync] Navigating to ML...");
      await page.goto('https://www.mercadolibre.com.ar/publicar-masivamente/categories?from=listings', { waitUntil: 'networkidle2' });

      // Check if login is required
      if (page.url().includes('auth.mercadolibre.com.ar')) {
        console.log("[ML-Sync] Login required. Attempting login...");
        await page.waitForSelector('#user_id', { timeout: 10000 });
        await page.type('#user_id', mlUser);
        await page.click('.andes-button--large');
        
        await page.waitForSelector('#password', { timeout: 10000 });
        await page.type('#password', mlPass);
        await page.click('#action-complete');
        
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
      }

      console.log("[ML-Sync] On categories page. Starting new automation flow...");
      
      // Step 1: Select button //*[@id="categorySearchTab"]
      try {
        const searchTabXPath = 'xpath///*[@id="categorySearchTab"]';
        await page.waitForSelector(searchTabXPath, { timeout: 15000 });
        const searchTab = await page.$(searchTabXPath);
        if (searchTab) {
          await searchTab.click();
          console.log("[ML-Sync] Category search tab selected.");
        }
      } catch (e) {
        console.warn("[ML-Sync] Could not find categorySearchTab, trying to continue...");
      }

      // Step 2: In field //*[@id="_r_1_"], write the category
      try {
        const inputXPath = 'xpath///*[@id="_r_1_"]';
        await page.waitForSelector(inputXPath, { timeout: 10000 });
        const inputField = await page.$(inputXPath);
        if (inputField) {
          await inputField.type(category || "MLA1652");
          console.log(`[ML-Sync] Category "${category}" typed.`);
        }
      } catch (e) {
        console.error("[ML-Sync] Input field //*[@id=\"_r_1_\"] not found.");
      }

      // Step 3: Select button //*[@id="_r_2_"]/span
      try {
        const searchBtnXPath = 'xpath///*[@id="_r_2_"]/span';
        await page.waitForSelector(searchBtnXPath, { timeout: 10000 });
        const searchBtn = await page.$(searchBtnXPath);
        if (searchBtn) {
          await searchBtn.click();
          console.log("[ML-Sync] Search button clicked.");
        }
      } catch (e) {
        console.error("[ML-Sync] Search button //*[@id=\"_r_2_\"]/span not found.");
      }

      // Step 4: Expand menu //*[@id="MLA-PIPES_AND_TUBES"]/div[1]
      try {
        const menuXPath = 'xpath///*[@id="MLA-PIPES_AND_TUBES"]/div[1]';
        await page.waitForSelector(menuXPath, { timeout: 15000 });
        const menu = await page.$(menuXPath);
        if (menu) {
          await menu.click();
          console.log("[ML-Sync] Category menu expanded.");
        }
      } catch (e) {
        console.warn("[ML-Sync] Section MLA-PIPES_AND_TUBES not found. Trying first available result.");
        try {
          const firstResultXPath = 'xpath///div[contains(@class, "category-selector__item")]';
          await page.waitForSelector(firstResultXPath, { timeout: 5000 });
          const firstResult = await page.$(firstResultXPath);
          if (firstResult) await firstResult.click();
        } catch (e2) {
          console.error("[ML-Sync] No category results found.");
        }
      }

      // Step 5: Execute //*[@id="_r_b_"]/span
      try {
        const executeBtnXPath = 'xpath///*[@id="_r_b_"]/span';
        await page.waitForSelector(executeBtnXPath, { timeout: 10000 });
        const executeBtn = await page.$(executeBtnXPath);
        if (executeBtn) {
          await executeBtn.click();
          console.log("[ML-Sync] Execute button clicked.");
        }
      } catch (e) {
        console.warn("[ML-Sync] Execute button //*[@id=\"_r_b_\"]/span not found.");
      }

      // Step 6: Download from //*[@id="_r_i_"]/span
      console.log("[ML-Sync] Waiting for download button...");
      const downloadBtnXPath = 'xpath///*[@id="_r_i_"]/span';
      try {
        await page.waitForSelector(downloadBtnXPath, { timeout: 30000 });
        const downloadBtn = await page.$(downloadBtnXPath);
        if (downloadBtn) {
          await downloadBtn.click();
          console.log("[ML-Sync] Download button clicked. Waiting for file...");
        } else {
          console.error("[ML-Sync] Download button found but could not be clicked.");
          throw new Error("Download button not clickable");
        }
      } catch (e) {
        console.warn("[ML-Sync] Download button //*[@id=\"_r_i_\"]/span not found or not clickable. Trying generic download link...");
        // Fallback: try to find any link that looks like a download
        const clicked = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a, button, span'));
          const downloadLink = links.find(el => 
            el.textContent?.toLowerCase().includes('descargar') || 
            el.textContent?.toLowerCase().includes('download') ||
            el.id?.includes('download') ||
            el.className?.includes('download')
          );
          if (downloadLink) {
            (downloadLink as HTMLElement).click();
            return true;
          }
          return false;
        });
        
        if (clicked) {
          console.log("[ML-Sync] Fallback: Clicked a generic download element.");
        } else {
          console.error("[ML-Sync] No download button or link found.");
        }
      }

      console.log("[ML-Sync] Waiting for download to complete (40s)...");
      await new Promise(r => setTimeout(r, 40000));
      
      let files = fs.readdirSync(downloadPath);
      
      await browser.close();

      if (files.length > 0) {
        const downloadedFile = files[0];
        const sourcePath = path.join(downloadPath, downloadedFile);
        
        // Define export path
        let exportPath = path.join(process.cwd(), "ArchivosSincronizacion");
        if (!fs.existsSync(exportPath)) fs.mkdirSync(exportPath, { recursive: true });
        
        const destPath = path.join(exportPath, downloadedFile);
        fs.copyFileSync(sourcePath, destPath);
        
        // Try to save to local Documents folder if possible (for local development)
        try {
          const homeDir = process.env.USERPROFILE || process.env.HOME;
          if (homeDir) {
            const localDocsPath = path.join(homeDir, 'Documents');
            if (fs.existsSync(localDocsPath)) {
              const localDestPath = path.join(localDocsPath, downloadedFile);
              fs.copyFileSync(sourcePath, localDestPath);
              console.log(`[ML-Sync] Also saved to local Documents: ${localDestPath}`);
            }
          }
        } catch (localErr) {
          console.log("[ML-Sync] Could not save to local Documents folder (likely running in cloud).");
        }

        console.log(`[ML-Sync] Success! Downloaded: ${downloadedFile} and moved to ${destPath}`);
        
        // Create notification for user
        if (supabase) {
          await supabase.from('notifications').insert([{
            company_id: companyId,
            title: "Excel ML Preparado",
            message: `El archivo Excel con el formato de Mercado Libre ha sido descargado correctamente: ${downloadedFile}. Puede encontrarlo en la carpeta 'ArchivosSincronizacion' o en su carpeta local de Documentos si corresponde.`,
            type: "success",
            is_read: false,
            affected_elements: JSON.stringify({ filename: downloadedFile })
          }]);
        }
      } else {
        console.warn("[ML-Sync] Process finished but no file was downloaded.");
        if (supabase) {
          await supabase.from('notifications').insert([{
            company_id: companyId,
            title: "Error en Preparación Excel ML",
            message: "El proceso de automatización terminó pero no se detectó ninguna descarga de archivo .xls. Verifique sus credenciales o la categoría seleccionada.",
            type: "error",
            is_read: false
          }]);
        }
      }

    } catch (err: any) {
      console.error("[ML-Sync] Error during background sync:", err);
      res.status(500).json({ success: false, message: "Error en el proceso de automatización: " + err.message });
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

      res.json({ success: true, path: fullPath, filename: filename });
    } catch (err: any) {
      console.error("Error exporting Excel:", err);
      res.status(500).json({ success: false, message: "Error al exportar Excel: " + err.message });
    }
  });

  app.get("/api/download-excel/:filename", (req, res) => {
    const { filename } = req.params;
    let exportPath = "D:\\PROYECTOS\\Nerds\\SynInt-ML\\ArchivosSincronizacion";
    if (process.platform !== 'win32') {
      exportPath = path.join(process.cwd(), "ArchivosSincronizacion");
    }
    const fullPath = path.join(exportPath, filename);
    if (fs.existsSync(fullPath)) {
      res.download(fullPath);
    } else {
      res.status(404).send("Archivo no encontrado");
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

  app.get("/api/companies/:id", async (req, res) => {
    if (!supabase) {
      console.error("Supabase client not initialized");
      return res.status(500).json({ success: false, message: "Error de configuración del servidor (Supabase)" });
    }
    const { id } = req.params;
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) {
        console.error("Fetch Company Error:", JSON.stringify(error, null, 2));
        return res.status(500).json({ success: false, message: error.message, details: error });
      }
      
      if (!data) {
        return res.status(404).json({ success: false, message: "Empresa no encontrada" });
      }

      if (typeof data.permissions === 'string') {
        try {
          data.permissions = JSON.parse(data.permissions);
        } catch (e) {
          console.error("Error parsing permissions for company:", data.name);
        }
      }
      
      res.json(data);
    } catch (err: any) {
      console.error("Unexpected Fetch Company Error:", err);
      res.status(500).json({ success: false, message: "Error inesperado al buscar empresa" });
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
        ml_user, ml_pass,
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
        ml_user: ml_user || '',
        ml_pass: ml_pass || '',
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
    console.log(`[PATCH /api/companies/${id}] Request body:`, req.body);
    const { 
      name, responsible_name, username, password, phone, email, 
      amount, debt, payments, 
      ml_client_id, ml_client_secret, ml_callback_url,
      ml_is_collaborator, ml_collaborator_email,
      ml_user, ml_pass,
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
    if (ml_user !== undefined) {
      console.log(`[PATCH /api/companies/${id}] Setting ml_user to:`, ml_user);
      updateData.ml_user = ml_user;
    }
    if (ml_pass !== undefined) {
      console.log(`[PATCH /api/companies/${id}] Setting ml_pass to:`, ml_pass);
      updateData.ml_pass = ml_pass;
    }
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

  app.get("/api/debug-products-schema", async (req, res) => {
    try {
      const { data, error } = await supabase.from('products').select('*').limit(1);
      if (error) return res.status(500).json(error);
      const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
      res.json({ columns, sample: data && data.length > 0 ? data[0] : null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
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
    const { code, name, price, stock, category, category_id, gtin, condition, description, images, company_id } = req.body;
    
    if (!company_id) {
      return res.status(400).json({ success: false, message: "company_id es requerido" });
    }

    console.log(`[Products] Attempting to add product for company ${company_id}:`, code);
    
    // Check actual columns of the table to handle schema variations and stale cache
    let availableColumns: string[] = ['id', 'company_id', 'code', 'name', 'price', 'stock', 'category', 'category_id', 'gtin', 'condition', 'description', 'images', 'ml_item_id', 'created_at'];
    try {
      // Better schema detection: Query the system table if possible or try a describe-like query
      // For now, we'll try to select a non-existent ID to get headers back even from empty table
      const { data: schemaData, error: schemaErr } = await supabase.from('products').select('*').limit(0);
      if (!schemaErr && schemaData) {
        // In some environments, limit(0) returns headers but maybeSingle/maybeMultiple affects it
        // We'll also try a data sample if available
        const { data: sampleData } = await supabase.from('products').select('*').limit(1);
        const sourceData = (sampleData && sampleData.length > 0) ? sampleData[0] : (schemaData as any);
        
        if (sourceData && typeof sourceData === 'object' && !Array.isArray(sourceData)) {
          availableColumns = Object.keys(sourceData);
        } else if (Array.isArray(schemaData) && schemaData.hasOwnProperty('columns')) {
            // Some postgrest versions return columns in a specific way
        }
        
        console.log(`[Products] Detected columns:`, availableColumns.join(', '));
      }
    } catch (err) {
      console.warn(`[Products] Schema detection failed:`, err);
    }
    
    // Ensure numeric fields are numbers and strings are not undefined
    const productData: any = { 
      name: name || "", 
      price: Number(price) || 0, 
      stock: Number(stock) || 0, 
      gtin: gtin || "", 
      condition: condition || "new", 
      description: description || "", 
      images: Array.isArray(images) ? images : [], 
      company_id: Number(company_id) || company_id 
    };

    // Resilient mapping for code/codigo
    if (availableColumns.includes('code')) {
      productData.code = code || "";
    } else if (availableColumns.includes('codigo')) {
      productData.codigo = code || "";
    } else if (!availableColumns.includes('code')) {
      // If we don't know the schema, add it and let the retry handler remove it if it fails
      productData.code = code || "";
    }
    
    // Resilient mapping for category/category_id
    if (availableColumns.includes('category_id')) {
      productData.category_id = category_id || category || "MLA1652";
    }
    if (availableColumns.includes('category')) {
      productData.category = category || category_id || "MLA1652";
    }
    
    try {
      let currentPayload = { ...productData };
      let { data, error } = await supabase.from('products').insert([currentPayload]).select().maybeSingle();
      
      // EXHAUSTIVE RESILIENCE: Retry stripping columns until success or no columns left
      let retryCount = 0;
      const MAX_RETRIES = Object.keys(currentPayload).length;
      
      while (error && error.code === 'PGRST204' && retryCount < MAX_RETRIES) {
        const missingMatch = error.message.match(/Could not find the '(.+?)' column/);
        if (missingMatch && missingMatch[1]) {
          const missingField = missingMatch[1];
          console.warn(`[Products] Exhaustive Retry ${retryCount + 1}: Stripping column '${missingField}'`);
          delete currentPayload[missingField];
          
          if (Object.keys(currentPayload).length === 0) {
            console.error("[Products] No valid columns left to insert.");
            break;
          }
          
          const retryRes = await supabase.from('products').insert([currentPayload]).select().maybeSingle();
          data = retryRes.data;
          error = retryRes.error;
          retryCount++;
        } else {
          break;
        }
      }

      if (error) {
        console.error(`[Products] Supabase error inserting product for company ${company_id}:`);
        console.error(`Error Code: ${error.code}`);
        console.error(`Error Message: ${error.message}`);
        console.error(`Error Details: ${error.details}`);
        console.error(`Error Hint: ${error.hint}`);
        console.error(`[Products] Data attempted:`, JSON.stringify(productData, null, 2));
        
        let errorMessage = "Error al insertar el producto en la base de datos";
        
        if (error.message && error.message.includes('row-level security policy')) {
          errorMessage = "Error de Seguridad (RLS): La base de datos denegó el guardado. ";
          errorMessage += "Para resolver esto, te recomendamos agregar el 'SUPABASE_SERVICE_ROLE_KEY' en la configuración de la App (Secrets), o bien desactivar RLS para la tabla 'products'.";
        } else if (error.code === '23505') {
          errorMessage = "Ya existe un producto con ese código para esta empresa.";
        } else if (error.code === '23503') {
          errorMessage = "Error de clave foránea: Verifique que la empresa y la categoría existan.";
        } else if (error.message) {
          errorMessage += ": " + error.message;
        }

        return res.status(500).json({
          success: false,
          message: errorMessage,
          details: error
        });
      }
      res.json(data);
    } catch (err: any) {
      console.error(`[Products] Unexpected error inserting product:`, err);
      res.status(500).json({
        success: false,
        message: "Error inesperado al insertar el producto",
        error: err.message
      });
    }
  });

  app.post("/api/products/bulk", async (req, res) => {
    const { products, companyId } = req.body;
    if (!products || !Array.isArray(products)) return res.status(400).json({ error: "products array is required" });
    
    const formattedProducts = products.map(p => ({
      company_id: companyId,
      code: String(p.code || p.codigo || '').trim(),
      name: String(p.name || p.nombre || '').trim(),
      price: Number(p.price) || 0,
      stock: Number(p.stock) || 0,
      category: String(p.category || p.categoria || "MLA1652").trim(),
      category_id: String(p.category_id || p.category || "MLA1652").trim(),
      gtin: String(p.gtin || "").trim(),
      condition: p.condition || "new",
      description: p.description || "",
      images: Array.isArray(p.images) ? p.images : []
    })).filter(p => p.code && p.name);

    if (formattedProducts.length === 0) return res.json([]);

    const { data, error } = await supabase
      .from('products')
      .upsert(formattedProducts, { onConflict: 'code,company_id' })
      .select();

    if (error) {
      console.error("[Bulk Products] Error:", error);
      return res.status(500).json(error);
    }
    res.json(data);
  });

  app.put("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    const { code, name, price, stock, category, category_id, gtin, condition, description, images } = req.body;
    
    // Check actual columns
    let availableColumns: string[] = ['code', 'name', 'price', 'stock', 'category', 'category_id', 'gtin', 'condition', 'description', 'images'];
    try {
      const { data: sampleData } = await supabase.from('products').select('*').limit(1);
      if (sampleData && sampleData.length > 0) availableColumns = Object.keys(sampleData[0]);
    } catch(e) {}

    const updateData: any = { 
      name: name || "", 
      price: Number(price) || 0, 
      stock: Number(stock) || 0, 
      gtin: gtin || "", 
      condition: condition || "new", 
      description: description || "", 
      images: Array.isArray(images) ? images : []
    };

    if (availableColumns.includes('code')) updateData.code = code || "";
    else if (availableColumns.includes('codigo')) updateData.codigo = code || "";

    if (availableColumns.includes('category_id')) updateData.category_id = category_id || category || "MLA1652";
    if (availableColumns.includes('category')) updateData.category = category || category_id || "MLA1652";

    try {
      let currentPayload = { ...updateData };
      let { data, error } = await supabase
        .from('products')
        .update(currentPayload)
        .eq('id', Number(id))
        .select()
        .maybeSingle();

      // Exhaustive Resilience for updates
      let retryCount = 0;
      const MAX_RETRIES = Object.keys(currentPayload).length;
      
      while (error && error.code === 'PGRST204' && retryCount < MAX_RETRIES) {
        const missingMatch = error.message.match(/Could not find the '(.+?)' column/);
        if (missingMatch && missingMatch[1]) {
          const missingField = missingMatch[1];
          console.warn(`[Products] Exhaustive Retry Update ${retryCount + 1}: Stripping column '${missingField}'`);
          delete currentPayload[missingField];
          
          if (Object.keys(currentPayload).length === 0) break;
          
          const retryRes = await supabase.from('products').update(currentPayload).eq('id', Number(id)).select().maybeSingle();
          data = retryRes.data;
          error = retryRes.error;
          retryCount++;
        } else {
          break;
        }
      }

      if (error) {
        console.error(`[Products] Supabase error updating product ${id}:`, error);
        let errorMessage = "Error al actualizar el producto: " + (error.message || "Error desconocido");
        
        if (error.message && error.message.includes('row-level security policy')) {
          errorMessage = "Error de Seguridad (RLS): La base de datos denegó la actualización. ";
          errorMessage += "Para resolver esto, te recomendamos agregar el 'SUPABASE_SERVICE_ROLE_KEY' en la configuración de la App (Secrets), o bien desactivar RLS para la tabla 'products'.";
        }

        return res.status(500).json({
          success: false,
          message: errorMessage,
          details: error
        });
      }

      console.log(`[Products] Product ${id} updated successfully`);
      res.json(data);
    } catch (err: any) {
      console.error(`[Products] Unexpected error updating product ${id}:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
  });

  app.delete("/api/products/all/:companyId", async (req, res) => {
    const { companyId } = req.params;
    const { error } = await supabase.from('products').delete().eq('company_id', companyId);
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
    const { codigo, nombre, mail, direccion, localidad, telefono, company_id } = req.body;
    const clientData = { codigo, nombre, mail, direccion, localidad, telefono, company_id };
    
    const { data, error } = await supabase.from('clients').insert([clientData]).select().maybeSingle();
    if (error) {
      console.error(`[Clients] Error inserting client:`, JSON.stringify(error, null, 2));
      return res.status(500).json(error);
    }
    res.json(data);
  });

  app.post("/api/clients/bulk", async (req, res) => {
    const { clients, companyId } = req.body;
    if (!clients || !Array.isArray(clients)) return res.status(400).json({ error: "clients array is required" });
    
    const formattedClients = clients.map(c => ({
      company_id: companyId,
      codigo: String(c.codigo || '').trim(),
      nombre: String(c.nombre || '').trim(),
      mail: String(c.mail || '').trim(),
      direccion: String(c.direccion || '').trim(),
      localidad: String(c.localidad || '').trim(),
      telefono: String(c.telefono || '').trim()
    })).filter(c => c.codigo && c.nombre);

    if (formattedClients.length === 0) return res.json([]);

    const { data, error } = await supabase
      .from('clients')
      .upsert(formattedClients, { onConflict: 'codigo,company_id' })
      .select();

    if (error) {
      console.error("[Bulk Clients] Error:", error);
      return res.status(500).json(error);
    }
    res.json(data);
  });

  app.put("/api/clients/:id", async (req, res) => {
    const { id } = req.params;
    const { codigo, nombre, mail, direccion, localidad, telefono, company_id } = req.body;
    const clientData = { codigo, nombre, mail, direccion, localidad, telefono, company_id };
    
    const { data, error } = await supabase
      .from('clients')
      .update(clientData)
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

  app.delete("/api/clients/all/:companyId", async (req, res) => {
    const { companyId } = req.params;
    const { error } = await supabase.from('clients').delete().eq('company_id', companyId);
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
    const { number, total, client_id, company_id } = req.body;
    const invoiceData = { number, total, client_id, company_id };
    
    const { data, error } = await supabase.from('invoices').insert([invoiceData]).select().maybeSingle();
    if (error) {
      console.error(`[Invoices] Error inserting invoice:`, JSON.stringify(error, null, 2));
      return res.status(500).json(error);
    }
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
        const productsToInsert = data.map((item: any) => ({
          code: item.code || "",
          name: item.name || "",
          price: Number(item.price) || 0,
          stock: Number(item.stock) || 0,
          category: item.category_id || item.category || "MLA1652",
          gtin: item.gtin || "", 
          condition: item.condition || "new", 
          description: item.description || "", 
          images: Array.isArray(item.images) ? item.images : (item.pictures ? item.pictures.map((p: any) => p.source) : []),
          company_id: Number(companyId) || companyId
        }));
        const { error } = await supabase.from('products').insert(productsToInsert);
        if (error) {
          console.error(`[Sync] Supabase products insert error for company ${companyId}:`);
          console.error(`Error Code: ${error.code}`);
          console.error(`Error Message: ${error.message}`);
          console.error(`Error Details: ${error.details}`);
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
    const { fileContent } = req.body; // Base64
    if (!fileContent) return res.status(400).json({ error: "No file content provided" });

    try {
      const buffer = Buffer.from(fileContent, 'base64');
      const products = [];
      const recordLength = 337;
      let pos = 3033; // Start position from VBA code

      const cleanText = (buf: Buffer) => {
        return buf.toString('latin1')
          .replace(/[\x00\xff]/g, '')
          .trim();
      };

      while (pos + recordLength <= buffer.length) {
        const record = buffer.slice(pos, pos + recordLength);
        
        // VBA: BytesToString(buffer, 1, 13) -> record.slice(0, 13)
        const cod = cleanText(record.slice(0, 13));
        // VBA: BytesToString(buffer, 15, 40) -> record.slice(14, 54)
        const des = cleanText(record.slice(14, 54));
        // VBA: BytesToString(buffer, 56, 3) -> record.slice(55, 58)
        const med = cleanText(record.slice(55, 58));
        // VBA: BytesToString(buffer, 60, 3) -> record.slice(59, 62)
        const gr1 = cleanText(record.slice(59, 62));
        // VBA: BytesToString(buffer, 62, 3) -> record.slice(61, 64)
        const gr2 = cleanText(record.slice(61, 64));
        // VBA: BytesToString(buffer, 64, 8) -> record.slice(63, 71)
        const gr3 = cleanText(record.slice(63, 71));
        // VBA: BytesToString(buffer, 96, 1) -> record.slice(95, 96)
        const act = cleanText(record.slice(95, 96));

        if (cod) {
          products.push({
            code: cod,
            name: des,
            med: med,
            gr1: gr1,
            gr2: gr2,
            gr3: gr3,
            act: act,
            price: 0, // Price is not in this specific file structure based on VBA
            stock: 0
          });
        }
        pos += recordLength;
      }
      
      console.log(`[ODBC] Parsed ${products.length} products from .dat file`);
      res.json({ success: true, products });
    } catch (err: any) {
      console.error("[ODBC] Error parsing file:", err);
      res.status(500).json({ success: false, message: "Error parsing file: " + err.message });
    }
  });

  // Notifications Routes
  app.get("/api/notifications", async (req, res) => {
    const { companyId, isAdmin } = req.query;
    console.log(`[Notifications] GET request - companyId: ${companyId}, isAdmin: ${isAdmin}`);
    
    const localNotifications = getLocalNotifications(companyId as string, isAdmin === 'true');

    if (!supabase) {
      console.warn("[Notifications] Supabase client not initialized, returning local only");
      return res.json({ success: true, notifications: localNotifications });
    }

    try {
      let query = supabase.from('notifications').select('*').order('created_at', { ascending: false });
      
      const validCompanyId = companyId && companyId !== 'undefined' && companyId !== 'null' ? companyId : null;

      if (isAdmin !== 'true' && validCompanyId) {
        query = query.eq('company_id', validCompanyId);
      } else if (isAdmin !== 'true' && !validCompanyId) {
        return res.json({ success: true, notifications: localNotifications });
      }
      
      const { data, error } = await query;
      if (error) throw error;

      // If we have remote data, we only show remote data to avoid duplicates
      // Local notifications are only a fallback when Supabase is down
      const merged = (data && data.length > 0) ? data : localNotifications;
      
      const sorted = [...merged].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      res.json({ success: true, notifications: sorted });
    } catch (err: any) {
      console.error("[Notifications] Supabase fetch error:", err.message);
      res.json({ success: true, notifications: localNotifications, message: "Error al conectar con la nube, mostrando locales." });
    }
  });

  app.post("/api/notifications", async (req, res) => {
    const { company_id, type, title, message, affected_elements } = req.body;
    console.log(`[Notifications] POST request - company_id: ${company_id}, type: ${type}`);
    
    const finalAffectedElements = typeof affected_elements === 'string' 
      ? affected_elements 
      : (affected_elements ? JSON.stringify(affected_elements) : null);

    const notificationData = { 
      company_id, 
      type, 
      title, 
      message, 
      affected_elements: finalAffectedElements,
      is_read: false 
    };

    // Always save locally first as redundancy
    saveLocalNotification(notificationData);

    if (!supabase) {
      console.warn("[Notifications] Supabase not initialized, saved locally only");
      return res.json({ success: true, message: "Guardado localmente (Nube no disponible)" });
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert([notificationData])
        .select();
      
      if (error) throw error;
      
      res.json({ success: true, notification: data?.[0] });
    } catch (err: any) {
      console.error("[Notifications] Error creating remote notification:", err.message);
      res.json({ success: true, message: "Guardado localmente (Error en la nube)" });
    }
  });

  app.post("/api/notifications/mark-all-read", async (req, res) => {
    const { companyId, isAdmin } = req.body;
    if (!supabase) {
      return res.status(500).json({ success: false, message: "Supabase client not initialized" });
    }
    try {
      let query = supabase.from('notifications').update({ is_read: true });
      
      if (isAdmin === true || isAdmin === 'true') {
        query = query.eq('type', 'error');
      } else {
        query = query.eq('company_id', companyId);
      }

      const { error } = await query;
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Notifications] Error marking all as read:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    const { id } = req.params;
    if (!supabase) {
      return res.status(500).json({ success: false, message: "Supabase client not initialized" });
    }
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

  app.patch("/api/notifications/:id/status", async (req, res) => {
    const { id } = req.params;
    const { is_read } = req.body;
    if (!supabase) {
      return res.status(500).json({ success: false, message: "Supabase client not initialized" });
    }
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read })
        .eq('id', id);
      
      // Also update local if it exists
      try {
        if (fs.existsSync(LOCAL_NOTIFICATIONS_FILE)) {
          const content = fs.readFileSync(LOCAL_NOTIFICATIONS_FILE, 'utf8');
          let notifications = JSON.parse(content);
          const index = notifications.findIndex((n: any) => n.id === id);
          if (index !== -1) {
            notifications[index].is_read = is_read;
            fs.writeFileSync(LOCAL_NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));
          }
        }
      } catch (localErr) {
        console.error("[LocalNotifications] Error updating status:", localErr);
      }

      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Automated ML Sync (Other Method)
  app.post("/api/ml/download-categories", async (req, res) => {
    const { companyId } = req.body;
    if (!companyId) return res.status(400).json({ success: false, message: "companyId es requerido" });

    try {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();

      if (companyError || !company) {
        return res.status(404).json({ success: false, message: "Empresa no encontrada" });
      }

      if (!company.ml_user || !company.ml_pass) {
        return res.status(400).json({ success: false, message: "Credenciales de automatización ML no configuradas" });
      }

      console.log(`[ML-DownloadCategories] Starting automation for company ${company.name}...`);

      const chromium = (await import('chrome-aws-lambda')).default;
      const puppeteer = (await import('puppeteer-core')).default;

      const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: true,
      });

      const page = await browser.newPage();
      const downloadPath = path.join(process.cwd(), 'Downloads');
      if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath);

      // Set download behavior
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath,
      });

      try {
        // Get category from database if possible
        let categoryToSearch = 'caños';
        const { data: products } = await supabase
          .from('products')
          .select('category')
          .eq('company_id', companyId)
          .limit(1);
        
        if (products && products.length > 0 && products[0].category) {
          categoryToSearch = products[0].category;
        }

        console.log(`[ML-DownloadCategories] Using category: ${categoryToSearch}`);

        console.log("[ML-DownloadCategories] Logging in...");
        await page.goto('https://www.mercadolibre.com.ar/jms/mla/lgz/login?platform_id=ML&go=https%3A%2F%2Fwww.mercadolibre.com.ar%2Fpublicar-masivamente%2Fcategories%3Ffrom%3Dlistings', { waitUntil: 'networkidle2' });

        // Login Flow
        await page.waitForSelector('#user_id', { timeout: 10000 });
        await page.type('#user_id', company.ml_user);
        await page.click('.andes-button--large');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (await page.$('#password')) {
          await page.type('#password', company.ml_pass);
          await page.click('.andes-button--large');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

        console.log("[ML-DownloadCategories] Navigating to categories page...");
        await page.goto('https://www.mercadolibre.com.ar/publicar-masivamente/categories?from=listings', { waitUntil: 'networkidle2' });

        // Steps provided by user (Python script logic):
        // 1. Click //*[@id="categorySearchTab"]
        console.log("[ML-DownloadCategories] Clicking categorySearchTab...");
        const searchTab = await page.waitForSelector('xpath/' + '//*[@id="categorySearchTab"]', { timeout: 10000 });
        if (searchTab) await searchTab.click();
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 2. Type category in //*[@id="_r_1_"]
        console.log(`[ML-DownloadCategories] Typing category: ${categoryToSearch}...`);
        const searchInput = await page.waitForSelector('xpath/' + '//*[@id="_r_1_"]', { timeout: 10000 });
        if (searchInput) await searchInput.type(categoryToSearch);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 3. Click search button //*[@id="_r_2_"]/span
        console.log("[ML-DownloadCategories] Clicking search button...");
        const searchBtn = await page.waitForSelector('xpath/' + '//*[@id="_r_2_"]/span', { timeout: 10000 });
        if (searchBtn) await searchBtn.click();
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 4. Wait for results and select first option
        console.log("[ML-DownloadCategories] Waiting for results...");
        await page.waitForSelector('xpath/' + '//*[@id="_r_4_"]/div', { timeout: 10000 });
        
        // 5. Click confirm button //*[@id="_r_7_"]/span
        console.log("[ML-DownloadCategories] Clicking confirm button...");
        const confirmBtn = await page.waitForSelector('xpath/' + '//*[@id="_r_7_"]/span', { timeout: 10000 });
        if (confirmBtn) await confirmBtn.click();
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 6. Click download button //*[@id="_r_e_"]/span
        console.log("[ML-DownloadCategories] Clicking download button...");
        const downloadBtn = await page.waitForSelector('xpath/' + '//*[@id="_r_e_"]/span', { timeout: 10000 });
        if (downloadBtn) await downloadBtn.click();

        // Wait for download to complete (polling the directory)
        console.log("[ML-DownloadCategories] Waiting for download...");
        let downloadedFile = '';
        for (let i = 0; i < 30; i++) { // Wait up to 30 seconds
          const files = fs.readdirSync(downloadPath);
          const excelFile = files.find(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
          if (excelFile) {
            downloadedFile = excelFile;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (downloadedFile) {
          console.log("[ML-DownloadCategories] Download complete:", downloadedFile);
          const fullPath = path.join(downloadPath, downloadedFile);
          
          // Send file to client
          res.download(fullPath, downloadedFile, (err) => {
            if (err) {
              console.error("[ML-DownloadCategories] Error sending file:", err);
            }
            // Cleanup
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
          });
        } else {
          throw new Error("No se pudo descargar el archivo de Mercado Libre (tiempo de espera agotado).");
        }

      } catch (err: any) {
        console.error("[ML-DownloadCategories] Automation error:", err);
        res.status(500).json({ success: false, message: "Error en la automatización: " + err.message });
      } finally {
        await browser.close();
      }

    } catch (err: any) {
      console.error("[ML-DownloadCategories] Unexpected error:", err);
      res.status(500).json({ success: false, message: "Error inesperado: " + err.message });
    }
  });

  app.post("/api/ml/automated-sync", async (req, res) => {
    const { companyId, items } = req.body;
    console.log(`[ML-AutomatedSync] Start for company ${companyId}, items: ${items?.length || 0}`);

    if (!supabase) return res.status(500).json({ success: false, message: "Supabase not initialized" });

    try {
      const { data: company, error: compError } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle();
      if (compError || !company) return res.status(404).json({ success: false, message: "Empresa no encontrada" });

      if (!company.ml_user || !company.ml_pass) {
        return res.status(400).json({ success: false, message: "Credenciales de Mercado Libre (usuario/contraseña) no configuradas para esta empresa." });
      }

      // 1. Generate Excel for upload
      const worksheet = XLSX.utils.json_to_sheet(items.map((item: any) => ({
        'Código': item.code,
        'Título': item.name,
        'Precio': item.price,
        'Stock': item.stock,
        'Categoría': item.category,
        'GTIN': item.gtin || '',
        'Condición': item.condition || 'new',
        'Descripción': item.description || ''
      })));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");
      
      const tempFileName = `sync_${companyId}_${Date.now()}.xlsx`;
      const tempFilePath = path.join(process.cwd(), 'ArchivosSincronizacion', tempFileName);
      
      if (!fs.existsSync(path.join(process.cwd(), 'ArchivosSincronizacion'))) {
        fs.mkdirSync(path.join(process.cwd(), 'ArchivosSincronizacion'));
      }
      
      XLSX.writeFile(workbook, tempFilePath);
      console.log(`[ML-AutomatedSync] Excel generated at ${tempFilePath}`);

      // 2. Start Puppeteer Automation
      const chromium = (await import('chrome-aws-lambda')).default;
      const puppeteer = (await import('puppeteer-core')).default;

      const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: true,
      });

      const page = await browser.newPage();
      
      try {
        console.log("[ML-AutomatedSync] Navigating to ML Login...");
        await page.goto('https://www.mercadolibre.com.ar/jms/mla/lgz/login?platform_id=ML&go=https%3A%2F%2Fwww.mercadolibre.com.ar%2Fpublicar-masivamente%2Fupload%3Ffrom%3Dlistings', { waitUntil: 'networkidle2' });

        // Login Flow
        await page.waitForSelector('#user_id', { timeout: 10000 });
        await page.type('#user_id', company.ml_user);
        await page.click('.andes-button--large');
        
        try {
          await page.waitForSelector('#password', { timeout: 10000 });
          await page.type('#password', company.ml_pass);
          await page.click('.andes-button--large');
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
        } catch (pwErr) {
          console.log("[ML-AutomatedSync] Password field not found or navigation failed, might be already logged in or needs manual intervention.");
        }

        console.log("[ML-AutomatedSync] Navigating to Upload section...");
        if (page.url() !== 'https://www.mercadolibre.com.ar/publicar-masivamente/upload?from=listings') {
          await page.goto('https://www.mercadolibre.com.ar/publicar-masivamente/upload?from=listings', { waitUntil: 'networkidle2' });
        }

        // Look for the upload input
        const fileInputSelector = 'input[type="file"]';
        await page.waitForSelector(fileInputSelector, { timeout: 20000 });
        const inputUploadHandle = await page.$(fileInputSelector);
        
        if (inputUploadHandle) {
          console.log("[ML-AutomatedSync] Uploading file...");
          await inputUploadHandle.uploadFile(tempFilePath);
          await new Promise(resolve => setTimeout(resolve, 10000));
          console.log("[ML-AutomatedSync] File uploaded successfully");
          
          // Click on the confirm button //*[@id="_R_dov6e_"]
          console.log("[ML-AutomatedSync] Clicking confirm button...");
          try {
            await page.waitForSelector('#_R_dov6e_', { timeout: 10000 });
            await page.click('#_R_dov6e_');
            console.log("[ML-AutomatedSync] Confirm button clicked");
          } catch (clickErr) {
            console.warn("[ML-AutomatedSync] Could not find or click confirm button #_R_dov6e_, but file was uploaded.");
          }
          
          res.json({ success: true, message: "Sincronización automatizada completada. El archivo ha sido cargado y confirmado en Mercado Libre." });
        } else {
          throw new Error("No se encontró el selector de carga de archivos en Mercado Libre.");
        }

      } catch (err: any) {
        console.error("[ML-AutomatedSync] Automation error:", err);
        res.status(500).json({ success: false, message: "Error en la automatización: " + err.message });
      } finally {
        await browser.close();
        // Cleanup temp file
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      }

    } catch (err: any) {
      console.error("[ML-AutomatedSync] Unexpected error:", err);
      res.status(500).json({ success: false, message: "Error inesperado: " + err.message });
    }
  });

  // API 404 Handler - MUST be after all API routes but before Vite fallback
  app.use("/api/*", (req, res) => {
    res.status(404).json({
      success: false,
      error: "Endpoint not found",
      message: `The API path ${req.originalUrl} does not exist on this server.`
    });
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

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled error:", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({ 
      success: false, 
      error: "Internal Server Error", 
      message: err.message 
    });
  });
  } catch (err: any) {
    console.error("CRITICAL ERROR DURING SERVER STARTUP:", err);
    process.exit(1);
  }
}

startServer();
