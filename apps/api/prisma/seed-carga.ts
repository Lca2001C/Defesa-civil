// =============================================================================
// Seed de CARGA — gera submissões sintéticas para teste de escala.
// -----------------------------------------------------------------------------
// Popula submissões cobrindo TODOS os 853 municípios de MG, com mix realista de
// status, para validar painel/dashboard/export e índices sob volume.
//
// NUNCA roda em produção: exige a env SEED_CARGA=1.
//
// Parâmetros (env):
//   SUBMISSOES_POR_MUNICIPIO  (default 5)   — submissões geradas por município
//   HISTORICO_MULT            (default 1)   — multiplicador para inflar o volume
//
// Execução: `pnpm --filter @dcmg/api seed:carga`
// =============================================================================

import { PrismaClient, SubmissaoStatus } from "@prisma/client";

const prisma = new PrismaClient();

const LOTE = 5000;

// Distribuição de status (soma = 100) — mistura realista.
const DISTRIBUICAO: { status: SubmissaoStatus; peso: number }[] = [
  { status: SubmissaoStatus.APROVADO, peso: 30 },
  { status: SubmissaoStatus.ENVIADO, peso: 25 },
  { status: SubmissaoStatus.EM_PREENCHIMENTO, peso: 15 },
  { status: SubmissaoStatus.RASCUNHO, peso: 12 },
  { status: SubmissaoStatus.CORRECAO_SOLICITADA, peso: 10 },
  { status: SubmissaoStatus.REVISADO, peso: 8 },
];

function statusAleatorio(): SubmissaoStatus {
  const r = Math.random() * 100;
  let acc = 0;
  for (const d of DISTRIBUICAO) {
    acc += d.peso;
    if (r <= acc) return d.status;
  }
  return SubmissaoStatus.RASCUNHO;
}

async function main(): Promise<void> {
  if (process.env["SEED_CARGA"] !== "1") {
    throw new Error("Seed de carga bloqueado. Defina SEED_CARGA=1 para executar.");
  }

  const porMunicipio = Number(process.env["SUBMISSOES_POR_MUNICIPIO"] ?? 5);
  const mult = Number(process.env["HISTORICO_MULT"] ?? 1);
  const totalPorMunicipio = porMunicipio * mult;

  console.log(`Seed de carga: ${totalPorMunicipio} submissões/município...`);

  // Dependências obrigatórias (FKs válidas)
  const competencia = await prisma.competencia.findFirst({ where: { status: "ABERTA" } });
  if (!competencia) throw new Error("Nenhuma competência ABERTA. Rode o seed principal antes.");

  const versao = await prisma.formularioVersao.findFirst({ orderBy: { criadoEm: "desc" } });
  if (!versao) throw new Error("Nenhuma FormularioVersao encontrada. Crie um formulário antes.");

  const admin = await prisma.usuario.findFirst({ where: { perfil: { codigo: "SUPER_ADMIN" } } });
  if (!admin) throw new Error("Usuário SUPER_ADMIN não encontrado. Rode o seed principal antes.");

  const municipios = await prisma.municipio.findMany({
    where: { ufId: 31 },
    select: { id: true },
  });
  console.log(`Municípios de MG: ${municipios.length}`);

  const agora = Date.now();
  let buffer: {
    protocolo: string;
    municipioId: number;
    formularioVersaoId: string;
    competenciaId: string;
    autorId: string;
    nomeRespondente: string;
    cpfRespondente: string;
    status: SubmissaoStatus;
    enviadoEm: Date | null;
    aprovadoEm: Date | null;
    criadoEm: Date;
  }[] = [];
  let totalInserido = 0;

  async function flush() {
    if (buffer.length === 0) return;
    await prisma.submissao.createMany({ data: buffer, skipDuplicates: true });
    totalInserido += buffer.length;
    console.log(`  inseridas: ${totalInserido}`);
    buffer = [];
  }

  for (const m of municipios) {
    for (let i = 0; i < totalPorMunicipio; i++) {
      const status = statusAleatorio();
      const enviado =
        status !== SubmissaoStatus.RASCUNHO && status !== SubmissaoStatus.EM_PREENCHIMENTO;
      // criadoEm distribuído nos últimos 90 dias para exercitar a timeline.
      const criadoEm = new Date(agora - Math.floor(Math.random() * 90) * 86_400_000);

      buffer.push({
        protocolo: `CARGA-${m.id}-${i}-${Math.random().toString(36).slice(2, 9)}`,
        municipioId: m.id,
        formularioVersaoId: versao.id,
        competenciaId: competencia.id,
        autorId: admin.id,
        nomeRespondente: "Respondente de Carga",
        cpfRespondente: "00000000000",
        status,
        enviadoEm: enviado ? criadoEm : null,
        aprovadoEm: status === SubmissaoStatus.APROVADO ? criadoEm : null,
        criadoEm,
      });

      if (buffer.length >= LOTE) await flush();
    }
  }
  await flush();

  console.log(`\nSeed de carga concluído: ${totalInserido} submissões inseridas.`);
}

main()
  .catch((erro) => {
    console.error("Falha no seed de carga:", erro);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
