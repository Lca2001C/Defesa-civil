// Cliente unico do React Query, compartilhado por toda a aplicacao.
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Evita refetch agressivo; o painel em tempo real usara invalidacao
      // explicita e WebSocket para atualizacoes ao vivo.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
