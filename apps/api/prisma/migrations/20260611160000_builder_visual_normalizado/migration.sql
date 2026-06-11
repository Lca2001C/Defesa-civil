-- CreateEnum
CREATE TYPE "TipoPergunta" AS ENUM ('TEXTO_CURTO', 'TEXTO_LONGO', 'NUMERO', 'DATA', 'EMAIL', 'TELEFONE', 'CPF', 'CNPJ', 'CEP', 'MOEDA', 'PORCENTAGEM', 'SIM_NAO', 'LISTA_SUSPENSA', 'RADIO', 'CHECKBOX', 'UPLOAD', 'URL', 'AUTOMATICO');

-- CreateEnum
CREATE TYPE "FonteAutomatica" AS ENUM ('CODIGO_IBGE', 'MUNICIPIO_ATUAL', 'USUARIO_ATUAL', 'DATA_ATUAL', 'ANO_ATUAL', 'COMPETENCIA_ATUAL', 'PROTOCOLO');

-- CreateEnum
CREATE TYPE "OperadorCondicional" AS ENUM ('IGUAL', 'DIFERENTE');

-- CreateEnum
CREATE TYPE "AcaoCondicional" AS ENUM ('MOSTRAR', 'OCULTAR');

-- AlterEnum
BEGIN;
CREATE TYPE "SubmissaoStatus_new" AS ENUM ('RASCUNHO', 'EM_PREENCHIMENTO', 'ENVIADO', 'CORRECAO_SOLICITADA', 'REVISADO', 'APROVADO');
ALTER TABLE "submissoes" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "submissoes" ALTER COLUMN "status" TYPE "SubmissaoStatus_new" USING ("status"::text::"SubmissaoStatus_new");
ALTER TYPE "SubmissaoStatus" RENAME TO "SubmissaoStatus_old";
ALTER TYPE "SubmissaoStatus_new" RENAME TO "SubmissaoStatus";
DROP TYPE "SubmissaoStatus_old";
ALTER TABLE "submissoes" ALTER COLUMN "status" SET DEFAULT 'RASCUNHO';
COMMIT;

-- DropForeignKey
ALTER TABLE "erros_importacao" DROP CONSTRAINT "erros_importacao_lote_id_fkey";

-- DropForeignKey
ALTER TABLE "importacao_lotes" DROP CONSTRAINT "importacao_lotes_arquivo_id_fkey";

-- DropForeignKey
ALTER TABLE "importacao_lotes" DROP CONSTRAINT "importacao_lotes_autor_id_fkey";

-- DropForeignKey
ALTER TABLE "importacao_lotes" DROP CONSTRAINT "importacao_lotes_formulario_versao_id_fkey";

-- DropForeignKey
ALTER TABLE "importacao_lotes" DROP CONSTRAINT "importacao_lotes_municipio_id_fkey";

-- DropForeignKey
ALTER TABLE "revisoes_submissao" DROP CONSTRAINT "revisoes_submissao_revisor_id_fkey";

-- DropForeignKey
ALTER TABLE "revisoes_submissao" DROP CONSTRAINT "revisoes_submissao_submissao_id_fkey";

-- DropForeignKey
ALTER TABLE "submissao_arquivos" DROP CONSTRAINT "submissao_arquivos_arquivo_id_fkey";

-- DropForeignKey
ALTER TABLE "submissao_arquivos" DROP CONSTRAINT "submissao_arquivos_submissao_id_fkey";

-- DropForeignKey
ALTER TABLE "submissoes" DROP CONSTRAINT "submissoes_importacao_lote_id_fkey";

-- AlterTable
ALTER TABLE "formulario_versoes" DROP COLUMN "schema";

-- AlterTable
ALTER TABLE "submissoes" DROP COLUMN "dados",
DROP COLUMN "importacao_lote_id",
DROP COLUMN "validado_em",
ADD COLUMN     "aprovado_em" TIMESTAMP(3);

-- DropTable
DROP TABLE "erros_importacao";

-- DropTable
DROP TABLE "importacao_lotes";

-- DropTable
DROP TABLE "revisoes_submissao";

-- DropTable
DROP TABLE "submissao_arquivos";

-- DropEnum
DROP TYPE "ImportacaoStatus";

-- DropEnum
DROP TYPE "RevisaoAcao";

