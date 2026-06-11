export declare enum StatusMunicipio {
    RESPONDIDO = "RESPONDIDO",
    EM_PREENCHIMENTO = "EM_PREENCHIMENTO",
    NAO_RESPONDEU = "NAO_RESPONDEU"
}
export declare const EVENTOS_PAINEL: {
    readonly PAINEL_ATUALIZADO: "painel:atualizado";
    readonly ENTRAR_COMPETENCIA: "painel:entrar-competencia";
    readonly SAIR_COMPETENCIA: "painel:sair-competencia";
};
export type EventoPainelNome = (typeof EVENTOS_PAINEL)[keyof typeof EVENTOS_PAINEL];
export interface EventoPainelAtualizado {
    competenciaId: string;
    municipioId: string;
    status: StatusMunicipio;
    atualizadoEm: string;
}
export interface EventoPainelSala {
    competenciaId: string;
}
export interface ResumoPainelCompetencia {
    competenciaId: string;
    totalMunicipios: number;
    respondidos: number;
    emPreenchimento: number;
    naoResponderam: number;
    atualizadoEm: string;
}
//# sourceMappingURL=painel.d.ts.map