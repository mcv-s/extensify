import { getSupabase, supabaseRequest } from './client.js';
import { mapAddonFileRows, mapPublishedAddon } from './mapping.js';
import { isMissingColumn } from './schema-compat.js';

export async function listPublishedAddons(search = '') {
  const client = await getSupabase();
  if (!client) return [];
  return readPublishedAddonRows(client, search);
}

export async function getPublishedCatalogStats() {
  const client = await getSupabase();
  if (!client) return null;
  return readPublishedCatalogStats(client);
}

export async function pruneSupersededAddonVersions() {
  const result = await supabaseRequest('rpc/prune_superseded_addon_versions', { method: 'POST', body: {} });
  const summary = Array.isArray(result) ? result[0] : result;
  if (!summary) throw new Error('Supabase did not return cleanup results.');
  return {
    addonsProcessed: Number(summary.addons_processed || 0),
    versionsDeleted: Number(summary.versions_deleted || 0),
    fileBytesDeleted: Number(summary.file_bytes_deleted || 0)
  };
}

export async function readPublishedCatalogStats(client) {
  const addons = await readAllRows(client.from('addons').select('id,current_version_id').eq('published', true).order('id'));
  const versionIds = [...new Set(addons.map(addon => addon.current_version_id).filter(Boolean))];
  let totalBytes = 0;
  for (let index = 0; index < versionIds.length; index += 100) {
    const batch = versionIds.slice(index, index + 100);
    const files = await readAllRows(client.from('addon_files').select('byte_size').in('version_id', batch));
    totalBytes += files.reduce((total, file) => total + Number(file.byte_size || 0), 0);
  }
  return { addonCount: addons.length, totalBytes };
}

async function readAllRows(query) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await query.range(offset, offset + 999);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

export async function readPublishedAddonRows(client, search = '') {
  const request = columns => {
    let query = client.from('addons').select(columns).eq('published', true).order('title').limit(100);
    if (search.trim()) query = query.ilike('title', `%${search.trim().replaceAll('%','\\%')}%`);
    return query;
  };
  let { data, error } = await request('id,title,description,author_name,logo,icon_path,current_version_id,updated_at');
  if (error && isMissingColumn(error,'addons','logo')) ({ data, error } = await request('id,title,description,author_name,icon_path,current_version_id,updated_at'));
  if (error) throw error;
  const rows = data ?? [];
  const needsVersionConfig = rows.filter(row => row.current_version_id);
  if (needsVersionConfig.length) {
    const { data: versions, error: versionError } = await client.from('addon_versions').select('id,config').in('id', needsVersionConfig.map(row => row.current_version_id));
    if (versionError) throw versionError;
    const logos = new Map((versions ?? []).map(version => [version.id, version.config?.logo ?? null]));
    const shortDescriptions = new Map((versions ?? []).map(version => [version.id, version.config?.['short-description']]));
    for (const row of needsVersionConfig) {
      if (!row.logo || (row.logo.type === 'icon' && row.logo.name === 'PuzzlePiece' && row.logo.color === '#3ecf8e')) row.logo = logos.get(row.current_version_id) ?? null;
      if (typeof shortDescriptions.get(row.current_version_id) === 'string' && shortDescriptions.get(row.current_version_id).trim()) row.description = shortDescriptions.get(row.current_version_id).trim();
    }
  }
  return rows.map(mapPublishedAddon);
}

export async function fetchAddonPackage(id) {
  const client = await getSupabase();
  if (!client) throw new Error('Add Supabase project details to supabase.json to connect the addon catalog.');
  // The version config contains the logo; avoid requiring the optional listing column here.
  const { data: addon, error: addonError } = await client.from('addons').select('id,title,description,author_name,icon_path,current_version_id,published').eq('id', id).maybeSingle();
  if (addonError) throw addonError;
  if (!addon) throw new Error('This addon is not available in the Supabase catalog.');
  if (!addon.current_version_id) throw new Error('This addon does not have a published version yet.');
  const { data: version, error: versionError } = await client.from('addon_versions').select('id,version,config,changelog,created_at').eq('id', addon.current_version_id).maybeSingle();
  if (versionError) throw versionError;
  if (!version) throw new Error('The published addon version is missing from Supabase.');
  const { data: files, error: filesError } = await client.from('addon_files').select('path,content,mime_type,byte_size,sha256').eq('version_id', version.id).order('path');
  if (filesError) throw filesError;
  return { addon: mapPublishedAddon(addon), version, config: version.config, files: mapAddonFileRows(files) };
}
