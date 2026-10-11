import test from 'node:test';
import assert from 'node:assert/strict';
import { readPublishedAddonRows } from '../src/supabase/catalog.js';
import { isMissingColumn } from '../src/supabase/schema-compat.js';
import { RestQuery } from '../src/supabase/client.js';

test('catalog listing retries without optional logo column on older Supabase schemas', async () => {
  const selections=[];
  const client={from:()=>({
    select(columns){ selections.push(columns); return this; },
    eq(){ return this; }, order(){ return this; }, limit(){ return this; }, ilike(){ return this; },
    then(resolve){
      if(selections.length===1)return Promise.resolve({data:null,error:new Error('column addons.logo does not exist')}).then(resolve);
      return Promise.resolve({data:[{id:'sample-addon',title:'Sample',description:'Description',author_name:'Creator'}],error:null}).then(resolve);
    }
  })};
  const rows=await readPublishedAddonRows(client);
  assert.equal(selections.length,2);
  assert.match(selections[0],/logo/);
  assert.doesNotMatch(selections[1],/logo/);
  assert.equal(rows[0].id,'sample-addon');
  assert.equal(rows[0].logo,null);
});

test('Supabase schema cache column errors are recognized for compatibility writes', () => {
  assert.equal(isMissingColumn(new Error("Could not find the 'logo' column of 'addons' in the schema cache"),'addons','logo'),true);
  assert.equal(isMissingColumn(new Error('permission denied for table addons'),'addons','logo'),false);
});

test('catalog fills missing or default logo metadata from published version config', async () => {
  const client={from(table){
    if(table==='addons')return{select(){return this},eq(){return this},order(){return this},limit(){return Promise.resolve({data:[{id:'sample-addon',title:'Sample',description:'Long description',author_name:'Creator',logo:{type:'icon',name:'PuzzlePiece',color:'#3ecf8e'},current_version_id:'version-1'}],error:null})}};
    return{select(){return this},in(){return Promise.resolve({data:[{id:'version-1',config:{logo:{type:'icon',name:'Sparkle',color:'#b045ee'}}}],error:null})}};
  }};
  const rows=await readPublishedAddonRows(client);
  assert.deepEqual(rows[0].logo,{type:'icon',name:'Sparkle',color:'#b045ee'});
});

test('REST query supports PostgREST in filters used for logo hydration', async () => {
  const originalFetch=globalThis.fetch;
  let requestedUrl='';
  globalThis.fetch=async url=>{requestedUrl=String(url);return{ok:true,text:async()=> '[]'};};
  try {
    await new RestQuery({url:'https://example.supabase.co',anonKey:'public-key'},'addon_versions').select('id,config').in('id',['version-1','version-2']);
    assert.match(decodeURIComponent(requestedUrl),/id=in\.\("version-1","version-2"\)/);
  } finally { globalThis.fetch=originalFetch; }
});
