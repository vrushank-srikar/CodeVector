'use strict';
require('dotenv').config();

const path                = require('path');
const express             = require('express');
const { testConnection }  = require('./db');
const productsRouter      = require('./routes/products');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());

// CORS — open for development; lock this down in production
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Serve the frontend from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

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
