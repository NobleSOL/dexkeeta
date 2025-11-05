import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const plugins = [react()];

  // Only add express plugin in development mode
  // In production, the server is run separately via node-build.ts
  if (mode === 'development' && process.env.NODE_ENV !== 'production') {
    // Dynamically import the plugin only in dev mode
    // Using eval to prevent static analysis from trying to resolve the path
    const expressPlugin: Plugin = {
      name: "express-plugin",
      apply: "serve",
      async configureServer(server) {
        const { createServer } = await eval('import("./server/index.js")');
        const app = createServer();
        server.middlewares.use(app);
      },
    };
    plugins.push(expressPlugin);
  }

  return {
    server: {
      host: "::",
      port: 8080,
      fs: {
        allow: [".", "./client", "./shared"],
        deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
      },
    },
    build: {
      outDir: "dist/spa",
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks - split large dependencies
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-web3': ['wagmi', 'viem'],
            'vendor-ui': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-select',
              '@radix-ui/react-tabs',
              '@radix-ui/react-toast',
            ],
          },
        },
      },
      chunkSizeWarningLimit: 1000, // Increase limit to 1MB to reduce warnings
    },
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./client"),
        "@shared": path.resolve(__dirname, "./shared"),
      },
    },
  };
});
