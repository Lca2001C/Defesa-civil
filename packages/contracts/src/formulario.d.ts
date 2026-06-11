export declare enum TipoCampo {
    TEXTO = "TEXTO",
    NUMERO = "NUMERO",
    DATA = "DATA",
    SELECT = "SELECT",
    MULTISELECT = "MULTISELECT",
    BOOLEANO = "BOOLEANO",
    CPF = "CPF",
    CNPJ = "CNPJ",
    CEP = "CEP",
    MOEDA = "MOEDA",
    ARQUIVO = "ARQUIVO"
}
export interface OpcaoCampo {
    valor: string;
    rotulo: string;
}
export interface ValidacoesCampo {
    min?: number;
    max?: number;
    padrao?: string;
    tiposArquivo?: string[];
    tamanhoMaximoMb?: number;
    mensagem?: string;
}
export interface CondicaoCampo {
    campo: string;
    igualA: string | number | boolean | Array<string | number | boolean>;
}
export interface CampoFormulario {
    chave: string;
    rotulo: string;
    tipo: TipoCampo;
    obrigatorio: boolean;
    ajuda?: string;
    validacoes?: ValidacoesCampo;
    opcoes?: OpcaoCampo[];
    condicional?: CondicaoCampo;
}
export interface SecaoFormulario {
    chave: string;
    titulo: string;
    descricao?: string;
    campos: CampoFormulario[];
}
export interface SchemaFormulario {
    versao: number;
    titulo?: string;
    descricao?: string;
    secoes: SecaoFormulario[];
}
//# sourceMappingURL=formulario.d.ts.map