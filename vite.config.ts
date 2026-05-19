import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: true,                // listen on all network interfaces
    port: 2026,
    strictPort: true,
    hmr: {
      host: "localhost",       // keeps WebSocket connection stable
      port: 2026,
      overlay: false,
    },
  },
  plugins: [
    basicSsl(),                // provides HTTPS with a self‑signed certificate
    react({
      devTarget: "es2015",
      useAtYourOwnRisk_mutateSwcOptions(swcOptions) {
        if (swcOptions.jsc) {
          swcOptions.jsc.target = "es2015";
        }
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    target: "es2015",
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "es2015",
    },
  },
  build: {
    target: "es2015",
  },
}));
