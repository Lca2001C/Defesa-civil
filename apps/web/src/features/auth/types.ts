export interface TokensResposta {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TermoLgpd {
  versao: string;
  conteudo: string;
}

export interface RegistrarPayload {
  nome: string;
  cpf: string;
  email: string;
  senha: string;
  confirmarSenha: string;
  telefone: string;
  aceiteTermoLgpd: boolean;
  versaoTermoAceito: string;
  ehCoordenadorCompdec: boolean;
  municipioId?: number;
}
