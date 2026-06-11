-- DropIndex
DROP INDEX "submissoes_dados_gin";

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "mfa_ativo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfa_secret" TEXT;

-- CreateTable
CREATE TABLE "termos_lgpd" (
    "id" TEXT NOT NULL,
    "versao" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "termos_lgpd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aceites_termo_lgpd" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "user_agent" TEXT,
    "versao_termo" TEXT NOT NULL,
    "aceitou_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aceites_termo_lgpd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recuperacao_senhas" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recuperacao_senhas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "termos_lgpd_versao_key" ON "termos_lgpd"("versao");

-- CreateIndex
CREATE INDEX "aceites_termo_lgpd_email_idx" ON "aceites_termo_lgpd"("email");

-- CreateIndex
CREATE INDEX "aceites_termo_lgpd_versao_termo_idx" ON "aceites_termo_lgpd"("versao_termo");

-- CreateIndex
CREATE INDEX "aceites_termo_lgpd_usuario_id_idx" ON "aceites_termo_lgpd"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "recuperacao_senhas_token_hash_key" ON "recuperacao_senhas"("token_hash");

-- CreateIndex
CREATE INDEX "recuperacao_senhas_email_idx" ON "recuperacao_senhas"("email");

-- AddForeignKey
ALTER TABLE "aceites_termo_lgpd" ADD CONSTRAINT "aceites_termo_lgpd_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aceites_termo_lgpd" ADD CONSTRAINT "aceites_termo_lgpd_versao_termo_fkey" FOREIGN KEY ("versao_termo") REFERENCES "termos_lgpd"("versao") ON DELETE RESTRICT ON UPDATE CASCADE;