-- CreateTable
CREATE TABLE "secoes" (
    "id" TEXT NOT NULL,
    "versao_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,

    CONSTRAINT "secoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perguntas" (
    "id" TEXT NOT NULL,
    "secao_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "tipo" "TipoPergunta" NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "ajuda" TEXT,
    "min" INTEGER,
    "max" INTEGER,
    "padrao" TEXT,
    "tamanho_maximo_mb" INTEGER,
    "tipos_arquivo" TEXT[],
    "fonte_automatica" "FonteAutomatica",

    CONSTRAINT "perguntas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opcoes_pergunta" (
    "id" TEXT NOT NULL,
    "pergunta_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,

    CONSTRAINT "opcoes_pergunta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regras_condicionais" (
    "id" TEXT NOT NULL,
    "pergunta_alvo_id" TEXT NOT NULL,
    "pergunta_origem_id" TEXT NOT NULL,
    "operador" "OperadorCondicional" NOT NULL DEFAULT 'IGUAL',
    "valor" TEXT NOT NULL,
    "acao" "AcaoCondicional" NOT NULL DEFAULT 'MOSTRAR',

    CONSTRAINT "regras_condicionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formulario_templates" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" TEXT,
    "schema" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formulario_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocos_reutilizaveis" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" TEXT,
    "conteudo" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocos_reutilizaveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas" (
    "id" TEXT NOT NULL,
    "submissao_id" TEXT NOT NULL,
    "pergunta_id" TEXT NOT NULL,
    "pergunta_codigo" TEXT NOT NULL,
    "valor" JSONB,

    CONSTRAINT "respostas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas_historico" (
    "id" TEXT NOT NULL,
    "submissao_id" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "comentario" TEXT,
    "status_anterior" "SubmissaoStatus",
    "status_novo" "SubmissaoStatus",
    "snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respostas_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anexos_submissao" (
    "id" TEXT NOT NULL,
    "submissao_id" TEXT NOT NULL,
    "arquivo_id" TEXT NOT NULL,
    "pergunta_codigo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexos_submissao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "secoes_versao_id_idx" ON "secoes"("versao_id");

-- CreateIndex
CREATE INDEX "perguntas_secao_id_idx" ON "perguntas"("secao_id");

-- CreateIndex
CREATE INDEX "opcoes_pergunta_pergunta_id_idx" ON "opcoes_pergunta"("pergunta_id");

-- CreateIndex
CREATE INDEX "regras_condicionais_pergunta_alvo_id_idx" ON "regras_condicionais"("pergunta_alvo_id");

-- CreateIndex
CREATE INDEX "regras_condicionais_pergunta_origem_id_idx" ON "regras_condicionais"("pergunta_origem_id");

-- CreateIndex
CREATE INDEX "respostas_submissao_id_idx" ON "respostas"("submissao_id");

-- CreateIndex
CREATE UNIQUE INDEX "respostas_submissao_id_pergunta_id_key" ON "respostas"("submissao_id", "pergunta_id");

-- CreateIndex
CREATE INDEX "respostas_historico_submissao_id_idx" ON "respostas_historico"("submissao_id");

-- CreateIndex
CREATE INDEX "anexos_submissao_submissao_id_idx" ON "anexos_submissao"("submissao_id");

-- CreateIndex
CREATE INDEX "anexos_submissao_arquivo_id_idx" ON "anexos_submissao"("arquivo_id");

-- AddForeignKey
ALTER TABLE "secoes" ADD CONSTRAINT "secoes_versao_id_fkey" FOREIGN KEY ("versao_id") REFERENCES "formulario_versoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perguntas" ADD CONSTRAINT "perguntas_secao_id_fkey" FOREIGN KEY ("secao_id") REFERENCES "secoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opcoes_pergunta" ADD CONSTRAINT "opcoes_pergunta_pergunta_id_fkey" FOREIGN KEY ("pergunta_id") REFERENCES "perguntas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_condicionais" ADD CONSTRAINT "regras_condicionais_pergunta_alvo_id_fkey" FOREIGN KEY ("pergunta_alvo_id") REFERENCES "perguntas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_condicionais" ADD CONSTRAINT "regras_condicionais_pergunta_origem_id_fkey" FOREIGN KEY ("pergunta_origem_id") REFERENCES "perguntas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas" ADD CONSTRAINT "respostas_submissao_id_fkey" FOREIGN KEY ("submissao_id") REFERENCES "submissoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas" ADD CONSTRAINT "respostas_pergunta_id_fkey" FOREIGN KEY ("pergunta_id") REFERENCES "perguntas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_historico" ADD CONSTRAINT "respostas_historico_submissao_id_fkey" FOREIGN KEY ("submissao_id") REFERENCES "submissoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_historico" ADD CONSTRAINT "respostas_historico_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos_submissao" ADD CONSTRAINT "anexos_submissao_submissao_id_fkey" FOREIGN KEY ("submissao_id") REFERENCES "submissoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos_submissao" ADD CONSTRAINT "anexos_submissao_arquivo_id_fkey" FOREIGN KEY ("arquivo_id") REFERENCES "arquivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
