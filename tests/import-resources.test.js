import {test} from 'node:test';import assert from 'node:assert/strict';
import {mergeImport} from '../src/import-resources.js';
const json=value=>new TextEncoder().encode(JSON.stringify(value));
const project=()=>new Map([['MS_RP/ui/server_form.json',json({namespace:'server_form',paper:{texture:'textures/ui/guji/paper_bg'},button:{texture:'textures/ui/guji/btn_normal'}})]]);
test('loose guji textures acquire their uniquely referenced resource-pack paths',()=>{
 const image=new Uint8Array([1,2,3]);const incoming=new Map([['guji/paper_bg.png',image],['guji/btn_normal.png',image]]);
 const result=mergeImport(project(),incoming);assert.equal(result.relocated.length,2);assert.equal(result.files.get('MS_RP/textures/ui/guji/paper_bg.png'),image);assert.equal(result.files.has('guji/paper_bg.png'),false);assert.equal(incoming.has('guji/paper_bg.png'),true);
});
test('manifest packs and ambiguous resource packs keep incoming paths',()=>{
 const incoming=new Map([['guji/paper_bg.png',new Uint8Array([1])],['manifest.json',json({})]]);assert.equal(mergeImport(project(),incoming).relocated.length,0);
 const p=project();p.set('Other/ui/main.json',json({namespace:'other',main:{}}));assert.equal(mergeImport(p,new Map([['guji/paper_bg.png',new Uint8Array([1])]])).relocated.length,0);
});
test('duplicate texture suffixes are reported rather than guessed',()=>{
 const p=project();p.set('MS_RP/ui/other.json',json({namespace:'other',main:{texture:'textures/blocks/guji/paper_bg'}}));
 const result=mergeImport(p,new Map([['guji/paper_bg.png',new Uint8Array([1])]]));assert.deepEqual(result.ambiguous,['guji/paper_bg.png']);assert.ok(result.files.has('guji/paper_bg.png'));
});
test('standalone UI dependency is placed into the single resource pack',()=>{
 const result=mergeImport(project(),new Map([['extra.json',json({namespace:'extra',main:{}})]]));assert.ok(result.files.has('MS_RP/ui/extra.json'));assert.equal(result.relocated.length,1);
});
