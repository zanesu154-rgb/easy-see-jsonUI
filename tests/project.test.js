import {test} from 'node:test';import assert from 'node:assert/strict';import {screens,scriptForms} from '../src/project.js';
const files=entries=>new Map(entries.map(([k,v])=>[k,new TextEncoder().encode(v)]));
test('groups screen entries instead of files and excludes referenced templates',()=>{const p=screens(files([['RP/ui/a.json',JSON.stringify({namespace:'x',template:{type:'panel'},menu:{type:'screen',controls:[{'item@x.template':{}}]},other:{type:'screen',controls:[]}})]]));assert.deepEqual(p.entries.map(s=>s.node.name),['menu','other'])});
test('reads script forms without executing scripts and proposes title associations',()=>{const f=files([['BP/scripts/a.js',`const f = new ActionFormData(); f.title("Shop"); f.body("Welcome"); f.button("Buy"); f.show(player);`],['RP/ui/shop.json',JSON.stringify({namespace:'x',shop:{type:'screen',controls:[],bindings:[{binding_name:"(#title_text = 'Shop')"}]}})]]);const forms=scriptForms(f);assert.equal(forms[0].title,'Shop');assert.equal(forms[0].fields.length,3);assert.equal(screens(f).entries[0].links.length,1)});

test('inherited panel aliases stay in templates unless they have an interface entry signal',()=>{
 const aliases=Object.fromEntries(Array.from({length:9},(_,i)=>['tooltip_mid_'+i+'@x.tooltip_base',{}]));
 const p=screens(files([['RP/ui/a.json',JSON.stringify({namespace:'x',tooltip_base:{type:'panel',controls:[{background:{type:'image'}}]},...aliases,menu_screen:{type:'screen',controls:[]}})]]));
 assert.equal(p.entries.some(s=>s.node.name.startsWith('tooltip_mid_')),false);
 assert.equal(p.templates.filter(s=>s.node.name.startsWith('tooltip_mid_')).length,9);
 assert.ok(p.entries.some(s=>s.node.name==='menu_screen'));
});

test('title aliases still signal an interface for inherited panels without screen suffixes',()=>{
 const p=screens(files([['RP/ui/a.json',JSON.stringify({namespace:'x',base:{type:'panel',controls:[]},'lobby@x.base':{bindings:[{binding_name:'#title_text',binding_name_override:'#ttl'},{source_property_name:"(#ttl = 'Lobby')",target_property_name:'#visible'}]}})]]));
 assert.ok(p.entries.some(s=>s.node.name==='lobby@x.base'));
});
