import { getSupabase } from '../supabase/client.js';
import { validatePackage } from '../addons/validation.js';
import { addonSummary } from '../addons/metadata.js';
import { isMissingColumn } from '../supabase/schema-compat.js';

export async function saveRemoteDraft(config, files) {
  const checked = validatePackage(config, files);
  if (!checked.valid) throw new Error(checked.errors.join('\n'));
  const client = await getSupabase();
  if (!client) throw new Error('Supabase is not configured; the draft is saved only on this device.');
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error('Sign in to sync drafts to Supabase; the draft is saved only on this device.');
  const addonRow={ id:config.id, owner_id:user.id, title:config.title, description:addonSummary(config,checked.files), author_name:config.author.name, logo:config.logo, icon_path:config.logo?.type === 'svg' ? config.logo.path : null, updated_at:new Date().toISOString() };
  let { error: addonError } = await client.from('addons').upsert(addonRow, { onConflict:'id' });
  if(addonError&&isMissingColumn(addonError,'addons','logo')){const{logo,...legacyRow}=addonRow;({error:addonError}=await client.from('addons').upsert(legacyRow,{onConflict:'id'}));}
  if (addonError) throw addonError;
  const { data: previous, error: previousError } = await client.from('addons').select('draft_version_id').eq('id',config.id).maybeSingle();
  if(previousError)throw previousError;
  if(previous?.draft_version_id) { const {error}=await client.from('addon_versions').delete().eq('id',previous.draft_version_id);if(error)throw error; }
  const versionId=crypto.randomUUID();
  const {error:versionError}=await client.from('addon_versions').insert({id:versionId,addon_id:config.id,version:config.version,config,changelog:'',published:false});
  if(versionError)throw versionError;
  const {error:filesError}=await client.from('addon_files').insert(Object.entries(checked.files).map(([path,content])=>({version_id:versionId,path,content,mime_type:mimeType(path),byte_size:new TextEncoder().encode(content).length,sha256:null})));
  if(filesError)throw filesError;
  const {error:linkError}=await client.from('addons').update({draft_version_id:versionId}).eq('id',config.id);
  if(linkError)throw linkError;
  return versionId;
}
function mimeType(path){return({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.md':'text/markdown','.txt':'text/plain','.svg':'image/svg+xml'})[path.slice(path.lastIndexOf('.')).toLowerCase()]??'text/plain';}
