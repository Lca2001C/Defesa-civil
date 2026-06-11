import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';

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

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
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
}
