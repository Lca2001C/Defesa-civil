-- CreateEnum
CREATE TYPE "EscopoUsuario" AS ENUM ('ESTADUAL', 'REGIONAL', 'MUNICIPAL');

-- CreateEnum
CREATE TYPE "CompetenciaStatus" AS ENUM ('PLANEJADA', 'ABERTA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "FormularioStatus" AS ENUM ('RASCUNHO', 'PUBLICADO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "SubmissaoStatus" AS ENUM ('RASCUNHO', 'ENVIADA', 'EM_ANALISE', 'CORRECAO_SOLICITADA', 'REVISADA', 'VALIDADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "RevisaoAcao" AS ENUM ('SOLICITOU_CORRECAO', 'REVISOU', 'VALIDOU', 'REJEITOU');

-- CreateEnum
CREATE TYPE "ImportacaoStatus" AS ENUM ('PENDENTE', 'PROCESSANDO', 'CONCLUIDA', 'CONCLUIDA_COM_ERROS', 'FALHOU');

-- CreateTable
CREATE TABLE "ufs" (
    "id" INTEGER NOT NULL,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ufs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regionais" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT,
    "uf_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "municipios" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "uf_id" INTEGER NOT NULL,
    "regional_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "municipios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compdecs" (
    "id" TEXT NOT NULL,
    "municipio_id" INTEGER NOT NULL,
    "coordenador_nome" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compdecs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfis" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissoes" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "descricao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "cargo" TEXT,
    "telefone" TEXT,
    "perfil_id" TEXT NOT NULL,
    "escopo" "EscopoUsuario" NOT NULL,
    "uf_id" INTEGER,
    "regional_id" TEXT,
    "municipio_id" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acesso_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competencias" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,
    "status" "CompetenciaStatus" NOT NULL DEFAULT 'PLANEJADA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formularios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" TEXT,
    "status" "FormularioStatus" NOT NULL DEFAULT 'RASCUNHO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formularios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formulario_versoes" (
    "id" TEXT NOT NULL,
    "formulario_id" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "schema" JSONB NOT NULL,
    "competencia_id" TEXT,
    "status" "FormularioStatus" NOT NULL DEFAULT 'RASCUNHO',
    "publicado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formulario_versoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissoes" (
    "id" TEXT NOT NULL,
    "protocolo" TEXT NOT NULL,
    "municipio_id" INTEGER NOT NULL,
    "formulario_versao_id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "nome_respondente" TEXT NOT NULL,
    "cpf_respondente" TEXT NOT NULL,
    "cargo_respondente" TEXT,
    "email_respondente" TEXT,
    "telefone_respondente" TEXT,
    "ip_resposta" TEXT,
    "user_agent" TEXT,
    "status" "SubmissaoStatus" NOT NULL DEFAULT 'RASCUNHO',
    "dados" JSONB NOT NULL,
    "importacao_lote_id" TEXT,
    "enviado_em" TIMESTAMP(3),
    "validado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisoes_submissao" (
    "id" TEXT NOT NULL,
    "submissao_id" TEXT NOT NULL,
    "revisor_id" TEXT NOT NULL,
    "acao" "RevisaoAcao" NOT NULL,
    "comentario" TEXT,
    "dados_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisoes_submissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissao_arquivos" (
    "id" TEXT NOT NULL,
    "submissao_id" TEXT NOT NULL,
    "arquivo_id" TEXT NOT NULL,
    "chave_campo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissao_arquivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacao_lotes" (
    "id" TEXT NOT NULL,
    "formulario_versao_id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "municipio_id" INTEGER,
    "autor_id" TEXT NOT NULL,
    "arquivo_id" TEXT,
    "status" "ImportacaoStatus" NOT NULL DEFAULT 'PENDENTE',
    "total_linhas" INTEGER NOT NULL DEFAULT 0,
    "linhas_validas" INTEGER NOT NULL DEFAULT 0,
    "linhas_com_erro" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "importacao_lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erros_importacao" (
    "id" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "linha" INTEGER NOT NULL,
    "coluna" TEXT,
    "mensagem" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erros_importacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocolo_sequencias" (
    "id" TEXT NOT NULL,
    "uf_sigla" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "ultimo_numero" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "protocolo_sequencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arquivos" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "mime_type" TEXT,
    "tamanho_bytes" INTEGER,
    "driver" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arquivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id" TEXT NOT NULL,
    "ator_id" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT,
    "antes" JSONB,
    "depois" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PerfilPermissoes" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ufs_sigla_key" ON "ufs"("sigla");

-- CreateIndex
CREATE INDEX "regionais_uf_id_idx" ON "regionais"("uf_id");

-- CreateIndex
CREATE UNIQUE INDEX "regionais_uf_id_nome_key" ON "regionais"("uf_id", "nome");

-- CreateIndex
CREATE INDEX "municipios_uf_id_idx" ON "municipios"("uf_id");

-- CreateIndex
CREATE INDEX "municipios_regional_id_idx" ON "municipios"("regional_id");

-- CreateIndex
CREATE INDEX "municipios_nome_idx" ON "municipios"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "compdecs_municipio_id_key" ON "compdecs"("municipio_id");

-- CreateIndex
CREATE UNIQUE INDEX "perfis_codigo_key" ON "perfis"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "permissoes_chave_key" ON "permissoes"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_cpf_key" ON "usuarios"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_perfil_id_idx" ON "usuarios"("perfil_id");

-- CreateIndex
CREATE INDEX "usuarios_municipio_id_idx" ON "usuarios"("municipio_id");

-- CreateIndex
CREATE INDEX "usuarios_regional_id_idx" ON "usuarios"("regional_id");

-- CreateIndex
CREATE INDEX "competencias_ano_idx" ON "competencias"("ano");

-- CreateIndex
CREATE INDEX "competencias_status_idx" ON "competencias"("status");

-- CreateIndex
CREATE INDEX "formulario_versoes_competencia_id_idx" ON "formulario_versoes"("competencia_id");

-- CreateIndex
CREATE UNIQUE INDEX "formulario_versoes_formulario_id_versao_key" ON "formulario_versoes"("formulario_id", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "submissoes_protocolo_key" ON "submissoes"("protocolo");

-- CreateIndex
CREATE INDEX "submissoes_municipio_id_idx" ON "submissoes"("municipio_id");

-- CreateIndex
CREATE INDEX "submissoes_competencia_id_idx" ON "submissoes"("competencia_id");

-- CreateIndex
CREATE INDEX "submissoes_formulario_versao_id_idx" ON "submissoes"("formulario_versao_id");

-- CreateIndex
CREATE INDEX "submissoes_status_idx" ON "submissoes"("status");

-- CreateIndex
CREATE INDEX "submissoes_municipio_id_competencia_id_idx" ON "submissoes"("municipio_id", "competencia_id");

-- CreateIndex
CREATE INDEX "submissoes_municipio_id_formulario_versao_id_competencia_id_idx" ON "submissoes"("municipio_id", "formulario_versao_id", "competencia_id");

-- CreateIndex
CREATE INDEX "revisoes_submissao_submissao_id_idx" ON "revisoes_submissao"("submissao_id");

-- CreateIndex
CREATE INDEX "submissao_arquivos_submissao_id_idx" ON "submissao_arquivos"("submissao_id");

-- CreateIndex
CREATE INDEX "submissao_arquivos_arquivo_id_idx" ON "submissao_arquivos"("arquivo_id");

-- CreateIndex
CREATE INDEX "importacao_lotes_formulario_versao_id_idx" ON "importacao_lotes"("formulario_versao_id");

-- CreateIndex
CREATE INDEX "importacao_lotes_status_idx" ON "importacao_lotes"("status");

-- CreateIndex
CREATE INDEX "erros_importacao_lote_id_idx" ON "erros_importacao"("lote_id");

-- CreateIndex
CREATE UNIQUE INDEX "protocolo_sequencias_uf_sigla_ano_key" ON "protocolo_sequencias"("uf_sigla", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "arquivos_chave_key" ON "arquivos"("chave");

-- CreateIndex
CREATE INDEX "logs_auditoria_entidade_entidade_id_idx" ON "logs_auditoria"("entidade", "entidade_id");

-- CreateIndex
CREATE INDEX "logs_auditoria_ator_id_idx" ON "logs_auditoria"("ator_id");

-- CreateIndex
CREATE INDEX "logs_auditoria_created_at_idx" ON "logs_auditoria"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "_PerfilPermissoes_AB_unique" ON "_PerfilPermissoes"("A", "B");

-- CreateIndex
CREATE INDEX "_PerfilPermissoes_B_index" ON "_PerfilPermissoes"("B");

-- AddForeignKey
ALTER TABLE "regionais" ADD CONSTRAINT "regionais_uf_id_fkey" FOREIGN KEY ("uf_id") REFERENCES "ufs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "municipios" ADD CONSTRAINT "municipios_uf_id_fkey" FOREIGN KEY ("uf_id") REFERENCES "ufs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "municipios" ADD CONSTRAINT "municipios_regional_id_fkey" FOREIGN KEY ("regional_id") REFERENCES "regionais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compdecs" ADD CONSTRAINT "compdecs_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "municipios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_uf_id_fkey" FOREIGN KEY ("uf_id") REFERENCES "ufs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_regional_id_fkey" FOREIGN KEY ("regional_id") REFERENCES "regionais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "municipios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulario_versoes" ADD CONSTRAINT "formulario_versoes_formulario_id_fkey" FOREIGN KEY ("formulario_id") REFERENCES "formularios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulario_versoes" ADD CONSTRAINT "formulario_versoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissoes" ADD CONSTRAINT "submissoes_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "municipios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissoes" ADD CONSTRAINT "submissoes_formulario_versao_id_fkey" FOREIGN KEY ("formulario_versao_id") REFERENCES "formulario_versoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissoes" ADD CONSTRAINT "submissoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissoes" ADD CONSTRAINT "submissoes_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissoes" ADD CONSTRAINT "submissoes_importacao_lote_id_fkey" FOREIGN KEY ("importacao_lote_id") REFERENCES "importacao_lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisoes_submissao" ADD CONSTRAINT "revisoes_submissao_submissao_id_fkey" FOREIGN KEY ("submissao_id") REFERENCES "submissoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisoes_submissao" ADD CONSTRAINT "revisoes_submissao_revisor_id_fkey" FOREIGN KEY ("revisor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissao_arquivos" ADD CONSTRAINT "submissao_arquivos_submissao_id_fkey" FOREIGN KEY ("submissao_id") REFERENCES "submissoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissao_arquivos" ADD CONSTRAINT "submissao_arquivos_arquivo_id_fkey" FOREIGN KEY ("arquivo_id") REFERENCES "arquivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacao_lotes" ADD CONSTRAINT "importacao_lotes_formulario_versao_id_fkey" FOREIGN KEY ("formulario_versao_id") REFERENCES "formulario_versoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacao_lotes" ADD CONSTRAINT "importacao_lotes_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "municipios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacao_lotes" ADD CONSTRAINT "importacao_lotes_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacao_lotes" ADD CONSTRAINT "importacao_lotes_arquivo_id_fkey" FOREIGN KEY ("arquivo_id") REFERENCES "arquivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erros_importacao" ADD CONSTRAINT "erros_importacao_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "importacao_lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_ator_id_fkey" FOREIGN KEY ("ator_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PerfilPermissoes" ADD CONSTRAINT "_PerfilPermissoes_A_fkey" FOREIGN KEY ("A") REFERENCES "perfis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PerfilPermissoes" ADD CONSTRAINT "_PerfilPermissoes_B_fkey" FOREIGN KEY ("B") REFERENCES "permissoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indice GIN para acelerar consultas no JSONB de respostas (submissoes.dados)
CREATE INDEX "submissoes_dados_gin" ON "submissoes" USING GIN ("dados" jsonb_path_ops);
