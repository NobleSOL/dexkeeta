import "dotenv/config";
import express from "express";
import cors from "cors";
import keetaRoutes from "./keeta-routes.ts";

export function createServer() {
  const app = express();

  // CORS configuration - Allow Vercel frontend and development
  const corsOptions = {
    origin: [
      'https://dexkeeta.vercel.app',
      'http://localhost:8080',
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };

  // Middleware
  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  // Keeta DEX API routes
  app.use(keetaRoutes);

  return app;
}
