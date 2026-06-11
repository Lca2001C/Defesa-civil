"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscopoUsuario = exports.NIVEIS_PERFIL = exports.PerfilUsuario = void 0;
exports.nivelDoPerfil = nivelDoPerfil;
exports.perfilAtendeNivel = perfilAtendeNivel;
var PerfilUsuario;
(function (PerfilUsuario) {
    PerfilUsuario["SUPER_ADMIN"] = "SUPER_ADMIN";
    PerfilUsuario["GESTOR_ESTADUAL"] = "GESTOR_ESTADUAL";
    PerfilUsuario["COORDENADOR_REGIONAL"] = "COORDENADOR_REGIONAL";
    PerfilUsuario["ADMIN_MUNICIPAL"] = "ADMIN_MUNICIPAL";
    PerfilUsuario["OPERADOR_MUNICIPAL"] = "OPERADOR_MUNICIPAL";
    PerfilUsuario["CONSULTA"] = "CONSULTA";
})(PerfilUsuario || (exports.PerfilUsuario = PerfilUsuario = {}));
exports.NIVEIS_PERFIL = {
    [PerfilUsuario.SUPER_ADMIN]: 100,
    [PerfilUsuario.GESTOR_ESTADUAL]: 80,
    [PerfilUsuario.COORDENADOR_REGIONAL]: 60,
    [PerfilUsuario.ADMIN_MUNICIPAL]: 50,
    [PerfilUsuario.OPERADOR_MUNICIPAL]: 20,
    [PerfilUsuario.CONSULTA]: 10,
};
function nivelDoPerfil(perfil) {
    return exports.NIVEIS_PERFIL[perfil];
}
function perfilAtendeNivel(perfil, minimo) {
    return exports.NIVEIS_PERFIL[perfil] >= exports.NIVEIS_PERFIL[minimo];
}
var EscopoUsuario;
(function (EscopoUsuario) {
    EscopoUsuario["ESTADUAL"] = "ESTADUAL";
    EscopoUsuario["REGIONAL"] = "REGIONAL";
    EscopoUsuario["MUNICIPAL"] = "MUNICIPAL";
})(EscopoUsuario || (exports.EscopoUsuario = EscopoUsuario = {}));
//# sourceMappingURL=rbac.js.map