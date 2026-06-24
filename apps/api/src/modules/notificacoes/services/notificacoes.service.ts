import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Env } from '../../../config/env.validation';
import { escapeHtml } from '../../../shared/utils/format.util';

export type TipoNotificacao =
  | 'submissao_enviada'
  | 'correcao_solicitada'
  | 'submissao_aprovada';

export interface NotificacaoPayload {
  tipo: TipoNotificacao;
  destinatario: string;
  nome: string;
  protocolo: string;
  observacao?: string;
}

const ASSUNTOS: Record<TipoNotificacao, string> = {
  submissao_enviada: 'Submissão recebida — Defesa Civil MG',
  correcao_solicitada: 'Correção solicitada — Defesa Civil MG',
  submissao_aprovada: 'Submissão aprovada — Defesa Civil MG',
};

// Todos os campos vindos de dados do usuário são escapados (anti-injeção de HTML).
const CORPO_HTML: Record<TipoNotificacao, (p: NotificacaoPayload) => string> = {
  submissao_enviada: (p) =>
    `<p>Olá, <strong>${escapeHtml(p.nome)}</strong>.</p>
     <p>Sua submissão foi recebida com sucesso.</p>
     <p>Protocolo: <strong>${escapeHtml(p.protocolo)}</strong></p>`,
  correcao_solicitada: (p) =>
    `<p>Olá, <strong>${escapeHtml(p.nome)}</strong>.</p>
     <p>Uma correção foi solicitada para a submissão <strong>${escapeHtml(p.protocolo)}</strong>.</p>
     ${p.observacao ? `<p>Observação: ${escapeHtml(p.observacao)}</p>` : ''}
     <p>Acesse o sistema para realizar os ajustes.</p>`,
  submissao_aprovada: (p) =>
    `<p>Olá, <strong>${escapeHtml(p.nome)}</strong>.</p>
     <p>A submissão <strong>${escapeHtml(p.protocolo)}</strong> foi aprovada com sucesso.</p>`,
};

/**
 * Envio de e-mails de notificação de forma SÍNCRONA (best-effort).
 *
 * Sem fila/worker: o volume é baixo (instância única) e o envio roda em segundo
 * plano na própria request via `void notificar(...)`. Falhas de SMTP são apenas
 * logadas — nunca derrubam a operação de negócio que disparou a notificação.
 */
@Injectable()
export class NotificacoesService {
  private readonly logger = new Logger(NotificacoesService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    const host = config.get('SMTP_HOST', { infer: true });
    if (host) {
      const port = config.get('SMTP_PORT', { infer: true });
      this.transporter = nodemailer.createTransport({
        host,
        port,
        // 465 = TLS implícito; demais portas usam STARTTLS (requireTLS).
        secure: port === 465,
        requireTLS: port !== 465,
        auth: {
          user: config.get('SMTP_USER', { infer: true }),
          pass: config.get('SMTP_PASS', { infer: true }),
        },
      });
      this.logger.log(`NotificacoesService: SMTP configurado em ${host}:${port}`);
    } else {
      this.transporter = null;
      this.logger.warn('NotificacoesService: SMTP_HOST não configurado — e-mails serão ignorados');
    }
    this.from = config.get('SMTP_FROM', { infer: true });
  }

  async notificar(payload: NotificacaoPayload): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`SMTP ausente — descartando notificação tipo=${payload.tipo}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: payload.destinatario,
        subject: ASSUNTOS[payload.tipo],
        html: CORPO_HTML[payload.tipo](payload),
      });
      this.logger.log(
        `E-mail enviado: tipo=${payload.tipo} para=${payload.destinatario} protocolo=${payload.protocolo}`,
      );
    } catch (e) {
      // Best-effort: nunca propaga erro de e-mail para a operação de negócio.
      this.logger.error(
        `Falha ao enviar e-mail (tipo=${payload.tipo} para=${payload.destinatario}): ${(e as Error).message}`,
      );
    }
  }
}
