const MIME_TYPES = {
  '.css':'text/css;charset=utf-8',
  '.html':'text/html;charset=utf-8',
  '.js':'text/javascript;charset=utf-8',
  '.json':'application/json;charset=utf-8',
  '.md':'text/markdown;charset=utf-8',
  '.svg':'image/svg+xml;charset=utf-8',
  '.txt':'text/plain;charset=utf-8'
};

export function resolveAddonResource(reference, fromPath = '') {
  if (typeof reference !== 'string' || !reference.trim()) return null;
  const value = reference.trim();
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return null;
  let path = value.split(/[?#]/, 1)[0];
  try { path = decodeURIComponent(path); } catch { return null; }
  path = path.replaceAll('\\', '/');
  const parts = path.startsWith('/') ? [] : fromPath.replaceAll('\\', '/').split('/').slice(0, -1).filter(Boolean);
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.length ? parts.join('/') : null;
}

function mimeType(path) {
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase();
  return MIME_TYPES[extension] ?? 'application/octet-stream';
}

function asDataUrl(path, contents) {
  return `data:${mimeType(path)},${encodeURIComponent(contents)}`;
}

export function bundleAddonCss(files, cssPaths) {
  const expanding = new Set();
  const expand = path => {
    const source = files[path];
    if (typeof source !== 'string' || expanding.has(path)) return '';
    expanding.add(path);
    let result = source.replace(/@import\s+(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^\s)'";]+))\s*\)?\s*([^;]*);/gi, (whole, doubleQuoted, singleQuoted, bare, media = '') => {
      const reference = doubleQuoted ?? singleQuoted ?? bare;
      const importedPath = resolveAddonResource(reference, path);
      if (!importedPath || !Object.hasOwn(files, importedPath) || !importedPath.toLowerCase().endsWith('.css')) return whole;
      const imported = expand(importedPath);
      return media.trim() ? `@media ${media.trim()} {\n${imported}\n}` : imported;
    });
    result = result.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi, (whole, doubleQuoted, singleQuoted, bare) => {
      const reference = (doubleQuoted ?? singleQuoted ?? bare ?? '').trim();
      const assetPath = resolveAddonResource(reference, path);
      if (!assetPath || !Object.hasOwn(files, assetPath)) return whole;
      return `url("${asDataUrl(assetPath, String(files[assetPath]))}")`;
    });
    expanding.delete(path);
    return result;
  };
  return cssPaths.map(path => expand(path)).filter(Boolean).join('\n');
}

export function addonResourceMimeTypes() { return MIME_TYPES; }
