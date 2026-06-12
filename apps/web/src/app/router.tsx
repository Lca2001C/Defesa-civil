import { createBrowserRouter } from "react-router-dom";
import AppLayout from "./AppLayout";
import NotFoundPage from "./NotFoundPage";
import ProtectedRoute from "./ProtectedRoute";
import PainelPage from "../features/painel/PainelPage";
import LoginPage from "../features/auth/LoginPage";
import RecuperarSenhaPage from "../features/auth/RecuperarSenhaPage";
import RedefinirSenhaPage from "../features/auth/RedefinirSenhaPage";
import FormulariosPage from "../features/formularios/FormulariosPage";
import FormularioDetalhe from "../features/formularios/FormularioDetalhe";
import FormularioNovo from "../features/formularios/FormularioNovo";
import FormularioEditar from "../features/formularios/FormularioEditar";
import SubmissoesPage from "../features/submissoes/SubmissoesPage";
import SubmissaoNova from "../features/submissoes/SubmissaoNova";
import SubmissaoDetalhe from "../features/submissoes/SubmissaoDetalhe";
import DashboardPage from "../features/dashboard/DashboardPage";
import CompetenciasPage from "../features/competencias/CompetenciasPage";
import MunicipiosPage from "../features/municipios/MunicipiosPage";
import MunicipioDetalhe from "../features/municipios/MunicipioDetalhe";
import AdminPage from "../features/admin/AdminPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/recuperar-senha",
    element: <RecuperarSenhaPage />,
  },
  {
    path: "/redefinir-senha",
    element: <RedefinirSenhaPage />,
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
      { path: "formularios/novo", element: <FormularioNovo /> },
      { path: "formularios/:id", element: <FormularioDetalhe /> },
      { path: "formularios/:id/versoes/:versaoId/editar", element: <FormularioEditar /> },
      { path: "submissoes", element: <SubmissoesPage /> },
      { path: "submissoes/nova", element: <SubmissaoNova /> },
      { path: "submissoes/:id", element: <SubmissaoDetalhe /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "competencias", element: <CompetenciasPage /> },
      { path: "municipios", element: <MunicipiosPage /> },
      { path: "municipios/:id", element: <MunicipioDetalhe /> },
      { path: "admin", element: <AdminPage /> },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
