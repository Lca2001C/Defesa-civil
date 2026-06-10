// Roteador da aplicacao (createBrowserRouter).
// "/" usa o AppLayout e renderiza o Painel como pagina inicial.
// Qualquer rota desconhecida cai na pagina 404.

import { createBrowserRouter } from "react-router-dom";
import AppLayout from "./AppLayout";
import NotFoundPage from "./NotFoundPage";
import PainelPage from "../features/painel/PainelPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [{ index: true, element: <PainelPage /> }],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
