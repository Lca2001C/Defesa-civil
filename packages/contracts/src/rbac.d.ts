export declare enum PerfilUsuario {
    SUPER_ADMIN = "SUPER_ADMIN",
    GESTOR_ESTADUAL = "GESTOR_ESTADUAL",
    COORDENADOR_REGIONAL = "COORDENADOR_REGIONAL",
    ADMIN_MUNICIPAL = "ADMIN_MUNICIPAL",
    OPERADOR_MUNICIPAL = "OPERADOR_MUNICIPAL",
    CONSULTA = "CONSULTA"
}
export declare const NIVEIS_PERFIL: Readonly<Record<PerfilUsuario, number>>;
export declare function nivelDoPerfil(perfil: PerfilUsuario): number;
export declare function perfilAtendeNivel(perfil: PerfilUsuario, minimo: PerfilUsuario): boolean;
export declare enum EscopoUsuario {
    ESTADUAL = "ESTADUAL",
    REGIONAL = "REGIONAL",
    MUNICIPAL = "MUNICIPAL"
}
export type Permissao = `${string}.${string}`;
export interface UsuarioAutorizacao {
    id: string;
    perfil: PerfilUsuario;
    escopo: EscopoUsuario;
    municipioId?: string;
    regiaoId?: string;
    permissoes: Permissao[];
}
//# sourceMappingURL=rbac.d.ts.map