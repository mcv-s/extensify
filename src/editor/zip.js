import { normalizePath, validatePackage } from '../addons/validation.js';
import { upgradeAddonPackage } from '../addons/metadata.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const allowedExtensions = new Set(['.html', '.css', '.js', '.json', '.md', '.txt', '.svg']);
const crcTable = (() => { const table = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } return table; })();
function crc32(data) { let crc = 0xffffffff; for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }

export async function importAddonZip(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error('ZIP packages must be smaller than 20 MB.');
  const data = new Uint8Array(await file.arrayBuffer()); const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const eocd = findSignature(view, 0x06054b50, Math.max(0, data.length - 65557));
  if (eocd < 0) throw new Error('This is not a supported ZIP archive.');
  const count = view.getUint16(eocd + 10, true); const centralOffset = view.getUint32(eocd + 16, true);
  if (count > 100) throw new Error('ZIP packages are limited to 100 files.');
  const files = Object.create(null); let total = 0; let cursor = centralOffset;
  for (let entry = 0; entry < count; entry++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('ZIP central directory is damaged.');
    const flags = view.getUint16(cursor + 8, true); const method = view.getUint16(cursor + 10, true); const expectedCrc = view.getUint32(cursor + 16, true); const compressed = view.getUint32(cursor + 20, true); const size = view.getUint32(cursor + 24, true); const nameLength = view.getUint16(cursor + 28, true); const extraLength = view.getUint16(cursor + 30, true); const commentLength = view.getUint16(cursor + 32, true); const localOffset = view.getUint32(cursor + 42, true);
    const rawName = data.slice(cursor + 46, cursor + 46 + nameLength); const name = (flags & 0x800) ? decoder.decode(rawName) : new TextDecoder('ascii').decode(rawName);
    cursor += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/')) continue;
    if (flags & 1) throw new Error('Encrypted ZIP files are not supported.');
    if (size > 2 * 1024 * 1024) throw new Error(`${name} exceeds the 2 MB file limit.`);
    total += size; if (total > 10 * 1024 * 1024) throw new Error('ZIP package expands beyond the 10 MB total limit.');
    const safe = normalizePath(name); const slash = safe.indexOf('/'); const path = normalizePath(slash >= 0 ? safe.slice(slash + 1) : safe);
    if (Object.hasOwn(files, path)) throw new Error(`Duplicate file path: ${path}`);
    const extension = path.includes('.') ? path.slice(path.lastIndexOf('.')).toLowerCase() : '';
    if (!allowedExtensions.has(extension)) throw new Error(`Unsupported file extension: ${path}`);
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error(`ZIP entry is damaged: ${path}`);
    const localName = view.getUint16(localOffset + 26, true); const localExtra = view.getUint16(localOffset + 28, true); const start = localOffset + 30 + localName + localExtra; const compressedData = data.slice(start, start + compressed);
    let contentBytes;
    if (method === 0) contentBytes = compressedData;
    else if (method === 8 && typeof DecompressionStream === 'function') contentBytes = new Uint8Array(await new Response(new Blob([compressedData]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else throw new Error(`ZIP compression method ${method} is not supported by this browser.`);
    if (contentBytes.length !== size || crc32(contentBytes) !== expectedCrc) throw new Error(`ZIP integrity check failed for ${path}.`);
    files[path] = decoder.decode(contentBytes);
  }
  let config; try { config = JSON.parse(files['config.json'] ?? ''); } catch { throw new Error('ZIP must contain a valid root config.json.'); }
  const upgraded = upgradeAddonPackage(config, files);
  const result = validatePackage(upgraded.config, upgraded.files); if (!result.valid) throw new Error(result.errors.join('\n'));
  return { config: upgraded.config, files: result.files };
}

export async function exportAddonZip(config, files) {
  const checked = validatePackage(config, files); if (!checked.valid) throw new Error(checked.errors.join('\n'));
  const local = []; const central = []; let offset = 0;
  for (const [path, content] of Object.entries(checked.files)) {
    const name = encoder.encode(`${config.id}/${path}`); const body = encoder.encode(content); const checksum = crc32(body);
    const header = new Uint8Array(30 + name.length); const h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(8, 0, true); h.setUint32(14, checksum, true); h.setUint32(18, body.length, true); h.setUint32(22, body.length, true); h.setUint16(26, name.length, true); header.set(name, 30); local.push(header, body);
    const record = new Uint8Array(46 + name.length); const c = new DataView(record.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(10, 0, true); c.setUint32(16, checksum, true); c.setUint32(20, body.length, true); c.setUint32(24, body.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true); record.set(name, 46); central.push(record); offset += header.length + body.length;
  }
  const centralSize = central.reduce((sum, row) => sum + row.length, 0); const end = new Uint8Array(22); const e = new DataView(end.buffer); e.setUint32(0, 0x06054b50, true); e.setUint16(8, central.length, true); e.setUint16(10, central.length, true); e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
  return new Blob([...local, ...central, end], { type: 'application/zip' });
}
function findSignature(view, signature, start) { for (let i = view.byteLength - 22; i >= start; i--) if (view.getUint32(i, true) === signature) return i; return -1; }
