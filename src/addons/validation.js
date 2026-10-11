const FILE_LIMIT = 2 * 1024 * 1024;
const ALLOWED = new Set(['.html', '.css', '.js', '.json', '.md', '.txt', '.svg']);
const PERMISSIONS = new Set(['contentScript', 'storage', 'settings', 'tabs', 'activeTab', 'clipboardRead', 'clipboardWrite']);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function normalizePath(path) {
  if (typeof path !== 'string' || !path.trim()) throw new Error('File path is required.');
  const clean = path.replaceAll('\\', '/').replace(/^\.\//, '');
  if (clean.startsWith('/') || clean.split('/').some(part => !part || part === '.' || part === '..')) throw new Error(`Unsafe file path: ${path}`);
  return clean;
}

export function validateSvg(source) {
  if (typeof source !== 'string' || !/<svg\b/i.test(source)) throw new Error('SVG asset does not contain an SVG root element.');
  if (/<\s*(script|foreignObject|iframe|object|embed)\b/i.test(source) || /\bon\w+\s*=/i.test(source) || /(?:href|src)\s*=\s*["']\s*(?!#)[^"']+/i.test(source) || /url\(\s*["']?\s*(?!#|data:image\/)[^)]+\)/i.test(source) || /<!DOCTYPE|<!ENTITY/i.test(source)) {
    throw new Error('SVG contains active or unsafe content.');
  }
  return true;
}

export function validateMatchPattern(pattern) {
  if (pattern === '<all_urls>') return true;
  return /^(https?|\*):\/\/[^/\s]+(?:\/[^\s]*)?$/.test(pattern) && !pattern.includes('..');
}

export function validateSettings(env = {}) {
  const errors = [];
  for (const [key, setting] of Object.entries(env)) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) errors.push(`Invalid setting key: ${key}`);
    if (!setting || typeof setting !== 'object' || !['boolean','string','textarea','number','slider','select','color','url','password','json'].includes(setting.type)) errors.push(`Setting “${key}” has an unsupported type.`);
    if (setting?.type === 'select' && (!Array.isArray(setting.choices) || !setting.choices.length)) errors.push(`Select setting “${key}” needs choices.`);
    if (setting?.min != null && setting?.max != null && Number(setting.min) > Number(setting.max)) errors.push(`Setting “${key}” has min greater than max.`);
  }
  return errors;
}

