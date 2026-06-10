/**
 * Controle de acesso baseado em perfis (RBAC) da Plataforma Defesa Civil MG.
 *
 * Define os perfis de usuario, seus niveis hierarquicos, o escopo territorial
 * de atuacao e o formato canonico de permissoes "modulo.acao".
 */

/**
 * Perfis de usuario do sistema, em ordem hierarquica.
 *
 * O valor numerico de cada perfil (ver {@link NIVEIS_PERFIL}) determina a
 * precedencia: quanto maior o nivel, maior o alcance de acoes do usuario.
 */
export enum PerfilUsuario {
  /** Administrador da plataforma; acesso irrestrito. */
  SUPER_ADMIN = 'SUPER_ADMIN',
  /** Gestor estadual (CEDEC-MG); visao de todo o estado. */
  GESTOR_ESTADUAL = 'GESTOR_ESTADUAL',
  /** Coordenador de uma regiao (REDEC); visao das cidades da regiao. */
  COORDENADOR_REGIONAL = 'COORDENADOR_REGIONAL',
  /** Administrador da COMPDEC de um municipio. */
  ADMIN_MUNICIPAL = 'ADMIN_MUNICIPAL',
  /** Operador municipal; preenche e envia submissoes. */
  OPERADOR_MUNICIPAL = 'OPERADOR_MUNICIPAL',
  /** Perfil somente leitura. */
  CONSULTA = 'CONSULTA',
}

/**
 * Nivel hierarquico de cada perfil. Use para comparacoes de precedencia
 * (ex.: verificar se o usuario tem nivel suficiente para uma acao).
 */
export const NIVEIS_PERFIL: Readonly<Record<PerfilUsuario, number>> = {
  [PerfilUsuario.SUPER_ADMIN]: 100,
  [PerfilUsuario.GESTOR_ESTADUAL]: 80,
  [PerfilUsuario.COORDENADOR_REGIONAL]: 60,
  [PerfilUsuario.ADMIN_MUNICIPAL]: 50,
  [PerfilUsuario.OPERADOR_MUNICIPAL]: 20,
  [PerfilUsuario.CONSULTA]: 10,
};

/**
 * Retorna o nivel hierarquico de um perfil.
 */
export function nivelDoPerfil(perfil: PerfilUsuario): number {
  return NIVEIS_PERFIL[perfil];
}

/**
 * Indica se o `perfil` possui nivel maior ou igual ao `minimo` exigido.
 */
export function perfilAtendeNivel(
  perfil: PerfilUsuario,
  minimo: PerfilUsuario,
): boolean {
  return NIVEIS_PERFIL[perfil] >= NIVEIS_PERFIL[minimo];
}

/**
 * Escopo territorial de atuacao de um usuario.
 *
 * - ESTADUAL: atua sobre todo o estado de Minas Gerais.
 * - REGIONAL: atua sobre uma regiao (conjunto de municipios).
 * - MUNICIPAL: atua sobre um unico municipio.
 */
export enum EscopoUsuario {
  ESTADUAL = 'ESTADUAL',
  REGIONAL = 'REGIONAL',
  MUNICIPAL = 'MUNICIPAL',
}

/**
 * Permissao no formato canonico "modulo.acao"
 * (ex.: "submissao.enviar", "competencia.abrir", "painel.visualizar").
 *
 * E um tipo de string aberta para permitir a evolucao do catalogo de
 * permissoes sem alterar o contrato, mantendo o formato documentado.
 */
export type Permissao = `${string}.${string}`;

/**
 * Identidade resumida de um usuario autenticado, util para guardas de
 * autorizacao no backend e no frontend.
 */
export interface UsuarioAutorizacao {
  /** Identificador unico do usuario. */
  id: string;
  /** Perfil hierarquico do usuario. */
  perfil: PerfilUsuario;
  /** Escopo territorial de atuacao. */
  escopo: EscopoUsuario;
  /** Municipio vinculado, quando o escopo for MUNICIPAL. */
  municipioId?: string;
  /** Regiao vinculada, quando o escopo for REGIONAL. */
  regiaoId?: string;
  /** Permissoes explicitas concedidas ao usuario. */
  permissoes: Permissao[];
}
