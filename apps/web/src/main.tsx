// Ponto de entrada do SPA da Defesa Civil MG.
// Monta a arvore de providers: tema MUI escuro + CssBaseline, React Query e
// o roteador. A config de runtime ja foi carregada por /env.js no index.html.

import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { tema } from "./theme";
import { queryClient } from "./lib/queryClient";
import { router } from "./app/router";

const elementoRaiz = document.getElementById("root");
if (!elementoRaiz) {
  throw new Error('Elemento raiz "#root" nao encontrado no index.html');
}

createRoot(elementoRaiz).render(
  <React.StrictMode>
    <ThemeProvider theme={tema}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
