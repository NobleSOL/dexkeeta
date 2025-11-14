#!/usr/bin/env node
/**
 * Production server entry point
 * Serves the built Vite client (dist/spa) and API endpoints
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import express directly since we're in production
const express = require('express');

// Dynamically import the server creator
async function startServer() {
  try {
    // Import the createServer function from server/index.ts
    const { createServer } = await import('./server/index.ts');

    const app = createServer();

    // Serve static files from the Vite build output
    const distPath = path.join(__dirname, 'dist', 'spa');
    console.log(`📁 Serving static files from: ${distPath}`);

    app.use(express.static(distPath));

    // Handle SPA routing - all non-API routes return index.html
    app.get('*', (req, res) => {
      // Skip if it's an API route
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Not found' });
      }

      res.sendFile(path.join(distPath, 'index.html'));
    });

    const PORT = process.env.PORT || 8080;

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api`);
      console.log(`🌐 Frontend available at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
