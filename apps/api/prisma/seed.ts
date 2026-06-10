// =============================================================================
// Seed idempotente — Plataforma Defesa Civil MG (Passo 2: Nucleo de dados)
// -----------------------------------------------------------------------------
// Popula os dados de base do sistema, podendo ser executado quantas vezes
// forem necessarias sem duplicar registros:
//  - UFs (27, via upsert por id = codigo IBGE de 2 digitos)
//  - Municipios de MG (853, via createMany com skipDuplicates)
//  - Perfis (6 papeis RBAC, via upsert por codigo)
//  - Permissoes (catalogo "modulo.acao", via upsert por chave)
//  - Vinculo Perfil <-> Permissao (idempotente, via set: [...])
//
// OBSERVACAO: os USUARIOS NAO sao criados aqui. A criacao de usuarios depende
// do hashing de senha com Argon2id, que sera implementado no Passo 3.
//
// Execucao: `pnpm prisma:seed` (ver bloco "prisma" no package.json).
// =============================================================================

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// --------------------------- Tipos dos dados IBGE ----------------------------

/** Registro de UF no arquivo prisma/data/ufs.json. */
interface UfData {
  id: number; // codigo IBGE de 2 digitos (ex.: 31 = MG)
  sigla: string;
  nome: string;
}

/** Registro de Municipio no arquivo prisma/data/municipios-mg.json. */
interface MunicipioData {
  id: number; // codigo IBGE de 7 digitos (ex.: 3106200 = Belo Horizonte)
  nome: string;
}

// ------------------------------ Helpers de IO --------------------------------

/** Le e faz parse de um JSON em prisma/data/<arquivo>. */
function lerJson<T>(arquivo: string): T {
  const caminho = path.join(__dirname, "data", arquivo);
  const conteudo = fs.readFileSync(caminho, "utf-8");
  return JSON.parse(conteudo) as T;
}

// --------------------------- Catalogo de permissoes --------------------------

/** Permissao no formato "modulo.acao" com descricao legivel em portugues. */
interface PermissaoCatalogo {
  chave: string;
  descricao: string;
}

const PERMISSOES: PermissaoCatalogo[] = [
  { chave: "painel.ver", descricao: "Visualizar o painel estadual e os indicadores" },
  { chave: "competencias.gerenciar", descricao: "Criar, editar e abrir/encerrar competencias" },
  { chave: "formularios.criar", descricao: "Criar e editar formularios e suas versoes" },
  { chave: "formularios.publicar", descricao: "Publicar versoes de formularios" },
  { chave: "importacao.executar", descricao: "Executar importacao em massa via planilha" },
  { chave: "submissoes.criar", descricao: "Criar submissoes (respostas) de municipios" },
  { chave: "submissoes.editar", descricao: "Editar submissoes em rascunho ou correcao" },
  { chave: "submissoes.revisar", descricao: "Revisar submissoes e solicitar correcoes" },
  { chave: "submissoes.validar", descricao: "Validar ou rejeitar submissoes" },
  { chave: "municipios.gerenciar", descricao: "Gerenciar municipios, COMPDECs e regionais" },
  { chave: "usuarios.gerenciar", descricao: "Gerenciar usuarios e seus escopos de acesso" },
  { chave: "perfis.gerenciar", descricao: "Gerenciar perfis e suas permissoes (RBAC)" },
  { chave: "auditoria.ler", descricao: "Consultar o log de auditoria do sistema" },
  { chave: "relatorios.exportar", descricao: "Exportar relatorios e dados consolidados" },
];

/** Chaves de todas as permissoes (atalho para o perfil SUPER_ADMIN). */
const TODAS_PERMISSOES = PERMISSOES.map((p) => p.chave);

// ------------------------------- Catalogo de perfis --------------------------

/** Perfil (papel) RBAC com nivel hierarquico e permissoes associadas. */
interface PerfilCatalogo {
  codigo: string;
  nome: string;
  nivel: number;
  permissoes: string[]; // chaves de permissao vinculadas a este perfil
}

