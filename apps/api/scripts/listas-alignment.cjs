const MARCADORES_FILHA = ["\u21b3", "->", "\u2192", "\u00bb", "\u203a"];

function norm(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function celStr(cell) {
  if (!cell) return "";
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((r) => r.text).join("").trim();
    if (v.text !== undefined) return String(v.text).trim();
    if (v.result !== undefined) return String(v.result).trim();
    return "";
  }
  return String(v).trim();
}

function stripFilha(rotuloBruto) {
  const marcador = MARCADORES_FILHA.find((m) => rotuloBruto.startsWith(m));
  if (!marcador) return rotuloBruto.trim();
  return rotuloBruto.slice(marcador.length).trim();
}

function listaLookupKey(perguntaBruta) {
  return norm(stripFilha(perguntaBruta));
}

function tokenSet(s) {
  return new Set(norm(s).split(/[^a-z0-9]+/).filter((t) => t.length > 2));
}

function similarity(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

function isListasSheet(name) {
  const n = norm(name);
  return n === "listas_suspensas" || n === "listas suspensas";
}

function isInstrucoesSheet(name) {
  return norm(name).startsWith("instruc");
}

function acharCabecalho(ws, maxLinhas = 8) {
  const limite = Math.min(ws.rowCount, maxLinhas);
  for (let r = 1; r <= limite; r++) {
    let colPergunta = 0;
    let colTipo = 0;
    ws.getRow(r).eachCell((cell, col) => {
      const n = norm(celStr(cell));
      if (n === "pergunta") colPergunta = col;
      if (n === "tipo") colTipo = col;
    });
    if (colPergunta && colTipo) return { linha: r, colPergunta, colTipo };
  }
  return null;
}

function readListHeaders(ws) {
  const headers = [];
  ws.getRow(1).eachCell((cell, col) => {
    const name = celStr(cell);
    if (name) headers.push({ col, name, key: listaLookupKey(name) });
  });
  return headers;
}

function normalizeListHeaderNames(wsListas) {
  const changes = [];
  const headers = readListHeaders(wsListas);
  for (const h of headers) {
    const stripped = stripFilha(h.name);
    if (stripped !== h.name) {
      wsListas.getRow(1).getCell(h.col).value = stripped;
      changes.push('Listas_Suspensas C' + h.col + ' removeu marcador-filha do titulo: "' + h.name + '" -> "' + stripped + '"');
    }
  }
  return changes;
}

function firstEmptyListCol(ws) {
  let max = 1;
  ws.getRow(1).eachCell((_, col) => {
    if (col > max) max = col;
  });
  for (let c = 1; c <= max + 5; c++) {
    if (!celStr(ws.getRow(1).getCell(c))) return c;
  }
  return max + 1;
}

function listHeaderForQuestion(perguntaBruta) {
  const marcador = MARCADORES_FILHA.find((m) => perguntaBruta.startsWith(m));
  return marcador ? stripFilha(perguntaBruta) : perguntaBruta;
}

function findCloneSource(key, headers, usedCols) {
  if (key.includes("tipo de formacao")) {
    return headers.find((h) => h.key.includes("area do conhecimento"));
  }
  if (key.includes("quantos") && key.includes("contratados")) {
    return headers.find((h) => h.key.includes("efetivos") || h.key.includes("comissionado"));
  }
  return null;
}

function cloneListColumn(ws, srcCol, newHeader) {
  const dstCol = firstEmptyListCol(ws);
  ws.getRow(1).getCell(dstCol).value = newHeader;
  for (let r = 2; r <= ws.rowCount; r++) {
    const src = ws.getRow(r).getCell(srcCol);
    const v = celStr(src);
    if (v) ws.getRow(r).getCell(dstCol).value = src.value;
  }
  return dstCol;
}

const TIPO_OVERRIDES = new Map([
  [norm(stripFilha("Com quais munic\u00edpios?")), "Texto longo"],
]);

function alignListasSuspensas(wb) {
  const changes = [];
  const wsListas = wb.worksheets.find((w) => isListasSheet(w.name));
  if (!wsListas) return changes;
  changes.push(...normalizeListHeaderNames(wsListas));
  let headers = readListHeaders(wsListas);
  const usedCols = new Set();

  const pending = [];
  for (const ws of wb.worksheets) {
    if (isListasSheet(ws.name) || isInstrucoesSheet(ws.name)) continue;
    const cab = acharCabecalho(ws, 60);
    if (!cab) continue;
    for (let r = cab.linha + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const perguntaBruta = celStr(row.getCell(cab.colPergunta));
      const tipoRaw = celStr(row.getCell(cab.colTipo));
      if (norm(tipoRaw) !== "lista suspensa") continue;
      const key = listaLookupKey(perguntaBruta);
      if (!key) continue;
      const hit = headers.find((h) => h.key === key);
      if (hit) {
        usedCols.add(hit.col);
        continue;
      }
      pending.push({ ws, row: r, cab, perguntaBruta, key, tipoRaw });
    }
  }

  for (const item of pending) {
    const cloneSrc = findCloneSource(item.key, headers, usedCols);
    if (cloneSrc) {
      const title = listHeaderForQuestion(item.perguntaBruta);
      const dst = cloneListColumn(wsListas, cloneSrc.col, title);
      headers = readListHeaders(wsListas);
      usedCols.add(dst);
      changes.push(
        "Listas_Suspensas clonou C" + cloneSrc.col + " -> C" + dst + ' para "' + title + '"',
      );
      continue;
    }

    const override = TIPO_OVERRIDES.get(item.key);
    if (override) {
      item.ws.getRow(item.row).getCell(item.cab.colTipo).value = override;
      changes.push(
        'Tipo "' + item.perguntaBruta.slice(0, 40) + '..." em ' + item.ws.name + ": Lista suspensa -> " + override,
      );
      continue;
    }

    let best = null;
    let bestScore = 0;
    for (const h of headers) {
      if (usedCols.has(h.col)) continue;
      const score = Math.max(similarity(item.key, h.key), similarity(item.key, h.name));
      if (score > bestScore) {
        bestScore = score;
        best = h;
      }
    }

    if (best && bestScore >= 0.35) {
      const before = best.name;
      const newName = listHeaderForQuestion(item.perguntaBruta);
      wsListas.getRow(1).getCell(best.col).value = newName;
      best.name = newName;
      best.key = norm(newName);
      usedCols.add(best.col);
      changes.push("Listas_Suspensas C" + best.col + ' renomeou "' + before + '" -> "' + newName + '"');
      headers = readListHeaders(wsListas);
      continue;
    }

    if (best && bestScore >= 0.2) {
      const dst = cloneListColumn(wsListas, best.col, listHeaderForQuestion(item.perguntaBruta));
      headers = readListHeaders(wsListas);
      usedCols.add(dst);
      changes.push(
        "Listas_Suspensas clonou C" + best.col + " -> C" + dst + ' com titulo "' + stripFilha(item.perguntaBruta) + '"',
      );
      continue;
    }

    item.ws.getRow(item.row).getCell(item.cab.colTipo).value = "Texto longo";
    changes.push(
      "Tipo (fallback) em " + item.ws.name + ' "' + item.perguntaBruta.slice(0, 50) + '...": Lista suspensa -> Texto longo',
    );
  }

  return changes;
}

module.exports = { alignListasSuspensas, listaLookupKey, norm, stripFilha };

