import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { extrairIp } from '../../shared/utils/format.util';
import type { JwtPayload } from '../types/jwt-payload';

const METODOS_AUDITADOS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Campos que NUNCA devem aparecer nos logs de auditoria (LGPD/segurança).
const CAMPOS_SENSIVEIS = new Set([
  'senha',
  'senhaHash',
  'senha_hash',
  'password',
  'cpf',
  'cpfRespondente',
  'cpf_respondente',
  'dados',       // JSONB de respostas pode conter dados pessoais
  'dadosSnapshot',
  'dados_snapshot',
  'token',
  'accessToken',
  'refreshToken',
]);

function sanitizar(obj: unknown, profundidade = 0): unknown {
  if (profundidade > 3 || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => sanitizar(item, profundidade + 1));

  const resultado: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(obj as Record<string, unknown>)) {
    resultado[chave] = CAMPOS_SENSIVEIS.has(chave) ? '[REDACTED]' : sanitizar(valor, profundidade + 1);
  }
  return resultado;
}

/**
 * Interceptor global de auditoria (LGPD — responsabilização).
 *
 * Registra um LogAuditoria para toda requisição mutante (POST/PUT/PATCH/DELETE).
 * Campos sensíveis (CPF, senha, dados JSONB) são redactados antes de persistir.
 * Operação fire-and-forget: não bloqueia nem atrasa a resposta.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload; requestId?: string }>();

    if (!METODOS_AUDITADOS.has(req.method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (resposta) => void this.registrar(req, resposta),
        error: () => void this.registrar(req, null),
      }),
    );
  }

  private async registrar(
    req: Request & { user?: JwtPayload; requestId?: string },
    resposta: unknown,
  ): Promise<void> {
    try {
      const prefixo = process.env['API_PREFIX'] ?? 'api';
      const semPrefixo = req.path.replace(new RegExp(`^/${prefixo}/`), '');
      const partes = semPrefixo.split('/').filter(Boolean);
      const entidade = partes[0] ?? 'desconhecido';
      const entidadeId = partes[1] ?? null;

      const ipBruto = extrairIp(req);

      // Extrai o ID gerado pelo servidor a partir da resposta quando possível
      const entidadeIdFinal =
        entidadeId ??
        (resposta && typeof resposta === 'object' && 'id' in resposta
          ? String((resposta as { id: unknown }).id)
          : null);

      await this.prisma.logAuditoria.create({
        data: {
          atorId: req.user?.sub ?? null,
          acao: `${req.method} ${req.path}`,
          entidade,
          entidadeId: entidadeIdFinal,
          depois: resposta ? (sanitizar(resposta) as object) : undefined,
          ip: ipBruto ?? null,
          userAgent:
            (req.headers['user-agent'] as string | undefined) ?? null,
        },
      });
    } catch {
      // Erros de auditoria nunca quebram a requisição principal.
    }
  }
}
