import * as fs from "fs";
import * as path from "path";
import * as ExcelJS from "exceljs";
import { createRequire } from "module";
import { FormularioImportService } from "../src/modules/formularios/services/formulario-import.service";

const require = createRequire(import.meta.url);
const { repairXlsxFile } = require("./repair-ooxml.cjs");
const { alignListasSuspensas } = require("./listas-alignment.cjs");

const DEFAULT_XLSX = "c:/Users/x19991860/Downloads/primeiro_arquivo_completo_no_formato_do_segundo.xlsx";
const ABA_LISTAS = "listas_suspensas";
const ALIAS_PERGUNTA = new Set(["pergunta", "perguntas", "campo"]);
const ALIAS_TIPO = new Set(["tipo", "tipo de resposta", "tipo de campo"]);
const ALIAS_RESPOSTA = new Set(["resposta", "respostas", "valor"]);

function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function celStr(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return "";
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: string };
    if (o.richText) return o.richText.map((r) => r.text).join("").trim();
    if (o.text !== undefined) return String(o.text).trim();
    if (o.result !== undefined) return String(o.result).trim();
    return "";
  }
  return String(v).trim();
}

type Cabecalho = { linha: number; colPergunta: number; colTipo: number; colResposta?: number };

function acharCabecalho(ws: ExcelJS.Worksheet, maxLinhas = 8): Cabecalho | null {
  const limite = Math.min(ws.rowCount, maxLinhas);
  for (let r = 1; r <= limite; r++) {
    let colPergunta = 0;
    let colTipo = 0;
    let colResposta = 0;
    ws.getRow(r).eachCell((cell, col) => {
      const n = norm(celStr(cell));
      if (ALIAS_PERGUNTA.has(n)) colPergunta = col;
      if (ALIAS_TIPO.has(n)) colTipo = col;
      if (ALIAS_RESPOSTA.has(n)) colResposta = col;
    });
    if (colPergunta && colTipo) return { linha: r, colPergunta, colTipo, colResposta: colResposta || undefined };
  }
  return null;
}

function isListasSheet(name: string): boolean {
  const n = norm(name);
  return n === ABA_LISTAS || n === "listas suspensas" || /^listas[_\s-]+suspensas$/.test(n);
}

function isInstrucoesSheet(name: string): boolean { return norm(name).startsWith("instruc"); }
function isSecaoSheet(name: string): boolean { return !isListasSheet(name) && !isInstrucoesSheet(name); }

interface SheetAnalysis {
  name: string;
  kind: string;
  header: Cabecalho | null;
  headerInFirst8: boolean;
  issues: string[];
}

function analyzeSheet(ws: ExcelJS.Worksheet): SheetAnalysis {
  const issues: string[] = [];
  const kind = isListasSheet(ws.name) ? "listas" : isInstrucoesSheet(ws.name) ? "instrucoes" : "secao";
  let header = acharCabecalho(ws, 8);
  const headerInFirst8 = !!header;
  if (!header && kind === "secao") {
    header = acharCabecalho(ws, 60);
    if (header) issues.push("Cabecalho fora das 8 primeiras linhas: linha " + header.linha);
  }
  if (!header && kind === "secao") issues.push("Sem colunas Pergunta e Tipo");
  if (kind === "listas" && norm(ws.name) !== ABA_LISTAS) issues.push("Nome da aba deve ser Listas_Suspensas");
  if (kind === "instrucoes" && !celStr(ws.getCell("B1"))) issues.push("Instrucoes B1 vazia");
  return { name: ws.name, kind, header, headerInFirst8, issues };
}

function renameHeaderCells(ws: ExcelJS.Worksheet, cab: Cabecalho): string[] {
  const changes: string[] = [];
  const row = ws.getRow(cab.linha);
  const pairs: [number, string, Set<string>][] = [
    [cab.colPergunta, "Pergunta", ALIAS_PERGUNTA],
    [cab.colTipo, "Tipo", ALIAS_TIPO],
  ];
  if (cab.colResposta) pairs.push([cab.colResposta, "Resposta", ALIAS_RESPOSTA]);
  for (const [col, canonical, aliases] of pairs) {
    const cell = row.getCell(col);
    const before = celStr(cell);
    const n = norm(before);
    if (!before || n !== norm(canonical)) {
      if (!before || aliases.has(n) || n !== norm(canonical)) {
        cell.value = canonical;
        changes.push("Header L" + cab.linha + " C" + col + ": " + before + " -> " + canonical);
      }
    }
  }
  return changes;
}

function moveHeaderToRow1(ws: ExcelJS.Worksheet, cab: Cabecalho): string[] {
  if (cab.linha <= 1) return [];
  const n = cab.linha - 1;
  ws.spliceRows(1, n);
  return ["Removeu " + n + " linha(s) acima do cabecalho em " + ws.name];
}

