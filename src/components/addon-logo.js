export function renderAddonLogo(config = {}, files = {}, size = 40) {
  const logo = config.logo;
  if (logo?.type === 'svg' && typeof files[logo.path] === 'string') {
    return `<span class="addon-icon addon-logo" style="--logo-size:${size}px"><img alt="" src="data:image/svg+xml,${encodeURIComponent(files[logo.path])}"></span>`;
  }
  const requestedName = typeof logo?.name === 'string' ? logo.name : 'puzzle-piece';
  const phosphorName = requestedName.trim().replace(/^(ph-)+/i, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'puzzle-piece';
  const color = /^#[\da-fA-F]{6}$/.test(logo?.color ?? '') ? logo.color : '#3ecf8e';
  return `<span class="addon-icon addon-logo" style="--logo-size:${size}px;--logo-color:${color}"><i class="ph ph-${phosphorName}" aria-hidden="true"></i></span>`;
}
