import { io, type Socket } from "socket.io-client";
import { runtimeConfig } from "./runtimeConfig";
import { getAccessToken } from "./auth";

let _painelSocket: Socket | null = null;

/** Retorna (ou cria) o socket para o namespace /painel, com auth JWT. */
export function getPainelSocket(): Socket {
  if (_painelSocket && _painelSocket.connected) return _painelSocket;

  // Remove o sufixo /api para obter a origem base
  const base = runtimeConfig.apiBaseUrl.replace(/\/api\/?$/, "") || "";
  const token = getAccessToken() ?? "";

  _painelSocket = io(`${base}/painel`, {
    auth: { token },
    path: runtimeConfig.socketPath,
    transports: ["websocket"],
    autoConnect: true,
    reconnectionAttempts: 5,
  });

  return _painelSocket;
}

/** Retorna a instância legada (namespace raiz, sem auth). */
export function getSocket(): Socket {
  return getPainelSocket();
}

export function closeSocket(): void {
  _painelSocket?.disconnect();
  _painelSocket = null;
}
