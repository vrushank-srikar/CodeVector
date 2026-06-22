'use strict';
require('dotenv').config();

const fs                  = require('fs');
const path                = require('path');
const express             = require('express');
const { testConnection }  = require('./db');
const productsRouter      = require('./routes/products');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─── Resolve public directory ──────────────────────────────────────────────────
// Try multiple locations to handle Docker (/app) and Nixpacks builds
const PUBLIC_CANDIDATES = [
  path.join(process.cwd(), 'public'),
  path.join(__dirname, '..', 'public'),
  path.join(__dirname, 'public'),
  '/app/public',
];
const PUBLIC_DIR = PUBLIC_CANDIDATES.find(p => fs.existsSync(p)) || PUBLIC_CANDIDATES[0];
const INDEX_HTML = path.join(PUBLIC_DIR, 'index.html');

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());

// CORS — open for development; lock this down in production
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Serve static frontend files
app.use(express.static(PUBLIC_DIR));

// Explicit root route — serves index.html or a fallback JSON
app.get('/', (_req, res) => {
  if (fs.existsSync(INDEX_HTML)) {
    return res.sendFile(INDEX_HTML);
  }
  // Fallback if HTML isn't found: redirect to /products
  return res.redirect('/products');
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));
app.use('/products', productsRouter);

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Startup ───────────────────────────────────────────────────────────────────
(async () => {
  try {
    await testConnection();
    app.listen(PORT, () => {
      console.log(`[server] Listening on http://localhost:${PORT}`);
      console.log(`[server] cwd: ${process.cwd()}`);
      console.log(`[server] public dir: ${PUBLIC_DIR} (exists: ${fs.existsSync(PUBLIC_DIR)})`);
      console.log(`[server] index.html: ${INDEX_HTML} (exists: ${fs.existsSync(INDEX_HTML)})`);
      console.log(`[server] Endpoints:`);
      console.log(`         GET /health`);
      console.log(`         GET /products`);
      console.log(`         GET /products?category=Electronics`);
      console.log(`         GET /products?cursor=<token>&limit=50`);
      console.log(`         GET /products/categories`);
    });
  } catch (err) {
    console.error('[server] Failed to connect to DB:', err.message);
    process.exit(1);
  }
})();
