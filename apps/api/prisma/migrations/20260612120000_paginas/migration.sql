-- DropForeignKey
ALTER TABLE "secoes" DROP CONSTRAINT "secoes_versao_id_fkey";

-- DropIndex
DROP INDEX "secoes_versao_id_idx";

-- AlterTable
ALTER TABLE "secoes" DROP COLUMN "versao_id",
ADD COLUMN     "pagina_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "paginas" (
    "id" TEXT NOT NULL,
    "versao_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,

    CONSTRAINT "paginas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "paginas_versao_id_idx" ON "paginas"("versao_id");

-- CreateIndex
CREATE INDEX "secoes_pagina_id_idx" ON "secoes"("pagina_id");

-- AddForeignKey
ALTER TABLE "paginas" ADD CONSTRAINT "paginas_versao_id_fkey" FOREIGN KEY ("versao_id") REFERENCES "formulario_versoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secoes" ADD CONSTRAINT "secoes_pagina_id_fkey" FOREIGN KEY ("pagina_id") REFERENCES "paginas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
