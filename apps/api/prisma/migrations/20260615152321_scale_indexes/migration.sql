-- CreateIndex
CREATE INDEX "submissoes_autor_id_idx" ON "submissoes"("autor_id");

-- CreateIndex
CREATE INDEX "submissoes_competencia_id_created_at_idx" ON "submissoes"("competencia_id", "created_at");

-- CreateIndex
CREATE INDEX "submissoes_competencia_id_status_idx" ON "submissoes"("competencia_id", "status");
