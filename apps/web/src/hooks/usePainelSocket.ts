import { useEffect } from "react";
import { getPainelSocket } from "../lib/socket";

export interface StatusUpdateEvento {
  municipioId: number;
  status: "RESPONDIDO" | "EM_PREENCHIMENTO" | "NAO_RESPONDEU";
  competenciaId: string;
  protocolo?: string;
}

interface Options {
  competenciaId: string | null;
  onStatusUpdate: (evento: StatusUpdateEvento) => void;
  onStats?: (stats: Record<string, number>) => void;
}

export function usePainelSocket({ competenciaId, onStatusUpdate, onStats }: Options) {
  useEffect(() => {
    if (!competenciaId) return;

    const socket = getPainelSocket();

    socket.emit("painel:join", { competenciaId });
    socket.on("painel:status_update", onStatusUpdate);
    if (onStats) socket.on("painel:stats", onStats);

    return () => {
      socket.emit("painel:leave", { competenciaId });
      socket.off("painel:status_update", onStatusUpdate);
      if (onStats) socket.off("painel:stats", onStats);
    };
  }, [competenciaId, onStatusUpdate, onStats]);
}
