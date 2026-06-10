// Stub do cliente socket.io para o painel em tempo real.
// A conexao usa a MESMA origem (caminho relativo) e o path vem do runtimeConfig,
// preservando o principio "build once, deploy anywhere". A criacao e lazy: o
// socket so e instanciado quando getSocket() e chamado pela primeira vez.

import { io, type Socket } from "socket.io-client";
import { runtimeConfig } from "./runtimeConfig";

let socket: Socket | null = null;

/**
 * Retorna a instancia unica do socket, criando-a sob demanda.
 * Conecta na origem atual (window.location.origin) usando o path configurado.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: runtimeConfig.socketPath,
      autoConnect: true,
      transports: ["websocket"],
    });
  }
  return socket;
}

/** Encerra e descarta a conexao atual, se existir. */
export function closeSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
