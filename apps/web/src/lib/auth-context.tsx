import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  clearTokens,
  getUsuario,
  setTokens,
  type UsuarioLogado,
} from "./auth";

interface AuthContextType {
  usuario: UsuarioLogado | null;
  isAuthenticated: boolean;
  salvarTokens: (accessToken: string, refreshToken: string) => void;
  fazerLogout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(getUsuario);

  // Escuta o evento disparado por api.ts ao receber 401 (token expirado).
  useEffect(() => {
    const handler = () => {
      clearTokens();
      setUsuario(null);
      window.location.replace("/login");
    };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, []);

  const salvarTokens = useCallback(
    (accessToken: string, refreshToken: string) => {
      setTokens(accessToken, refreshToken);
      setUsuario(getUsuario());
    },
    [],
  );

  const fazerLogout = useCallback(() => {
    clearTokens();
    setUsuario(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ usuario, isAuthenticated: !!usuario, salvarTokens, fazerLogout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>.");
  return ctx;
}
