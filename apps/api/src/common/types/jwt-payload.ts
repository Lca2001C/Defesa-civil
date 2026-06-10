/** Payload do JWT de acesso (o que fica dentro do token assinado). */
export interface JwtPayload {
  /** usuario.id (cuid) */
  sub: string;
  email: string;
  perfilCodigo: string;
  perfilNivel: number;
  /** EscopoUsuario: ESTADUAL | REGIONAL | MUNICIPAL */
  escopo: string;
  ufId: number | null;
  regionalId: string | null;
  municipioId: number | null;
  /** Chaves de permissao carregadas no login (ex.: "formularios.publicar"). */
  permissoes: string[];
  iat?: number;
  exp?: number;
}
