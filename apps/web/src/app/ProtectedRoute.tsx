import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

/** Redireciona para /login se o usuario nao estiver autenticado. */
export default function ProtectedRoute({ children }: Props) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
