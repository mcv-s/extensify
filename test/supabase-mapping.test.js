import test from 'node:test';
import assert from 'node:assert/strict';
import { mapAddonFileRows, mapPublishedAddon } from '../src/supabase/mapping.js';

test('file rows map without changing readable source contents',()=>{
  assert.deepEqual(mapAddonFileRows([{path:'content.js',content:'// keep source formatting\nconsole.log(1);'}]),{'content.js':'// keep source formatting\nconsole.log(1);'});
  assert.throws(()=>mapAddonFileRows([{path:'a.js',content:''},{path:'a.js',content:''}]),/Duplicate Supabase addon path/);
});

test('catalog listing mapping returns only the expected summary fields',()=>{
  assert.deepEqual(mapPublishedAddon({id:'sample',title:'Sample',description:'Text',owner_id:'private',author_name:'Creator'}),{id:'sample',title:'Sample',description:'Text',author_name:'Creator',logo:null,icon_path:null,current_version_id:null,updated_at:null});
  assert.throws(()=>mapPublishedAddon({id:'bad'}),/malformed/);
});
