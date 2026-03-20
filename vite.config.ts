import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 2026,
    hmr: {
      overlay: false,
    },
    allowedHosts: [
      "disconcertedly-unctemplative-tammara.ngrok-free.dev",
      ".ngrok-free.dev",  // This allows any ngrok subdomain
    ],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
