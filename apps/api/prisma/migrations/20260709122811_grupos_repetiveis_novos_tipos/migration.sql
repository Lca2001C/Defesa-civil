-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoPergunta" ADD VALUE 'ANO';
ALTER TYPE "TipoPergunta" ADD VALUE 'MES_ANO';
ALTER TYPE "TipoPergunta" ADD VALUE 'MUNICIPIO';
ALTER TYPE "TipoPergunta" ADD VALUE 'GRUPO';

-- DropIndex
DROP INDEX "municipios_nome_trgm_idx";

-- DropIndex
DROP INDEX "submissoes_nome_respondente_trgm_idx";

-- DropIndex
DROP INDEX "submissoes_protocolo_trgm_idx";

-- AlterTable
ALTER TABLE "arquivos" ALTER COLUMN "tamanho_bytes" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "perguntas" ADD COLUMN     "grupo_pai_id" TEXT,
ADD COLUMN     "max_instancias" INTEGER,
ADD COLUMN     "min_instancias" INTEGER,
ADD COLUMN     "multipla" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quantidade_origem_codigo" TEXT;

-- CreateIndex
CREATE INDEX "perguntas_grupo_pai_id_idx" ON "perguntas"("grupo_pai_id");

-- AddForeignKey
ALTER TABLE "perguntas" ADD CONSTRAINT "perguntas_grupo_pai_id_fkey" FOREIGN KEY ("grupo_pai_id") REFERENCES "perguntas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
