export function addonDescription(config, files = {}) {
  return String(files['addon-description.md'] ?? config?.description ?? '');
}

export function addonSummary(config, files = {}, maxLength = 180) {
  const text = addonDescription(config, files)
    .replace(/^```[\s\S]*?```/gm, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~>#]/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

export function upgradeAddonPackage(config, files = {}) {
  const upgradedConfig = structuredClone(config ?? {});
  const upgradedFiles = { ...files };
  if (!upgradedFiles['addon-description.md']) {
    const previous = String(upgradedConfig.description ?? '').trim();
    upgradedFiles['addon-description.md'] = previous || `# ${upgradedConfig.title || 'Addon'}\n\nDescribe what this addon does.`;
  }
  if (!upgradedConfig.logo) {
    upgradedConfig.logo = { type: 'icon', name: 'PuzzlePiece', color: '#3ecf8e' };
  }
  for (const path of Object.keys(upgradedFiles)) if (/^readme\.md$/i.test(path)) delete upgradedFiles[path];
  delete upgradedConfig.description;
  delete upgradedConfig.icon;
  delete upgradedConfig.docs;
  upgradedFiles['config.json'] = JSON.stringify(upgradedConfig, null, 2);
  return { config: upgradedConfig, files: upgradedFiles };
}
