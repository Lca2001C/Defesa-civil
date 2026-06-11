import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export type TipoNotificacao =
  | 'submissao_enviada'
  | 'correcao_solicitada'
  | 'submissao_validada'
  | 'submissao_rejeitada';

export interface NotificacaoPayload {
  tipo: TipoNotificacao;
  destinatario: string;
  nome: string;
  protocolo: string;
  observacao?: string;
}

export const NOTIFICACOES_QUEUE = 'notificacoes';

@Injectable()
export class NotificacoesService {
  private readonly logger = new Logger(NotificacoesService.name);

  constructor(
    @InjectQueue(NOTIFICACOES_QUEUE) private readonly fila: Queue,
  ) {}

  async notificar(payload: NotificacaoPayload): Promise<void> {
    await this.fila.add('enviar-email', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    });
    this.logger.debug(
      `Notificação enfileirada: tipo=${payload.tipo} para=${payload.destinatario} protocolo=${payload.protocolo}`,
    );
  }
}
