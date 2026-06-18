/** MIME types aceitos para anexos de submissão. */
const MIME_ANEXO_PERMITIDOS = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
  'application/vnd.ms-excel',
  'application/zip',
  'application/x-zip-compressed',
  'image/png',
  'image/jpeg',
  // Geoespaciais
  'application/vnd.google-earth.kml+xml', // KML
  'application/vnd.google-earth.kmz',     // KMZ
  'application/xml',                       // KML via content-type genérico
  'text/xml',                              // KML via content-type texto
  'application/json',                      // GeoJSON / JSON
  'application/octet-stream',              // SHP (sem MIME padrão) / binários grandes
  'application/x-shapefile',               // SHP alternativo
  // Mídia / raster (anexos grandes: vídeos, imagens de satélite/dron, áudio)
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm',
  'image/tiff', 'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'audio/mpeg', 'audio/wav',
  'application/gzip', 'application/x-7z-compressed', 'application/x-rar-compressed',
  'text/csv', 'text/plain',
]);

const EXT_ANEXO_PERMITIDAS = [
  '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.zip', '.png', '.jpg', '.jpeg',
  // Geoespaciais
  '.kml', '.kmz', '.json', '.geojson', '.shp', '.dbf', '.shx', '.prj',
  // Mídia / raster / arquivos grandes
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.tif', '.tiff', '.gif', '.webp',
  '.mp3', '.wav', '.gz', '.7z', '.rar', '.csv', '.txt',
];

/** Valida tipo de arquivo pelo MIME OU extensão (aceita se qualquer um casar). */
export function tipoArquivoPermitido(nomeOriginal: string, mimeType?: string): boolean {
  const ext = nomeOriginal.slice(nomeOriginal.lastIndexOf('.')).toLowerCase();
  const mimeOk = !!mimeType && MIME_ANEXO_PERMITIDOS.has(mimeType);
  const extOk = EXT_ANEXO_PERMITIDAS.includes(ext);
  return mimeOk || extOk;
}
