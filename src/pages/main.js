import { renderShell, icon, toast } from '../components/shell.js';
import { getState } from '../storage/state.js';
import { renderAddonLogo } from '../components/addon-logo.js';
import { addonSummary } from '../addons/metadata.js';

const state = await getState();
let userscriptsEnabled = await checkUserscriptsEnabled();
const enabled = Object.values(state.addons).filter(addon => addon.enabled);
await renderShell({
  active: 'home', title: 'Home', subtitle: 'Your small tools, all in one place.', content: `
  ${userscriptsEnabled ? '' : userscriptsStatusMarkup(false)}
  <section class="hero-banner"><div class="hero-copy"><span class="hero-label">YOUR BROWSER, YOUR WAY</span><h2>A little more useful.<br>A little more yours.</h2><p>Discover thoughtful addons and shape the web around the way you work.</p><a class="button primary liquid-button" href="explorer.html">${icon('compass')} Explore addons</a></div><div class="hero-orbit"><div class="orbit-ring ring-one"></div><div class="orbit-ring ring-two"></div><div class="orbit-node node-a">${icon('cursor-click', 20)}</div><div class="orbit-node node-b">${icon('sparkle', 20)}</div><div class="orbit-center"><img src="logo.svg" alt="Extensify"></div></div></section>
  <div class="stats-row"><div class="stat-card card"><span>Installed addons</span><strong>${Object.keys(state.addons).length.toString().padStart(2, '0')}</strong><small>Your personal toolkit</small></div><div class="stat-card card"><span>Currently enabled</span><strong>${enabled.length.toString().padStart(2, '0')}</strong><small>Ready on matching sites</small></div><div class="stat-card card"><span>Workspace</span><strong>Local</strong><small>Private by default</small></div></div>
  <div class="section-heading"><h2 class="section-title">Installed addons</h2><a class="text-link" href="installed.html">View all ${icon('arrow-right', 14)}</a></div>
  ${Object.keys(state.addons).length ? `<div class="addon-grid">${Object.values(state.addons).slice(0, 3).map(addon => `<a class="addon-card card" href="addon.html?id=${encodeURIComponent(addon.id)}"><div class="addon-card-top">${renderAddonLogo(addon.config, addon.files, 40)}<div><h3>${escapeHtml(addon.config.title)}</h3><p>${escapeHtml(addonSummary(addon.config, addon.files))}</p></div></div><div class="card-bottom"><span class="badge ${addon.enabled ? 'green' : ''}">${addon.enabled ? 'Enabled' : 'Disabled'}</span><span class="muted mono">v${escapeHtml(addon.version)}</span></div></a>`).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">${icon('puzzle-piece', 20)}</div><h3>Your toolkit starts here</h3><p>Browse addons or create your own in the editor. Installed addons stay on this device.</p><a class="button primary" href="explorer.html">Browse Explorer</a> <a class="button" href="editor.html">Open editor</a></div>`}
  <div id="installed" class="section-heading"><h2 class="section-title">Quick access</h2></div><div class="quick-links"><a class="quick-link card" href="editor.html">${icon('code', 20)}<span><b>Build an addon</b><small>Start with a ready-to-edit template</small></span>${icon('arrow-up-right', 15)}</a><a class="quick-link card" href="settings.html">${icon('gear', 20)}<span><b>Personalize Extensify</b><small>Theme, account, and local data</small></span>${icon('arrow-up-right', 15)}</a></div>`
});
document.addEventListener('click', event => {
  if (!event.target.closest('#open-userscript-settings')) return;
  const prefix = /Edg\//.test(navigator.userAgent) ? 'edge' : 'chrome';
  chrome.tabs.create({ url: `${prefix}://extensions/?id=${chrome.runtime.id}` });
});
window.addEventListener('focus', refreshUserscriptsStatus);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshUserscriptsStatus();
});
async function checkUserscriptsEnabled() {
  try {
    if (!globalThis.chrome?.userScripts?.getScripts) return false;
    await chrome.userScripts.getScripts();
    return true;
  } catch {
    return false;
  }
}
async function refreshUserscriptsStatus() {
  const isEnabled = await checkUserscriptsEnabled();
  if (isEnabled === userscriptsEnabled) return;
  const justEnabled = !userscriptsEnabled && isEnabled;
  userscriptsEnabled = isEnabled;
  renderUserscriptsStatus(isEnabled, justEnabled);
}
function renderUserscriptsStatus(isEnabled, animate = false) {
  const banner = document.querySelector('#userscripts-status');
  if (!banner && isEnabled) return;
  if (!banner) {
    document.querySelector('.hero-banner')?.insertAdjacentHTML('beforebegin', userscriptsStatusMarkup(false));
    return;
  }
  if (animate) {
    const startHeight = banner.getBoundingClientRect().height;
    const outgoing = document.createElement('div');
    outgoing.className = 'userscripts-status-outgoing';
    while (banner.firstChild) outgoing.append(banner.firstChild);
    banner.append(outgoing);
    const incoming = document.createElement('div');
    incoming.className = 'userscripts-status-incoming';
    incoming.innerHTML = userscriptsStatusContent(true);
    banner.style.height = `${startHeight}px`;
    banner.append(incoming);
    banner.classList.add('is-transitioning');
    banner.classList.add('is-enabled');
    const styles = getComputedStyle(banner);
    const targetHeight = incoming.getBoundingClientRect().height
      + parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom)
      + parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
    requestAnimationFrame(() => {
      banner.style.height = `${targetHeight}px`;
      incoming.classList.add('is-visible');
    });
    setTimeout(() => {
      if (!banner.isConnected) return;
      banner.innerHTML = userscriptsStatusContent(true);
      banner.classList.remove('is-transitioning');
      banner.style.height = '';
    }, 350);
    return;
  }
  banner.classList.toggle('is-enabled', isEnabled);
  banner.innerHTML = userscriptsStatusContent(isEnabled);
}
function userscriptsStatusMarkup(isEnabled) {
  return `<section class="userscripts-warning${isEnabled ? ' is-enabled' : ''}" id="userscripts-status" aria-live="polite">${userscriptsStatusContent(isEnabled)}</section>`;
}
function userscriptsStatusContent(isEnabled) {
  if (isEnabled) {
    return `<span class="userscripts-warning-icon">${icon('check-circle', 24)}</span><div class="userscripts-warning-copy"><h2>Userscripts are enabled!</h2><p>Extensify can now run userscripts for enabled addons on their matching websites. Scripts are browser-specific and are provided with addon packages, not bundled into Extensify.</p></div>`;
  }
  return `<span class="userscripts-warning-icon">${icon('warning', 24)}</span><div class="userscripts-warning-copy"><h2>Allow User Scripts to run addons</h2><p>Extensify addons may include <strong>userscripts</strong>—code that runs inside your browser on matching websites to add features. These scripts are browser-specific, are provided with addon packages rather than bundled into Extensify itself, and do not carry over to other browsers. They are off by default. Enable <strong>Allow User Scripts</strong> in Extensify’s browser settings to run them.</p><button type="button" class="button userscripts-warning-action" id="open-userscript-settings">${icon('arrow-square-out', 16)} Open extension settings</button></div>`;
}
function escapeHtml(text = '') { return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
if (location.hash === '#installed') setTimeout(() => document.querySelector('#installed')?.scrollIntoView({ behavior: 'smooth' }), 50);
