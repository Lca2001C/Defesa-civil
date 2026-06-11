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
    // Prioriza .ts antes de .js para que o alias dos contratos resolva os
    // arquivos TypeScript originais (não os .js compilados CJS que o Vite
    // não consegue importar como ESM named exports).
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    alias: {
      // Em DEV (HMR) o web aponta direto para o codigo-fonte dos contratos.
      "@dcmg/contracts": fileURLToPath(
        new URL("../../packages/contracts/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 3000,
    strictPort: false,   // tenta a próxima porta livre se 3000 estiver ocupada
    host: "0.0.0.0",     // aceita conexões externas (WSL, rede local, Ngrok)
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "http://localhost:4000",
        changeOrigin: true,
        ws: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
