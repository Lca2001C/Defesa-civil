"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevisaoAcao = exports.SubmissaoStatus = void 0;
var SubmissaoStatus;
(function (SubmissaoStatus) {
    SubmissaoStatus["RASCUNHO"] = "RASCUNHO";
    SubmissaoStatus["ENVIADA"] = "ENVIADA";
    SubmissaoStatus["EM_ANALISE"] = "EM_ANALISE";
    SubmissaoStatus["CORRECAO_SOLICITADA"] = "CORRECAO_SOLICITADA";
    SubmissaoStatus["REVISADA"] = "REVISADA";
    SubmissaoStatus["VALIDADA"] = "VALIDADA";
    SubmissaoStatus["REJEITADA"] = "REJEITADA";
})(SubmissaoStatus || (exports.SubmissaoStatus = SubmissaoStatus = {}));
var RevisaoAcao;
(function (RevisaoAcao) {
    RevisaoAcao["SOLICITOU_CORRECAO"] = "SOLICITOU_CORRECAO";
    RevisaoAcao["REVISOU"] = "REVISOU";
    RevisaoAcao["VALIDOU"] = "VALIDOU";
    RevisaoAcao["REJEITOU"] = "REJEITOU";
})(RevisaoAcao || (exports.RevisaoAcao = RevisaoAcao = {}));
//# sourceMappingURL=submissao.js.map