// Hook de consulta do health-check da API (/api/health).
// Usado no Painel para exibir o status de disponibilidade da API.

import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export interface RespostaHealth {
  status?: string;
  info?: Record<string, unknown>;
  details?: Record<string, unknown>;
  [chave: string]: unknown;
}

export function useHealth() {
  return useQuery<RespostaHealth>({
    queryKey: ["health"],
    queryFn: () => api.get<RespostaHealth>("/health"),
    // Reavalia periodicamente para refletir a saude da API no painel.
    refetchInterval: 15_000,
    retry: 1,
  });
}
