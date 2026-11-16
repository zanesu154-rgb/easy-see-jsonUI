import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runtimeObject} from '../src/bindings.js';
import {resolveScene} from '../src/resolver.js';
import {instantiateCollections} from '../src/collections.js';
import {nodes} from '../src/core.js';
import {layoutScene} from '../src/layout.js';
import {removeShadowedVanilla} from '../src/resource-overrides.js';
import {installVanilla} from '../src/resources.js';
import {inferChannels,texturePatterns,stateMatrix} from '../src/simulation-tools.js';
import {sceneIssues,groupIssues} from '../src/diagnostics.js';
const bytes=obj=>new TextEncoder().encode(JSON.stringify(obj));

test('vanilla import retains chest definitions used by modification-only overrides',()=>{
 const project=new Map([['RP/ui/chest_screen.json',bytes({namespace:'chest',small_chest_screen:{modifications:[{array_name:'variables',operation:'insert_back',value:[{requires:true,'$screen_content':'ring.panel'}]}]}})],['RP/ui/ring.json',bytes({namespace:'ring',panel:{type:'panel',controls:[{'label@chest.chest_label':{text:'须弥戒'}},{'grid@chest.small_chest_grid':{}}]}})]]);
 const archive=new Map([['ui/chest_screen.json',bytes({namespace:'chest',small_chest_screen:{type:'screen',controls:[{'content@$screen_content':{}}]},chest_label:{type:'label',size:['90%','default'],color:'$title_text_color'},small_chest_grid:{type:'grid',size:[162,54]}})]]);
 archive.set('ui/_global_variables.json',bytes({'$title_text_color':[.3,.3,.3]}));
 const files=removeShadowedVanilla(installVanilla(project,archive).files);
 const resolved=resolveScene(files,'RP/ui/chest_screen.json',{containerTitle:'测试'},'small_chest_screen');
 assert.ok(files.has('__vanilla__/ui/chest_screen.json'));
 const label=nodes(resolved.data).find(n=>n.name==='label@chest.chest_label');assert.equal(label.obj.type,'label');assert.equal(label.obj.text,'须弥戒');assert.deepEqual(label.obj.color,[.3,.3,.3]);
 assert.equal(resolved.issues.filter(issue=>issue.message.includes('未找到')).length,0);
 assert.equal(files.get('RP/ui/chest_screen.json'),project.get('RP/ui/chest_screen.json'));
});

