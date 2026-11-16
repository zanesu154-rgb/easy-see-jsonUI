import {test} from 'node:test';import assert from 'node:assert/strict';
import {resolveScene,resolveProject} from '../src/resolver.js';import {nodes} from '../src/core.js';
import {instantiateCollections} from '../src/collections.js';import {layoutScene} from '../src/layout.js';
import {inferChannels,composeChannel,fieldValues,binaryFill,stateMatrix,texturePatterns} from '../src/simulation-tools.js';
import {Presets,validateSimulation} from '../src/presets.js';import {controlBudget} from '../src/control-budget.js';import {physicalFiles} from '../src/physical-files.js';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
function containerFixture(){return new Map([
 ['RP/ui/chest_screen.json',bytes({namespace:'chest',small_chest_screen:{'$temp_container_title|default':'$container_title',modifications:[{array_name:'variables',operation:'insert_back',value:[{requires:"($temp_container_title = '§r§1§r')",'$container_title':'灵海戒'},{requires:"($temp_container_title = '§r§2§r')",'$screen_content':'ring.panel'},{requires:"(($temp_container_title = '§r§2§r') and ($pocket_edition or $pocket_screen))",'$screen_content':'ring.panel_m'}]}]}})],
 ['RP/ui/ring.json',bytes({namespace:'ring',panel:{type:'panel',size:[162,162],controls:[{grid:{type:'grid',size:['100%','100%'],grid_dimensions:[9,9],grid_item_template:'chest.item',collection_name:'container_items'}}]},panel_m:{type:'panel',size:[180,180]}})],
 ['__vanilla__/ui/chest_screen.json',bytes({namespace:'chest',small_chest_screen:{type:'screen','$screen_content|default':'chest.normal',controls:[{'content@$screen_content':{}}]},normal:{type:'panel'},item:{type:'button',size:['100%','100%']}})]
]);}
test('container requires keeps original titles, applies modifications in order and chooses pocket content before inheritance',()=>{
 const files=containerFixture(),original=files.get('RP/ui/chest_screen.json');
 const desktop=resolveScene(files,'RP/ui/chest_screen.json',{containerTitle:'§r§2§r'},'small_chest_screen');
 const mobile=resolveScene(files,'RP/ui/chest_screen.json',{containerTitle:'§r§2§r',touch:true},'small_chest_screen');
 assert.equal(desktop.data.small_chest_screen.$screen_content,'ring.panel');assert.equal(mobile.data.small_chest_screen.$screen_content,'ring.panel_m');
 assert.ok(nodes(desktop.data).some(n=>n.name==='grid'));assert.equal(nodes(mobile.data).some(n=>n.name==='grid'),false);
 const renamed=resolveScene(files,'RP/ui/chest_screen.json',{containerTitle:'§r§1§r'},'small_chest_screen').data.small_chest_screen;
 assert.equal(renamed.$container_title,'灵海戒');assert.equal(renamed.$temp_container_title,'§r§1§r');assert.equal(renamed.$screen_content,'chest.normal');
 assert.equal(files.get('RP/ui/chest_screen.json'),original);assert.ok(resolveProject(files,'RP/ui/chest_screen.json').data.small_chest_screen.modifications);
});
test('container grid creates all slots independently of item data and places nine columns without form button bounds',()=>{
 const files=containerFixture(),sim={containerTitle:'§r§2§r',containerItems:[{name:'钻石',texture:'textures/items/diamond',count:12}]},resolved=resolveScene(files,'RP/ui/chest_screen.json',sim,'small_chest_screen');
 const result=instantiateCollections(resolved.data,files,'RP/ui/chest_screen.json',sim),ns=nodes(result.data),scene=layoutScene(ns,'["small_chest_screen"]',{width:162,height:162,simulation:sim});
 const slots=ns.filter(n=>n.obj._containerSlot);assert.equal(slots.length,81);assert.equal(result.gridCreated,81);
 const first=scene.rects.get(slots[0].id),next=scene.rects.get(slots[1].id),row=scene.rects.get(slots[9].id);assert.equal(next.x-first.x,18);assert.equal(row.y-first.y,18);
 assert.equal(scene.runtime.get(slots[0].id)._containerItem.count,12);assert.equal(scene.runtime.get(slots[80].id)._collectionMissing,false);assert.equal(scene.runtime.get(slots[0].id)._collectionIndex,undefined);
});
test('field inference combines a 48-character binary run and preserves stage and tail',()=>{
 const obj={bindings:[{source_property_name:"(('%.7s' * #hud_subtitle_text_string) = 'MSBOSS:')"},...Array.from({length:48},(_,i)=>({source_property_name:`(('%.${i+9}s' * #hud_subtitle_text_string) = (('%.${i+8}s' * #hud_subtitle_text_string) + '1'))`})),{source_property_name:"(#hud_subtitle_text_string - ('%.56s' * #hud_subtitle_text_string))"}]};
 const schema=inferChannels(obj)[0],field=schema.fields.find(f=>f.kind==='binary');assert.equal(field.end-field.start,48);
 const result=composeChannel(schema,['7',binaryFill(48,50),'首领']);assert.equal(result,'MSBOSS:7'+'1'.repeat(24)+'0'.repeat(24)+'首领');assert.equal(binaryFill(48,100),'1'.repeat(48));assert.equal(fieldValues(schema,result).at(-1),'首领');
});
test('ordered binding aliases infer toast path fields and automatic dollar padding',()=>{
 const obj={bindings:[{source_property_name:"(('%.6s' * #text) = 'toast.')"},{source_property_name:"(#text - 'toast.')",target_property_name:'#rest'},{source_property_name:"('%.150s' * #rest)",target_property_name:'#icon_field'},{source_property_name:"(#icon_field - '$')",target_property_name:'#icon'},{source_property_name:"(('%.200s' * #rest) - #icon_field)",target_property_name:'#bg_field'},{source_property_name:"(#bg_field - '$')",target_property_name:'#bg'}]};
 const schema=inferChannels(obj)[0];assert.deepEqual(schema.fields.map(f=>f.end-f.start),[150,50,Infinity]);
 const value=composeChannel(schema,['textures/icon','textures/bg','标题']);assert.equal(value,'toast.'+'textures/icon'.padEnd(150,'$')+'textures/bg'.padEnd(50,'$')+'标题');
 assert.throws(()=>composeChannel(schema,['x'.repeat(151),'','']),/最多 150/);
});
test('texture matrices enumerate independent states and detect a missing combination',()=>{
 const obj={bindings:[{source_property_name:"('textures/ui/n_' + ('%.3s' * #form_button_text))",target_property_name:'#texture'}]},files=new Map(['QCA','QCD','QTA'].map(code=>['RP/textures/ui/n_'+code+'.png',new Uint8Array()]));
 const pattern=texturePatterns(obj,files)[0],matrix=stateMatrix(pattern,files,'RP/ui/a.json');assert.equal(matrix.states.length,4);assert.equal(matrix.states.find(s=>s.value==='QTD').resource.status,'missing');
});
test('named presets round trip multiple scenes, retain raw format codes and validate imported data',()=>{
 const presets=new Presets();presets.save('RP/ui/chest_screen.json::container','手机储物戒',{containerTitle:'§r§2§r',touch:true,containerItems:[{name:'钻石',texture:'textures/items/diamond',count:12}]});presets.save('RP/ui/a.json::["main"]','开阳页',{formButtons:[{text:'QCD02节点',texture:'textures/items/kai_trial'}]});
 const next=new Presets();next.load(presets.text());assert.equal(next.entries.length,2);assert.equal(next.entries[0].data.containerTitle,'§r§2§r');assert.equal(next.entries[1].data.formButtons[0].text,'QCD02节点');
 assert.throws(()=>next.load('{"version":1,"presets":[{"scene":"a","name":"b","data":{"containerItems":{}}}]}'));
 assert.throws(()=>validateSimulation({containerItems:[{count:-1}]}));
});
test('creation budgets include hidden branches, exclude ignored subtrees and use strict 1000/3000 thresholds',()=>{
 const data={main:{type:'panel',controls:Array.from({length:3000},(_,i)=>({['n'+i]:{type:'panel',visible:false}}))}};
 assert.equal(controlBudget(data,'main').severity,'danger');data.main.controls[0].n0.ignored=true;assert.equal(controlBudget(data,'main').severity,'warning');assert.equal(controlBudget(data,'main').total,3000);
 assert.ok(physicalFiles(containerFixture()).some(file=>file.file==='RP/ui/chest_screen.json'));assert.ok(physicalFiles(containerFixture()).some(file=>file.file==='RP/ui/ring.json'));
});

test('texture prefix regex characters are literal and item collections do not share contents',async()=>{
 const {runtimeObject}=await import('../src/bindings.js');
 const pattern=texturePatterns({bindings:[{source_property_name:"('textures/ui/a.b_' + ('%.3s' * #form_button_text))"}]},new Map([['RP/textures/ui/a.b_QCD.png',new Uint8Array()],['RP/textures/ui/axb_QTD.png',new Uint8Array()]]))[0];
 assert.deepEqual(pattern.values,['QCD']);
 const item={name:'钻石',texture:'textures/items/diamond',count:12},sim={containerItems:[item]};
 assert.equal(runtimeObject({collection_name:'container_items',collection_index:0},null,sim)._containerItem.name,'钻石');
 assert.equal(runtimeObject({collection_name:'inventory_items',collection_index:0},null,sim)._containerTexture,undefined);
 assert.throws(()=>validateSimulation({hotbarItems:[{count:1.5}]}));
});
