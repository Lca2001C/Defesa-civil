const AdmZip = require("adm-zip");
const ExcelJS = require("exceljs");

const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function normalizeSpreadsheetXml(text) {
  if (!text.includes("x:")) return text;
  let out = text.replace(/<\/x:([a-zA-Z0-9]+)>/g, "</$1>");
  out = out.replace(/<x:([a-zA-Z0-9]+)/g, "<$1");
  if (out.includes('xmlns:x="' + MAIN_NS + '"')) {
    out = out.replace(
      ' xmlns:x="' + MAIN_NS + '"',
      ' xmlns="' + MAIN_NS + '" xmlns:r="' + REL_NS + '"',
    );
  }
  return out;
}

function repairXlsxFile(inputPath, outputPath) {
  const z = new AdmZip(inputPath);
  const changed = [];
  for (const entry of z.getEntries()) {
    if (!entry.entryName.endsWith(".xml")) continue;
    const raw = z.readAsText(entry);
    const norm = normalizeSpreadsheetXml(raw);
    if (norm !== raw) {
      z.updateFile(entry.entryName, Buffer.from(norm, "utf8"));
      changed.push("Normalizou namespace x: em " + entry.entryName);
    }
  }
  let ct = z.readAsText("[Content_Types].xml");
  if (!ct.includes("/xl/workbook.xml")) {
    ct = ct.replace(
      "</Types>",
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" /></Types>',
    );
    z.updateFile("[Content_Types].xml", Buffer.from(ct, "utf8"));
    changed.push("Adicionou Override de workbook em [Content_Types].xml");
  }
  z.writeZip(outputPath);
  return changed;
}

async function main() {
  const input = process.argv[2];
  const output = process.argv[3] || input;
  const changes = repairXlsxFile(input, output);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(output);
  console.log(JSON.stringify({ changes, sheets: wb.worksheets.map((w) => w.name) }, null, 2));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { repairXlsxFile };
