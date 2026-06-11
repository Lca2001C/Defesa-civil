import { createBrowserRouter } from "react-router-dom";
import AppLayout from "./AppLayout";
import NotFoundPage from "./NotFoundPage";
import ProtectedRoute from "./ProtectedRoute";
import PainelPage from "../features/painel/PainelPage";
import LoginPage from "../features/auth/LoginPage";
import FormulariosPage from "../features/formularios/FormulariosPage";
import FormularioDetalhe from "../features/formularios/FormularioDetalhe";
import ImportacaoPage from "../features/importacao/ImportacaoPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <PainelPage /> },
      { path: "formularios", element: <FormulariosPage /> },
      { path: "formularios/:id", element: <FormularioDetalhe /> },
      { path: "importacao", element: <ImportacaoPage /> },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
