import {test} from 'node:test';import assert from 'node:assert/strict';
import {screens} from '../src/project.js';
import {navigationModel,routeForTitle,routeForSelection,titleSample,searchControls} from '../src/navigation.js';
const bytes=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value));
function fixture(){return new Map([
 ['RP/ui/server_form.json',bytes({namespace:'server_form',long_form:{type:'panel',controls:[{'normal@server_form.normal':{bindings:[{source_property_name:"((#title_text - 'MSQB:') = #title_text) and ((#title_text - 'Book') = #title_text)",target_property_name:'#visible'}]}},{'quest@quest.main':{}},{book:{type:'panel',bindings:[{binding_name:'#title_text',binding_name_override:'#alias'},{source_property_name:"(not ((#alias - 'Book') = #alias))",target_property_name:'#visible'}]}}]},normal:{type:'panel'}})],
 ['Other/ui/quest.json',bytes({namespace:'quest',main:{type:'panel',bindings:[{source_property_name:"(not ((#title_text - 'MSQB:') = #title_text))",target_property_name:'#visible'}],controls:[{icon:{type:'image',texture:'textures/items/kai_trial'}}]}})],
 ['BP/scripts/quest.js',bytes('const form = new ActionFormData();form.title(`MSQB:${key}|${name}`);form.button("Next");form.show(player);')],
 ['RP/ui/hud.json',bytes({namespace:'hud',hud_screen:{type:'screen',controls:[{label:{type:'label',text:'#hud_subtitle_text_string',bindings:[{source_property_name:"(#hud_subtitle_text_string - 'MSBOSS:')",target_property_name:'#text'}]}}]}})]
]);}
test('navigation recognises positive, fallback and title aliases, links cross-pack definitions and scripts',()=>{
 const files=fixture(),project=screens(files),model=navigationModel(files,project);
 assert.equal([...model.groups.keys()][0],'HUD');assert.ok(model.groups.has('表单（server_form）'));
 const quest=routeForTitle(model,'MSQB:kai|开阳');assert.equal(quest.node.name,'quest@quest.main');assert.equal(quest.definition.file,'Other/ui/quest.json');assert.equal(quest.links.length,1);
 assert.equal(quest.sample,'MSQB:');assert.equal(titleSample(quest.links[0]),'MSQB:示例|示例');
 assert.equal(routeForTitle(model,'Book').node.name,'book');assert.equal(routeForTitle(model,'Unknown').kind,'fallback');
 assert.equal(routeForSelection(model,quest.screen.file,quest.node),quest);assert.equal(routeForSelection(model,quest.screen.file,undefined),undefined);
 assert.equal(navigationModel(files,project),model);
});
test('purpose search covers texture paths, binding names, prefixes and full control paths',()=>{
 const files=fixture();
 for(const term of ['kai_trial','#hud_subtitle_text_string','MSBOSS:'])assert.ok(searchControls(files,term).total>0,term);
 const texture=searchControls(files,'textures/items/kai_trial');assert.ok(texture.results.some(r=>r.path.includes('icon')));assert.ok(texture.results.every(r=>r.path.includes('.json')));
 assert.equal(searchControls(files,'no-such-control').total,0);
});

test('search includes current resolved collection textures and generated instances',()=>{
 const files=fixture(),node={name:'factory_icon',id:'["long_form","controls",99,"factory_icon"]',path:['long_form','controls',99,'factory_icon']};
 const result=searchControls(files,'runtime-only-icon',{file:'RP/ui/server_form.json',runtime:new Map([[node.id,{texture:'textures/items/runtime-only-icon'}]]),sceneNodes:[node]});
 assert.equal(result.total,1);assert.equal(result.results[0].node.id,node.id);assert.match(result.results[0].path,/factory_icon/);
});

test('a child binding alias overrides the parent alias during route recognition',()=>{
 const files=fixture(),path='RP/ui/server_form.json',data=JSON.parse(new TextDecoder().decode(files.get(path)));
 data.long_form.bindings=[{binding_name:'#title_text',binding_name_override:'#alias'}];
 data.long_form.controls[2].book.bindings[0].binding_name='#body_text';files.set(path,bytes(data));
 const model=navigationModel(files,screens(files));assert.equal(model.routes.some(r=>r.node.name==='book'),false);
});

test('title conditions without literal samples remain inspectable complex routes',()=>{
 const files=fixture(),path='RP/ui/server_form.json',data=JSON.parse(new TextDecoder().decode(files.get(path)));
 data.long_form.controls.push({complex:{type:'panel',bindings:[{source_property_name:'(#title_text = #form_text)',target_property_name:'#visible'}]}});files.set(path,bytes(data));
 const model=navigationModel(files,screens(files)),route=model.routes.find(r=>r.node.name==='complex');
 assert.equal(route.kind,'complex');assert.equal(route.sample,undefined);
});

test('project and vanilla search indexes are isolated, lazy and never expand vanilla inheritance',t=>{
 const vanilla=new TextEncoder().encode(JSON.stringify({namespace:'vanilla',...Object.fromEntries(Array.from({length:22},(_,i)=>['m'+i,{type:'panel',controls:i<21?[{['left@vanilla.m'+(i+1)]:{}},{['right@vanilla.m'+(i+1)]:{}}]:[]}]))}));
 const files=new Map([['RP/ui/main.json',bytes({namespace:'custom',main:{type:'panel'}})],['__vanilla__/ui/massive.json',vanilla]]);
 let decoded=0;const decode=TextDecoder.prototype.decode;t.mock.method(TextDecoder.prototype,'decode',function(value,...args){if(value===vanilla)decoded++;return decode.call(this,value,...args);});
 const normal=searchControls(files,'m');assert.equal(decoded,0);assert.deepEqual(normal.indexed,{project:1,vanilla:0});assert.ok(normal.results.every(row=>!row.file.startsWith('__vanilla__/')));
 const all=searchControls(files,'m',{includeVanilla:true});assert.equal(decoded,1);assert.equal(all.indexed.vanilla,1);assert.ok(all.results.some(row=>row.file.startsWith('__vanilla__/')));assert.ok(all.total<100);
 searchControls(files,'main');searchControls(files,'left',{includeVanilla:true});assert.equal(decoded,1);
});

test('mounted screen definitions have one interface entry, reachable through their route',()=>{
 const files=fixture(),path='Other/ui/quest.json',quest=JSON.parse(new TextDecoder().decode(files.get(path)));quest.quest_screen=quest.main;delete quest.main;files.set(path,bytes(quest));
 const server=JSON.parse(new TextDecoder().decode(files.get('RP/ui/server_form.json')));server.long_form.controls[1]={'quest@quest.quest_screen':{}};files.set('RP/ui/server_form.json',bytes(server));
 const model=navigationModel(files,screens(files)),route=model.routes.find(r=>r.node.name==='quest@quest.quest_screen');assert.ok(route.definition);
 assert.equal([...model.groups.values()].flat().some(screen=>screen.id===route.definition.id),false);
 assert.ok(model.screens.some(screen=>screen.id===route.screen.id));
});

test('screen labels infer known vanilla namespaces without expanding them',async()=>{
 const {screenLabel}=await import('../src/navigation.js');
 assert.equal(screenLabel({namespace:'',file:'RP/ui/chat_screen.json',node:{name:'messages_text/text'}}),'chat · messages_text/text');
 assert.equal(screenLabel({namespace:'',file:'unknown.json',node:{name:'main'}}),'unknown.json · main');
});
