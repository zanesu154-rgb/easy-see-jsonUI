import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nodes} from '../src/core.js';
import {instantiateCollections} from '../src/collections.js';
import {layoutScene} from '../src/layout.js';
import {compileAnimations,animateScene} from '../src/animations.js';
import {scriptHudScreen} from '../src/script-output.js';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
function fixture(){const data={namespace:'other',message:{type:'panel',size:[100,20],controls:[{text:{type:'label',text:'#text',size:[100,20],alpha:'@other.fade',bindings:[{binding_name:'#text'}]}}]},factory:{type:'panel',size:[100,100],factory:{name:'chat_item_factory',control_ids:{chat_item:'other.message'}}},fade:{anim_type:'alpha',from:1,to:0,duration:1,destroy_at_end:'message'}};return {data,files:new Map([['P/ui/hud_screen.json',bytes(data)]])};}
test('chat events create separate factory instances with per-message binding contexts and birth ticks',()=>{
 const {data,files}=fixture(),simulation={runtimeSceneTick:0,bindings:{'#text':'global'},chatMessages:[{id:1,text:'first',tick:0},{id:2,text:'second',tick:10}]},instances=instantiateCollections(data,files,'P/ui/hud_screen.json',simulation,null,{rootName:'factory',previewFactory:true}),ns=nodes(instances.data),scene=layoutScene(ns,JSON.stringify(['factory']),{width:100,height:100,simulation});
 const labels=ns.filter(n=>n.name==='text'&&n.path[0]==='factory');assert.equal(labels.length,2);assert.deepEqual(labels.map(n=>scene.runtime.get(n.id).text),['first','second']);assert.deepEqual(labels.map(n=>scene.runtime.get(n.id)._context._eventTick),[0,10]);
 const compiled=compileAnimations(files,'P/ui/hud_screen.json',ns,scene.runtime),frame=animateScene(ns,scene,compiled,.75);assert.equal(frame.runtime.get(labels[0].id).alpha,.25);assert.equal(frame.runtime.get(labels[1].id).alpha,.75);const expired=animateScene(ns,scene,compiled,1.25);assert.equal(expired.runtime.get(labels[0].id)._animationHidden,true);assert.equal(expired.runtime.get(labels[1].id)._animationHidden,false);
});
test('nested chat factories run for script events and cap visual instances without changing static samples',()=>{
 const {data,files}=fixture();data.root={type:'panel',controls:[{factory:data.factory}]};const simulation={chatMessages:Array.from({length:40},(_,id)=>({id,tick:id,text:String(id)}))},instances=instantiateCollections(data,files,'P/ui/hud_screen.json',simulation,null,{rootName:'root',previewFactory:true});assert.equal(nodes(instances.data).filter(n=>n.path[0]==='root'&&n.name.startsWith('event_chat_item_')).length,32);
 const sample=instantiateCollections(data,files,'P/ui/hud_screen.json',{},null,{rootName:'factory',previewFactory:true});assert.equal(nodes(sample.data).filter(n=>n.path[0]==='factory'&&n.obj._factoryPreview).length,1);
});
test('HUD output follows imported channel prefixes including factory templates, without package-specific names',()=>{
 const data={namespace:'custom',status:{type:'panel',bindings:[{binding_name:'#hud_title_text_string'},{source_property_name:"(('%.5s' * #hud_title_text_string) = 'STAT:')",target_property_name:'#visible'}]},popup:{type:'panel',bindings:[{binding_name:'#text'},{source_property_name:"(('%.4s' * #text) = 'TIP:')",target_property_name:'#visible'}]},factory:{type:'panel',factory:{name:'chat_item_factory',control_ids:{chat_item:'custom.popup'}}}},files=new Map([['P/ui/hud_screen.json',bytes(data)]]),entries=nodes(data).filter(n=>!n.parent).map(node=>({node,file:'P/ui/hud_screen.json',namespace:'custom',id:node.name}));
 assert.equal(scriptHudScreen(files,{title:'STAT:value'},entries)?.node.name,'status');assert.equal(scriptHudScreen(files,{bindings:{'#text':'TIP:hello'}},entries,'factory')?.node.name,'factory');assert.equal(scriptHudScreen(files,{title:'unmatched'},entries),undefined);
});
