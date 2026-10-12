import { updateAddonSettings } from '../addons/install.js';

export function renderSettingsForm(addon, root) {
  root.replaceChildren();
  const env = addon.config.env ?? {};
  const entries = Object.entries(env).filter(([, schema]) => schema.visibility !== false);
  if (!entries.length) { root.innerHTML = '<p class="muted">This addon has no configurable settings.</p>'; return; }
  for (const [key, schema] of entries) {
    const label = document.createElement('label');
    label.className = 'setting-field';
    const title = document.createElement('span'); title.className = 'setting-label'; title.textContent = schema.displayName ?? schema.label ?? key;
    let input;
    if (schema.type === 'boolean') { input = document.createElement('input'); input.type = 'checkbox'; input.checked = Boolean(addon.settings[key]); }
    else if (schema.type === 'textarea' || schema.type === 'json') { input = document.createElement('textarea'); input.value = schema.type==='json'&&typeof addon.settings[key]==='object'?JSON.stringify(addon.settings[key],null,2):addon.settings[key] ?? ''; }
    else if (schema.type === 'select') { input = document.createElement('select'); for (const choice of schema.choices ?? []) { const option = document.createElement('option'); option.value = typeof choice === 'object' ? choice.value : choice; option.textContent = typeof choice === 'object' ? choice.label : choice; input.append(option); } input.value = addon.settings[key] ?? schema.default ?? ''; }
    else { input = document.createElement('input'); input.type = ({ number:'number',slider:'range',color:'color',url:'url',password:'password' })[schema.type] ?? 'text'; input.value = addon.settings[key] ?? schema.default ?? ''; if (schema.min != null) input.min = schema.min; if (schema.max != null) input.max = schema.max; if (schema.step != null) input.step = schema.step; if (schema.placeholder) input.placeholder = schema.placeholder; }
    input.dataset.setting = key;
    const info = schema.info ?? schema.description;
    label.append(title);
    if (info) { const help = document.createElement('small'); help.className = 'muted'; help.textContent = info; label.append(help); }
    if (schema.type === 'boolean') { const row = document.createElement('span'); row.className = 'switch-row'; row.append(input); label.append(row); }
    else { label.append(input); }
    root.append(label);
  }
  root.addEventListener('change', async event => {
    const input = event.target.closest('[data-setting]'); if (!input) return;
    let value = input.type === 'checkbox' ? input.checked : input.type === 'number' || input.type === 'range' ? Number(input.value) : input.value;
    if (input.tagName === 'TEXTAREA' && env[input.dataset.setting].type === 'json') { try { value = JSON.parse(input.value); } catch { input.setCustomValidity('Enter valid JSON.'); input.reportValidity(); return; } }
    input.setCustomValidity(''); await updateAddonSettings(addon.id, { [input.dataset.setting]: value });
  });
}
