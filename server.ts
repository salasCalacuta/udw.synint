import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    session({
      secret: "meli-sync-secret",
      resave: false,
      saveUninitialized: true,
      cookie: {
        secure: true,
        sameSite: "none",
        httpOnly: true,
      },
    })
  );

  // Mercado Libre OAuth Configuration
  const MELI_CLIENT_ID = process.env.MELI_CLIENT_ID;
  const MELI_CLIENT_SECRET = process.env.MELI_CLIENT_SECRET;
  const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
  const REDIRECT_URI = `${APP_URL}/auth/callback`;

  console.log("Meli Config:", { MELI_CLIENT_ID: MELI_CLIENT_ID ? "Set" : "Missing", REDIRECT_URI });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // 1. Get OAuth URL
  app.get("/api/auth/url", (req, res) => {
    if (!MELI_CLIENT_ID) {
      return res.status(500).json({ error: "MELI_CLIENT_ID not configured" });
    }
    const authUrl = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${MELI_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    res.json({ url: authUrl });
  });

  // 2. OAuth Callback
  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("No code provided");
    }

    try {
      const response = await axios.post(
        "https://api.mercadolibre.com/oauth/token",
        new URLSearchParams({
          grant_type: "authorization_code",
          client_id: MELI_CLIENT_ID!,
          client_secret: MELI_CLIENT_SECRET!,
          code: code as string,
          redirect_uri: REDIRECT_URI,
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const tokens = response.data;
      
      // In a real app, you'd associate these tokens with the user in Firestore here.
      // For now, we'll send them back to the client via postMessage.
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  tokens: ${JSON.stringify(tokens)} 
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Autenticación exitosa. Esta ventana se cerrará automáticamente.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error("OAuth Error:", error.response?.data || error.message);
      res.status(500).send("Error during authentication");
    }
  });

  // 3. Proxy Mercado Libre API calls (to keep tokens secure)
  app.post("/api/meli/proxy", async (req, res) => {
    const { method, url, data, token } = req.body;

    try {
      const response = await axios({
        method,
        url: `https://api.mercadolibre.com${url}`,
        data,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Fallback for SPA in development if vite middleware doesn't catch it
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const fs = await import("fs");
        const template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        const html = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    console.log("Starting server in PRODUCTION mode");
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