const PERFIS: PerfilCatalogo[] = [
  {
    codigo: "SUPER_ADMIN",
    nome: "Super Administrador",
    nivel: 100,
    // Acesso total ao sistema.
    permissoes: TODAS_PERMISSOES,
  },
  {
    codigo: "GESTOR_ESTADUAL",
    nome: "Gestor Estadual",
    nivel: 80,
    // Todas as permissoes, exceto gerenciar perfis (RBAC).
    permissoes: TODAS_PERMISSOES.filter((c) => c !== "perfis.gerenciar"),
  },
  {
    codigo: "COORDENADOR_REGIONAL",
    nome: "Coordenador Regional (REDEC)",
    nivel: 60,
    // Acompanha e revisa os municipios da sua regional.
    permissoes: [
      "painel.ver",
      "submissoes.revisar",
      "submissoes.validar",
      "relatorios.exportar",
    ],
  },
  {
    codigo: "ADMIN_MUNICIPAL",
    nome: "Administrador Municipal",
    nivel: 50,
    permissoes: [
      "painel.ver",
      "submissoes.criar",
      "submissoes.editar",
      "submissoes.revisar",
      "submissoes.validar",
      "relatorios.exportar",
      "usuarios.gerenciar",
    ],
  },
  {
    codigo: "OPERADOR_MUNICIPAL",
    nome: "Operador Municipal",
    nivel: 20,
    permissoes: [
      "painel.ver",
      "submissoes.criar",
      "submissoes.editar",
      "relatorios.exportar",
    ],
  },
  {
    codigo: "CONSULTA",
    nome: "Consulta (somente leitura)",
    nivel: 10,
    permissoes: ["painel.ver", "relatorios.exportar"],
  },
];

// --------------------------------- Rotinas -----------------------------------

/** UFs: upsert por id para os 27 estados. */
async function semearUfs(): Promise<number> {
  const ufs = lerJson<UfData[]>("ufs.json");
  for (const uf of ufs) {
    await prisma.uf.upsert({
      where: { id: uf.id },
      update: { sigla: uf.sigla, nome: uf.nome },
      create: { id: uf.id, sigla: uf.sigla, nome: uf.nome },
    });
  }
  return ufs.length;
}

/**
 * Municipios: insere os 853 municipios de MG com createMany + skipDuplicates.
 * Deve rodar APOS as UFs estarem garantidas (FK ufId). O ufId e derivado dos
 * 2 primeiros digitos do codigo IBGE de 7 digitos: Math.floor(id / 100000).
 */
async function semearMunicipios(): Promise<number> {
  const municipios = lerJson<MunicipioData[]>("municipios-mg.json");
  const dados = municipios.map((m) => ({
    id: m.id,
    nome: m.nome,
    ufId: Math.floor(m.id / 100000), // 2 primeiros digitos do codigo IBGE
  }));
  await prisma.municipio.createMany({ data: dados, skipDuplicates: true });
  return dados.length;
}

/** Permissoes: upsert do catalogo "modulo.acao" por chave. */
async function semearPermissoes(): Promise<number> {
  for (const permissao of PERMISSOES) {
    await prisma.permissao.upsert({
      where: { chave: permissao.chave },
      update: { descricao: permissao.descricao },
      create: { chave: permissao.chave, descricao: permissao.descricao },
    });
  }
  return PERMISSOES.length;
}

/**
 * Perfis: upsert por codigo dos 6 papeis e, em seguida, vinculo idempotente
 * com as permissoes via `set` (substitui o conjunto inteiro a cada execucao).
 */
async function semearPerfis(): Promise<number> {
  for (const perfil of PERFIS) {
    // 1) Garante o perfil (sem mexer nas permissoes ainda).
    await prisma.perfil.upsert({
      where: { codigo: perfil.codigo },
      update: { nome: perfil.nome, nivel: perfil.nivel },
      create: { codigo: perfil.codigo, nome: perfil.nome, nivel: perfil.nivel },
    });

    // 2) Reaplica o vinculo de permissoes de forma idempotente (set por chave).
    await prisma.perfil.update({
      where: { codigo: perfil.codigo },
      data: {
        permissoes: {
          set: perfil.permissoes.map((chave) => ({ chave })),
        },
      },
    });
  }
  return PERFIS.length;
}

// ----------------------------------- Main ------------------------------------

async function main(): Promise<void> {
  console.log("Iniciando seed da Plataforma Defesa Civil MG...");

  const totalUfs = await semearUfs();
  const totalMunicipios = await semearMunicipios();
  const totalPermissoes = await semearPermissoes();
  const totalPerfis = await semearPerfis();

  // Contagens reais persistidas no banco (confirmacao de idempotencia).
  const ufsNoBanco = await prisma.uf.count();
  const municipiosNoBanco = await prisma.municipio.count();
  const permissoesNoBanco = await prisma.permissao.count();
  const perfisNoBanco = await prisma.perfil.count();

  console.log("Seed concluido com sucesso:");
  console.log(`  UFs processadas:        ${totalUfs} (no banco: ${ufsNoBanco})`);
  console.log(`  Municipios processados: ${totalMunicipios} (no banco: ${municipiosNoBanco})`);
  console.log(`  Permissoes processadas: ${totalPermissoes} (no banco: ${permissoesNoBanco})`);
  console.log(`  Perfis processados:     ${totalPerfis} (no banco: ${perfisNoBanco})`);
  console.log(
    "  Usuarios: NAO criados neste seed (dependem de Argon2id — Passo 3).",
  );
}

main()
  .catch((erro) => {
    console.error("Falha ao executar o seed:", erro);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
