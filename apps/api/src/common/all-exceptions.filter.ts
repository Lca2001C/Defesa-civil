import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ehProducao } from '../shared/cors.util';

/** Formato padronizado de resposta de erro da API. */
interface RespostaErro {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp: string;
  path: string;
}

/**
 * Filtro global de excecoes.
 *
 * Captura qualquer erro lancado na aplicacao e devolve uma resposta JSON
 * padronizada com statusCode, message, timestamp e path. Excecoes HTTP do
 * Nest preservam o status e a mensagem original; erros nao tratados viram
 * 500 (Internal Server Error) e sao logados com stack trace.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const extraido = this.extrair(exception);
    const ehErroServidor = extraido.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR;

    // Em produção, respostas 5xx nunca expõem detalhes técnicos (stack, nome de
    // classe interna, trecho de query/SQL, segredos). O diagnóstico fica apenas
    // no log do servidor. Em dev mantém a mensagem original para facilitar.
    const ocultarDetalhe = ehErroServidor && ehProducao();

    const corpo: RespostaErro = {
      statusCode: extraido.statusCode,
      message: ocultarDetalhe ? 'Erro interno do servidor.' : extraido.message,
      error: ocultarDetalhe ? 'Internal Server Error' : extraido.error,
      timestamp: new Date().toISOString(),
      // Apenas a rota da requisição (não caminho físico de arquivo).
      path: request.url,
    };

    // Erros 5xx sao inesperados: loga com detalhes para diagnostico (server-side).
    if (ehErroServidor) {
      this.logger.error(
        `${request.method} ${request.url} -> ${extraido.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const statusCode = extraido.statusCode;

    response.status(statusCode).json(corpo);
  }

  /** Normaliza qualquer excecao para status + mensagem + nome do erro. */
  private extrair(exception: unknown): {
    statusCode: number;
    message: string | string[];
    error?: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resposta = exception.getResponse();

      if (typeof resposta === 'string') {
        return { statusCode: status, message: resposta };
      }

      const obj = resposta as Record<string, unknown>;
      return {
        statusCode: status,
        message: (obj.message as string | string[]) ?? exception.message,
        error: obj.error as string | undefined,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno do servidor.',
      error: 'Internal Server Error',
    };
  }
}