export function validatePackage(config, files) {
  const errors = [];
  if (!config || typeof config !== 'object') return { valid: false, errors: ['config.json must contain an object.'] };
  if (config.manifestVersion !== 1) errors.push('manifestVersion must be 1.');
  if (!ID_PATTERN.test(config.id ?? '')) errors.push('id must use lowercase letters, numbers, and hyphens.');
  if ((config.id ?? '').length > 64) errors.push('id must be 64 characters or fewer.');
  if (!config.title?.trim()) errors.push('title is required.');
  if (!VERSION_PATTERN.test(config.version ?? '')) errors.push('version must use semantic versioning (major.minor.patch).');
  if (!config.author?.name?.trim()) errors.push('author.name is required.');
  if (Object.hasOwn(config, 'docs')) errors.push('Addon documentation fields are no longer supported; use addon-description.md.');
  if (!Object.hasOwn(files ?? {}, 'addon-description.md') || !String(files['addon-description.md'] ?? '').trim()) errors.push('addon-description.md is required and cannot be empty.');
  const logo = config.logo;
  if (logo?.type === 'icon') {
    if (!/^#[\da-fA-F]{6}$/.test(logo.color ?? '')) errors.push('logo.color must be a 6-digit hex color.');
  } else if (logo?.type === 'svg') {
    if (typeof logo.path !== 'string' || !logo.path.toLowerCase().endsWith('.svg')) errors.push('logo.path must point to an SVG file.');
  } else errors.push('logo must be a Phosphor icon with a hex color or an SVG file.');
  if (!Array.isArray(config.permissions)) errors.push('permissions must be an array.');
  else for (const permission of config.permissions) if (!PERMISSIONS.has(permission)) errors.push(`Unknown permission: ${permission}`);
  if (!Array.isArray(config.contentScripts ?? [])) errors.push('contentScripts must be an array.');
  if ((config.contentScripts?.length ?? 0) && !config.permissions?.includes('contentScript')) errors.push('Declare the contentScript permission when content scripts are configured.');
  errors.push(...validateSettings(config.env));
  const normalized = {};
  for (const [originalPath, contents] of Object.entries(files ?? {})) {
    try {
      const path = normalizePath(originalPath);
      if (Object.hasOwn(normalized, path)) errors.push(`Duplicate file path: ${path}`);
      const ext = path.includes('.') ? path.slice(path.lastIndexOf('.')).toLowerCase() : '';
      if (!ALLOWED.has(ext)) errors.push(`Unsupported file extension: ${path}`);
      const size = new TextEncoder().encode(String(contents)).byteLength;
      if (size > FILE_LIMIT) errors.push(`${path} exceeds the 2 MB file limit.`);
      if (ext === '.svg') try { validateSvg(String(contents)); } catch (error) { errors.push(`${path}: ${error.message}`); }
      normalized[path] = String(contents);
    } catch (error) { errors.push(error.message); }
  }
  if (!normalized['config.json']) errors.push('Missing config.json.');
  else {
    try {
      const fileConfig = JSON.parse(normalized['config.json']);
      if (!fileConfig || typeof fileConfig !== 'object' || Array.isArray(fileConfig)) errors.push('config.json must contain an object.');
      else if (fileConfig.id !== config.id) errors.push('config.json ID does not match the package ID.');
    } catch (error) { errors.push(`config.json is not valid JSON: ${error.message}`); }
  }
  if (logo?.type === 'svg' && logo.path && !normalized[logo.path]) errors.push(`Logo SVG file not found: ${logo.path}`);
  for (const [index, declaration] of (Array.isArray(config.contentScripts) ? config.contentScripts : []).entries()) {
    if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration)) { errors.push(`Content script ${index + 1} must be an object.`); continue; }
    if (!Array.isArray(declaration.matches) || !declaration.matches.length) errors.push(`Content script ${index + 1} needs URL matches.`);
    for (const pattern of declaration.matches ?? []) if (!validateMatchPattern(pattern)) errors.push(`Invalid URL match pattern: ${pattern}`);
    if (!Array.isArray(declaration.js) && !Array.isArray(declaration.css)) errors.push(`Content script ${index + 1} needs a JS or CSS entry point.`);
    if (declaration.js != null && !Array.isArray(declaration.js)) errors.push(`Content script ${index + 1} js must be an array.`);
    if (declaration.css != null && !Array.isArray(declaration.css)) errors.push(`Content script ${index + 1} css must be an array.`);
    for (const entry of [...(declaration.js ?? []), ...(declaration.css ?? [])]) if (!normalized[entry]) errors.push(`Declared entry-point file not found: ${entry}`);
    if (declaration.runAt && !['document_start','document_end','document_idle'].includes(declaration.runAt)) errors.push(`Invalid runAt value: ${declaration.runAt}`);
  }
  return { valid: errors.length === 0, errors, files: normalized };
}

export function defaultSettings(config, previous = {}) {
  const next = {};
  for (const [key, schema] of Object.entries(config.env ?? {})) next[key] = Object.hasOwn(previous, key) ? previous[key] : schema.default ?? (schema.type === 'boolean' ? false : '');
  return next;
}

export function matchesUrl(pattern, url) {
  if (pattern === '<all_urls>') return /^(https?|file|ftp):/.test(url);
  const match = pattern.match(/^(https?|\*):\/\/([^/]+)(\/.*)?$/);
  if (!match) return false;
  const target = new URL(url);
  const scheme = match[1] === '*' ? ['http:', 'https:'].includes(target.protocol) : `${match[1]}:` === target.protocol;
  const host = match[2] === '*' || match[2].startsWith('*.') ? target.hostname === match[2].slice(2) || target.hostname.endsWith(`.${match[2].slice(2)}`) : target.hostname === match[2];
  const path = (match[3] ?? '/*').replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*');
  return scheme && host && new RegExp(`^${path}$`).test(target.pathname + target.search + target.hash);
}
