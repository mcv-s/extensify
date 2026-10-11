import { getSupabase } from '../supabase/client.js';
import { validatePackage } from '../addons/validation.js';
import { addonSummary } from '../addons/metadata.js';
import { isMissingColumn } from '../supabase/schema-compat.js';

export async function publishAddon(config, files, changelog = '') {
  const check = validatePackage(config, files);
  if (!check.valid) throw new Error(check.errors.join('\n'));
  const client = await getSupabase();
  if (!client) throw new Error('Configure Supabase in supabase.json first.');
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) throw new Error('Sign in before publishing an addon.');
  const addonRow = { id: config.id, owner_id: user.id, title: config.title, description: addonSummary(config, check.files), author_name: config.author.name, logo: config.logo, icon_path: config.logo?.type === 'svg' ? config.logo.path : null, updated_at: new Date().toISOString() };
  let { error: addonError } = await client.from('addons').upsert(addonRow, { onConflict: 'id' });
  if (addonError && isMissingColumn(addonError,'addons','logo')) {
    const { logo, ...legacyRow } = addonRow;
    ({ error: addonError } = await client.from('addons').upsert(legacyRow, { onConflict: 'id' }));
  }
  if (addonError) throw addonError;
  const versionId = crypto.randomUUID();
  const { error: versionError } = await client.from('addon_versions').insert({ id: versionId, addon_id: config.id, version: config.version, config, changelog, published: true });
  if (versionError) throw versionError;
  const rows = Object.entries(check.files).map(([path, content]) => ({ version_id: versionId, path, content, mime_type: mimeType(path), byte_size: new TextEncoder().encode(content).length, sha256: null }));
  const { error: filesError } = await client.from('addon_files').insert(rows);
  if (filesError) throw filesError;
  const { error: publishError } = await client.from('addon_versions').update({ published: true }).eq('id', versionId);
  if (publishError) throw publishError;
  const { error: currentError } = await client.from('addons').update({ current_version_id: versionId, published: true }).eq('id', config.id);
  if (currentError) throw currentError;
  return versionId;
}

function mimeType(path) { return ({ '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.md':'text/markdown', '.txt':'text/plain', '.svg':'image/svg+xml' })[path.slice(path.lastIndexOf('.')).toLowerCase()] ?? 'text/plain'; }
