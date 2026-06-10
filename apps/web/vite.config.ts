import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Configuracao do Vite para o SPA da Defesa Civil MG.
// Em desenvolvimento, o proxy encaminha "/api" e "/socket.io" para a API NestJS
// (porta 4000), mantendo o principio "build once, deploy anywhere": o frontend
// sempre fala com a API por caminho RELATIVO, sem URL fixa em tempo de build.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Em DEV (HMR) o web aponta direto para o codigo-fonte dos contratos.
      "@dcmg/contracts": fileURLToPath(
        new URL("../../packages/contracts/src", import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:4000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
