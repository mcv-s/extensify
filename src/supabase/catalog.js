import { getSupabase } from './client.js';
import { mapAddonFileRows, mapPublishedAddon } from './mapping.js';
import { isMissingColumn } from './schema-compat.js';

export async function listPublishedAddons(search = '') {
  const client = await getSupabase();
  if (!client) return [];
  return readPublishedAddonRows(client, search);
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
  const needsLogo = rows.filter(row => (!row.logo || (row.logo.type === 'icon' && row.logo.name === 'PuzzlePiece' && row.logo.color === '#3ecf8e')) && row.current_version_id);
  if (needsLogo.length) {
    const { data: versions, error: versionError } = await client.from('addon_versions').select('id,config').in('id', needsLogo.map(row => row.current_version_id));
    if (versionError) throw versionError;
    const logos = new Map((versions ?? []).map(version => [version.id, version.config?.logo ?? null]));
    for (const row of needsLogo) row.logo = logos.get(row.current_version_id) ?? null;
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
