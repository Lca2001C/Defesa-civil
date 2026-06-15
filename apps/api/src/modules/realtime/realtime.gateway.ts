import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import { PainelService } from '../painel/painel.service';

/** Janela mínima entre broadcasts de stats por competência (anti-tempestade). */
const STATS_THROTTLE_MS = 3000;

export interface StatusMunicipioEvento {
  municipioId: number;
  status: 'RESPONDIDO' | 'EM_PREENCHIMENTO' | 'NAO_RESPONDEU';
  competenciaId: string;
  protocolo?: string;
}

@WebSocketGateway({
  namespace: '/painel',
  cors: { origin: '*', credentials: true },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  /** Timers pendentes de broadcast de stats por competência (throttle). */
  private readonly timersStats = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly painel: PainelService,
  ) {}

  handleConnection(client: Socket) {
    // Valida token JWT no handshake
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.headers?.authorization?.replace('Bearer ', '') ?? '');

    try {
      this.jwt.verify(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      this.logger.debug(`Cliente conectado: ${client.id}`);
    } catch {
      this.logger.warn(`Conexão recusada (token inválido): ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('painel:join')
  async handleJoin(
    @MessageBody() data: { competenciaId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.competenciaId) return;
    const room = `painel:${data.competenciaId}`;
    await client.join(room);
    this.logger.debug(`${client.id} entrou na sala ${room}`);
    return { ok: true, room };
  }

  @SubscribeMessage('painel:leave')
  async handleLeave(
    @MessageBody() data: { competenciaId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `painel:${data.competenciaId}`;
    await client.leave(room);
    return { ok: true };
  }

  /** Emite atualização de status de um município para todos na sala da competência. */
  emitirStatusUpdate(evento: StatusMunicipioEvento) {
    const room = `painel:${evento.competenciaId}`;
    this.server.to(room).emit('painel:status_update', evento);
  }

  /** Emite estatísticas agregadas atualizadas para todos na sala. */
  emitirStats(competenciaId: string, stats: Record<string, number>) {
    const room = `painel:${competenciaId}`;
    this.server.to(room).emit('painel:stats', { competenciaId, ...stats });
  }

  /**
   * Agenda um broadcast de stats da competência com throttle: várias transições
   * em sequência resultam em no máximo uma emissão a cada STATS_THROTTLE_MS.
   * O recompute usa o cache do PainelService (barato).
   */
  agendarBroadcastStats(competenciaId: string) {
    if (this.timersStats.has(competenciaId)) return; // já há um broadcast agendado

    const timer = setTimeout(() => {
      this.timersStats.delete(competenciaId);
      void this.painel
        .buscarEstatisticas(competenciaId)
        .then((stats) => this.emitirStats(competenciaId, stats))
        .catch((e) => this.logger.warn(`Falha ao emitir stats: ${(e as Error).message}`));
    }, STATS_THROTTLE_MS);

    this.timersStats.set(competenciaId, timer);
  }
}
