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

import { EscopoUsuario, PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
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

/**
 * COMPDECs: cria um registro placeholder para cada município de MG.
 * Usa skipDuplicates para ser idempotente — não sobrescreve dados já preenchidos.
 */
async function semearCompdecs(): Promise<number> {
  const municipios = await prisma.municipio.findMany({
    where: { ufId: 31 }, // MG = IBGE 31
    select: { id: true },
  });

  const dados = municipios.map((m) => ({
    municipioId: m.id,
    coordenadorNome: 'A preencher',
    email: null as string | null,
    telefone: null as string | null,
  }));

  await prisma.compdec.createMany({ data: dados, skipDuplicates: true });
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

/**
 * SUPER_ADMIN: cria o usuario administrador inicial do sistema se nao existir.
 * Credenciais configuradas via variaveis de ambiente (com valores padrao para dev).
 *
 * AVISO: em producao, defina SEED_ADMIN_EMAIL, SEED_ADMIN_SENHA e SEED_ADMIN_CPF
 * no ambiente antes de executar o seed.
 */
async function semearSuperAdmin(): Promise<{ criado: boolean; email: string }> {
  const email = process.env["SEED_ADMIN_EMAIL"] ?? "admin@defesacivil.mg.gov.br";
  const senha = process.env["SEED_ADMIN_SENHA"] ?? "Defesa@Civil2026!";
  const cpf   = process.env["SEED_ADMIN_CPF"]   ?? "00000000000";
  const nome  = process.env["SEED_ADMIN_NOME"]  ?? "Administrador do Sistema";

  const perfilSuperAdmin = await prisma.perfil.findUnique({
    where: { codigo: "SUPER_ADMIN" },
  });
  if (!perfilSuperAdmin) {
    throw new Error("Perfil SUPER_ADMIN nao encontrado — execute o seed de perfis antes.");
  }

  const jaExiste = await prisma.usuario.findUnique({ where: { email } });
  if (jaExiste) return { criado: false, email };

  const senhaHash = await argon2.hash(senha, { type: argon2.argon2id });

  await prisma.usuario.create({
    data: {
      nome,
      cpf,
      email,
      senhaHash,
      cargo: "Administrador do Sistema",
      perfilId: perfilSuperAdmin.id,
      escopo: EscopoUsuario.ESTADUAL,
      ativo: true,
    },
  });

  return { criado: true, email };
}

// ----------------------------- Termo LGPD v1.0 -------------------------------

async function semearTermoLgpd(): Promise<boolean> {
  const versao = "1.0";
  const jaExiste = await prisma.termoLgpd.findUnique({ where: { versao } });
  if (jaExiste) return false;

  await prisma.termoLgpd.create({
    data: {
      versao,
      ativo: true,
      conteudo: `
**TERMOS DE USO E POLÍTICA DE PRIVACIDADE**
**Plataforma SIG-COMPDEC MG — Versão ${versao}**

**1. Identificação do Controlador**
A Coordenadoria Estadual de Defesa Civil de Minas Gerais (CEDEC-MG), vinculada ao Corpo de Bombeiros Militar de Minas Gerais, é o Controlador dos dados pessoais tratados nesta plataforma, nos termos da Lei nº 13.709/2018 (LGPD).

**2. Dados Coletados**
Ao se cadastrar e utilizar a plataforma, os seguintes dados são coletados:
- Nome completo, CPF, e-mail, telefone e cargo;
- Endereço IP e identificador do navegador (user-agent) em cada acesso e submissão;
- Data e hora das ações realizadas no sistema.

**3. Finalidade do Tratamento**
Os dados são utilizados exclusivamente para:
- Identificação e autenticação do usuário;
- Rastreabilidade e responsabilização das respostas enviadas em nome do município (COMPDEC);
- Cumprimento de obrigações legais e exercício de competências da Defesa Civil Estadual.

**4. Base Legal**
O tratamento fundamenta-se no cumprimento de obrigação legal e no exercício regular de atribuições da Administração Pública (art. 7º, II e III; art. 23 da LGPD).

**5. Compartilhamento de Dados**
Os dados não são compartilhados com terceiros, salvo por obrigação legal ou determinação judicial. Integrações futuras com sistemas federais (ex.: S2ID) serão formalizadas e comunicadas.

**6. Retenção e Descarte**
Os dados são mantidos pelo prazo exigido pela legislação aplicável e pelas diretrizes da Administração Pública Estadual. Ao término do prazo, os dados são anonimizados ou eliminados de forma segura.

**7. Seus Direitos**
Nos termos da LGPD, você pode solicitar ao Encarregado (DPO): confirmação do tratamento, acesso, correção, portabilidade, eliminação (quando cabível) e esclarecimentos sobre o uso dos seus dados.

**8. Contato com o Encarregado (DPO)**
Dúvidas e solicitações podem ser encaminhadas para o canal oficial da CEDEC-MG.

**9. Aceitação**
Ao marcar a opção "Li e aceito os Termos de Uso e Política de Privacidade", você confirma ter lido este documento na íntegra e concorda com o tratamento dos seus dados conforme descrito acima. O registro deste aceite (data, IP e versão do termo) é armazenado para fins de comprovação.
      `.trim(),
    },
  });

  return true;
}

// ----------------------------------- Main ------------------------------------

async function main(): Promise<void> {
  console.log("Iniciando seed da Plataforma Defesa Civil MG...");

  const totalUfs = await semearUfs();
  const totalMunicipios = await semearMunicipios();
  const totalCompdecs = await semearCompdecs();
  const totalPermissoes = await semearPermissoes();
  const totalPerfis = await semearPerfis();
  const adminResult = await semearSuperAdmin();
  const termoCriado = await semearTermoLgpd();

  // Contagens reais persistidas no banco (confirmacao de idempotencia).
  const ufsNoBanco = await prisma.uf.count();
  const municipiosNoBanco = await prisma.municipio.count();
  const permissoesNoBanco = await prisma.permissao.count();
  const perfisNoBanco = await prisma.perfil.count();

  const adminStatus = adminResult.criado
    ? `criado (${adminResult.email})`
    : `ja existe — sem alteracoes (${adminResult.email})`;

  console.log("Seed concluido com sucesso:");
  console.log(`  UFs processadas:        ${totalUfs} (no banco: ${ufsNoBanco})`);
  console.log(`  Municipios processados: ${totalMunicipios} (no banco: ${municipiosNoBanco})`);
  console.log(`  COMPDECs criadas:       ${totalCompdecs} (idempotente — skipDuplicates)`);
  console.log(`  Permissoes processadas: ${totalPermissoes} (no banco: ${permissoesNoBanco})`);
  console.log(`  Perfis processados:     ${totalPerfis} (no banco: ${perfisNoBanco})`);
  console.log(`  SUPER_ADMIN:            ${adminStatus}`);
  console.log(`  Termo LGPD v1.0:        ${termoCriado ? "criado" : "ja existe"}`);
}

main()
  .catch((erro) => {
    console.error("Falha ao executar o seed:", erro);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