test('container locks are neutral by default and explicit simulated bindings override defaults',()=>{
 for(const binding of ['#item_lock_in_inventory','#item_lock_in_slot','#item_lock','#inventory_selected_item_lock_in_inventory','#inventory_selected_item_lock_in_slot']){
  const obj={type:'image',bindings:[{binding_name:binding,binding_name_override:'#visible'}]};
  assert.equal(runtimeObject(obj,null,{containerTitle:'箱子'}).visible,false);
  assert.equal(runtimeObject(obj,null,{containerTitle:'箱子',bindings:{[binding]:true}}).visible,true);
  assert.equal(runtimeObject(obj,null,{containerTitle:'箱子'})._trace.some(t=>t.error),false);
 }
 const slot={collection_name:'container_items',collection_index:0,bindings:[{binding_name:'#item_lock_in_slot',binding_name_override:'#visible'}]};
 assert.equal(runtimeObject(slot,null,{}).visible,false);
 const ordinary=runtimeObject({bindings:[{binding_name:'#unknown_visibility',binding_name_override:'#visible'}]},null,{});
 assert.equal(ordinary.visible,undefined);assert.match(ordinary._trace[0].error,/#unknown_visibility/);
});

test('cell selection binding expressions resolve indirect binding names',()=>{
 const obj={'$cell_selected_binding_name':'#is_selected_slot',bindings:[{binding_name:'(not $cell_selected_binding_name)',binding_name_override:'#visible'}]};
 assert.equal(runtimeObject(obj,null,{containerTitle:'箱子'}).visible,true);
 assert.equal(runtimeObject(obj,null,{containerTitle:'箱子',bindings:{'#is_selected_slot':true}}).visible,false);
 assert.equal(runtimeObject(obj,null,{containerTitle:'箱子'})._trace.some(t=>t.error),false);
});

test('unsized cell images and button hit areas fill the 18 by 18 grid cell',()=>{
 const data={main:{type:'panel',size:[18,18],controls:[{image:{type:'image'}},{button:{type:'button'}},{custom:{type:'custom'}},{explicit:{type:'image',size:[100,30]}}]}};
 const scene=layoutScene(nodes(data),'["main"]',{width:18,height:18});
 for(const name of ['image','button','custom']){const rect=[...scene.rects].find(([id])=>JSON.parse(id).at(-1)===name)[1];assert.equal(rect.w,18);assert.equal(rect.h,18);assert.equal(rect.x,0);}
 assert.equal([...scene.rects].find(([id])=>JSON.parse(id).at(-1)==='explicit')[1].w,100);
});

test('tab and subtab literal names do not create invented cross-product states',()=>{
 for(const prefix of ['tab_','subtab_']){
  const files=new Map(['P0','P1','on','off','hover'].map(value=>['RP/textures/ui/'+prefix+value+'.png',new Uint8Array()]));
  const pattern=texturePatterns({bindings:[{source_property_name:`('textures/ui/${prefix}' + ('%.2s' * #form_button_text))`}]},files)[0];
  const matrix=stateMatrix(pattern,files,'RP/ui/a.json');
  assert.deepEqual(matrix.states.map(s=>s.value),['P0','P1','on']);assert.ok(matrix.states.every(s=>s.resource.status==='found'));
 }
});

test('selected event factory exposes nested toast fields and one read-only preview sample',()=>{
 const data={namespace:'hud',factory:{type:'stack_panel',size:['100%','100%'],factory:{control_ids:{chat_item:'test_panel@hud.panel'}}},panel:{type:'panel',controls:[{toast:{type:'image',bindings:[{source_property_name:"(('%.6s' * #text) = 'toast.')",target_property_name:'#visible'},{source_property_name:"(('%.156s' * #text) - ('%.6s' * #text)) - '$'",target_property_name:'#texture'},{source_property_name:"(('%.206s' * #text) - ('%.156s' * #text)) - '$'",target_property_name:'#bg'}]}}]}};
 const files=new Map([['RP/ui/hud.json',bytes(data)]]),original=files.get('RP/ui/hud.json');
 const result=instantiateCollections(data,files,'RP/ui/hud.json',{},null,{rootName:'factory',previewFactory:true});
 const sample=result.data.factory.controls[0].preview_chat_item;assert.equal(sample._generated,true);assert.equal(sample._factoryPreview,true);
 const schema=inferChannels(result.data.factory)[0];assert.equal(schema.prefix,'toast.');assert.deepEqual(schema.fields.map(field=>field.end-field.start),[150,50,Infinity]);
 assert.equal(data.factory.controls,undefined);assert.equal(files.get('RP/ui/hud.json'),original);
 assert.equal(instantiateCollections(data,files,'RP/ui/hud.json',{},null,{rootName:'factory'}).data.factory.controls,undefined);
});

test('native container info is folded without hiding custom bindings or errors',()=>{
 const data={main:{type:'panel','$screen_content':'ring.panel','$container_title':'戒指',controls:[{native:{type:'custom',_templateFile:'__vanilla__/ui/ui_common.json',bindings:[{binding_name:'#renderer_data'}]}},{custom:{type:'label',text:'#custom_data'}},{broken:{type:'panel',size:42}}]}};
 const ns=nodes(data),scene=layoutScene(ns,'["main"]',{width:100,height:100});
 const issues=sceneIssues({parsed:{data},resolved:{data,issues:[],origins:new Map()},ns,runtime:scene.runtime,files:new Map(),file:'RP/ui/ring.json',rootName:'main'});
 assert.ok(issues.some(i=>i.category==='container-runtime'&&i.message.includes('#renderer_data')));
 assert.ok(issues.some(i=>!i.category&&i.message.includes('#custom_data')));
 assert.ok(issues.some(i=>i.severity==='error'&&!i.category));
 const grouped=groupIssues([{message:'相同提示',severity:'info',category:'container-runtime'},{message:'相同提示',severity:'info'}]);assert.equal(grouped.length,2);
});
