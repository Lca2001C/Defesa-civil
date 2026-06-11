import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import type { Env } from '../../config/env.validation';
import type { NotificacaoPayload } from './notificacoes.service';
import { NOTIFICACOES_QUEUE } from './notificacoes.service';

const ASSUNTOS: Record<NotificacaoPayload['tipo'], string> = {
  submissao_enviada: 'Submissão recebida — Defesa Civil MG',
  correcao_solicitada: 'Correção solicitada — Defesa Civil MG',
  submissao_validada: 'Submissão validada — Defesa Civil MG',
  submissao_rejeitada: 'Submissão rejeitada — Defesa Civil MG',
};

const CORPO_HTML: Record<
  NotificacaoPayload['tipo'],
  (p: NotificacaoPayload) => string
> = {
  submissao_enviada: (p) =>
    `<p>Olá, <strong>${p.nome}</strong>.</p>
     <p>Sua submissão foi recebida com sucesso.</p>
     <p>Protocolo: <strong>${p.protocolo}</strong></p>`,
  correcao_solicitada: (p) =>
    `<p>Olá, <strong>${p.nome}</strong>.</p>
     <p>Uma correção foi solicitada para a submissão <strong>${p.protocolo}</strong>.</p>
     ${p.observacao ? `<p>Observação: ${p.observacao}</p>` : ''}
     <p>Acesse o sistema para realizar os ajustes.</p>`,
  submissao_validada: (p) =>
    `<p>Olá, <strong>${p.nome}</strong>.</p>
     <p>A submissão <strong>${p.protocolo}</strong> foi validada com sucesso.</p>`,
  submissao_rejeitada: (p) =>
    `<p>Olá, <strong>${p.nome}</strong>.</p>
     <p>A submissão <strong>${p.protocolo}</strong> foi rejeitada.</p>
     ${p.observacao ? `<p>Motivo: ${p.observacao}</p>` : ''}`,
};

@Processor(NOTIFICACOES_QUEUE)
export class NotificacoesProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificacoesProcessor.name);
  private readonly transporter: nodemailer.Transporter | null;

  constructor(private readonly config: ConfigService<Env, true>) {
    super();
    const host = config.get('SMTP_HOST' as keyof Env, { infer: true }) as string | undefined;
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(config.get('SMTP_PORT' as keyof Env, { infer: true }) ?? 587),
        secure: false,
        auth: {
          user: config.get('SMTP_USER' as keyof Env, { infer: true }) as string,
          pass: config.get('SMTP_PASS' as keyof Env, { infer: true }) as string,
        },
      });
      this.logger.log(`NotificacoesProcessor: SMTP configurado em ${host}`);
    } else {
      this.transporter = null;
      this.logger.warn('NotificacoesProcessor: SMTP_HOST não configurado — e-mails serão ignorados');
    }
  }

  async process(job: Job<NotificacaoPayload>): Promise<void> {
    const payload = job.data;

    if (!this.transporter) {
      this.logger.warn(`[job ${job.id}] SMTP ausente — descartando notificação tipo=${payload.tipo}`);
      return;
    }

    const from = (this.config.get('SMTP_FROM' as keyof Env, { infer: true }) as string | undefined)
      ?? '"Defesa Civil MG" <noreply@defesacivil.mg.gov.br>';

    await this.transporter.sendMail({
      from,
      to: payload.destinatario,
      subject: ASSUNTOS[payload.tipo],
      html: CORPO_HTML[payload.tipo](payload),
    });

    this.logger.log(
      `[job ${job.id}] E-mail enviado: tipo=${payload.tipo} para=${payload.destinatario}`,
    );
  }
}