function ensureInstrucoes(wb: ExcelJS.Workbook): string[] {
  const changes: string[] = [];
  let ws = wb.worksheets.find((w) => isInstrucoesSheet(w.name));
  if (!ws) {
    ws = wb.addWorksheet("Instrucoes", 0);
    ws.getCell("A1").value = "Nome do formulario:";
    ws.getCell("B1").value = "Formulario importado";
    changes.push("Criou aba Instrucoes");
    return changes;
  }
  if (!celStr(ws.getCell("B1"))) {
    ws.getCell("A1").value = "Nome do formulario:";
    ws.getCell("B1").value = "Formulario importado";
    changes.push("Preencheu B1 em Instrucoes");
  }
  return changes;
}

function fixWorkbook(wb: ExcelJS.Workbook): { issues: SheetAnalysis[]; changes: string[] } {
  const issues = wb.worksheets.map(analyzeSheet);
  const changes: string[] = [];
  for (const ws of wb.worksheets) {
    if (isListasSheet(ws.name) && norm(ws.name) !== ABA_LISTAS) {
      const old = ws.name;
      ws.name = "Listas_Suspensas";
      changes.push('Renomeou listas "' + old + '" -> Listas_Suspensas');
    }
  }
  changes.push(...ensureInstrucoes(wb));
  for (const ws of wb.worksheets) {
    if (!isSecaoSheet(ws.name)) continue;
    let cab = acharCabecalho(ws, 60);
    if (!cab) continue;
    if (cab.linha > 1) {
      changes.push(...moveHeaderToRow1(ws, cab));
      cab = acharCabecalho(ws, 8);
    }
    if (cab) changes.push(...renameHeaderCells(ws, cab));
  }
  changes.push(...alignListasSuspensas(wb));
  return { issues, changes };
}

async function runParse(filePath: string) {
  const svc = new FormularioImportService();
  const buffer = fs.readFileSync(filePath);
  try {
    const result = await svc.parsear(buffer);
    return { ok: true as const, nome: result.nome, resumo: result.resumo, erros: result.erros, fatal: null as string | null };
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "message" in e ? String((e as Error).message) : String(e);
    return { ok: false as const, nome: null, resumo: null, erros: [] as string[], fatal: msg };
  }
}

function countSecaoIgnorada(erros: string[]): number {
  return erros.filter((e) => /seção ignorada|secao ignorada|não achei as colunas|nao achei as colunas/i.test(e)).length;
}

async function main() {
  let inputPath = path.resolve(process.argv[2] || DEFAULT_XLSX);
  if (!fs.existsSync(inputPath)) { console.error("Arquivo nao encontrado:", inputPath); process.exit(1); }
  console.log("=== Arquivo:", inputPath);

  const tmpRepair = inputPath + ".tmp-repair.xlsx";
  let ooxmlChanges: string[] = [];
  try {
    ooxmlChanges = repairXlsxFile(inputPath, tmpRepair);
    fs.copyFileSync(tmpRepair, inputPath);
    try { fs.unlinkSync(tmpRepair); } catch { /* ignore */ }
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? String((e as NodeJS.ErrnoException).code) : "";
    if (code === "EBUSY" && fs.existsSync(tmpRepair)) {
      const fallback = inputPath.replace(/\.xlsx$/i, "_fixed.xlsx");
      fs.copyFileSync(tmpRepair, fallback);
      console.log("Arquivo original bloqueado; salvo em:", fallback);
      inputPath = fallback;
    } else throw e;
  }
  if (ooxmlChanges.length) {
    console.log("\n=== Reparo OOXML (ExcelJS) ===");
    ooxmlChanges.forEach((c) => console.log("-", c));
  }

  const before = await runParse(inputPath);
  console.log("\n=== Parse ANTES (pos OOXML) ===");
  if (!before.ok) console.log("FATAL:", before.fatal);
  else {
    console.log("Nome:", before.nome);
    console.log("Resumo:", JSON.stringify(before.resumo));
    console.log("Erros:", before.erros.length, "secoes ignoradas:", countSecaoIgnorada(before.erros));
    before.erros.forEach((e) => console.log(" -", e));
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(inputPath);
  console.log("\n=== Analise estrutural ===");
  const preIssues = wb.worksheets.map(analyzeSheet);
  preIssues.forEach((a) => {
    console.log("-", a.name, "[" + a.kind + "]", a.header ? "hdr@" + a.header.linha : "no-hdr", a.issues.join("; ") || "ok");
  });

  const { changes } = fixWorkbook(wb);
  console.log("\n=== Alteracoes layout ===");
  if (!changes.length) console.log("(nenhuma)");
  else changes.forEach((c) => console.log("-", c));

  await wb.xlsx.writeFile(inputPath);

  const after = await runParse(inputPath);
  console.log("\n=== Parse DEPOIS ===");
  if (!after.ok) console.log("FATAL:", after.fatal);
  else {
    console.log("Nome:", after.nome);
    console.log("Resumo:", JSON.stringify(after.resumo));
    console.log("Erros:", after.erros.length, "secoes ignoradas:", countSecaoIgnorada(after.erros));
    after.erros.forEach((e) => console.log(" -", e));
  }

  const reportPath = path.join(path.dirname(inputPath), "fix-xlsx-import-report.json");
  fs.writeFileSync(reportPath, JSON.stringify({ inputPath, ooxmlChanges, before, preIssues, changes, after }, null, 2));
  console.log("\nRelatorio:", reportPath);
}

main().catch((err) => { console.error(err); process.exit(1); });

