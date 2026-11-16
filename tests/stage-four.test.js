import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileAnimations,sampleTrack,animateScene,easing} from '../src/animations.js';
import {layoutScene} from '../src/layout.js';
import {nodes} from '../src/core.js';
import {presentScene} from '../src/scene-presentation.js';
import {instantiateCollections} from '../src/collections.js';
import {resolveScene,resolveProject} from '../src/resolver.js';
import {controlBudget} from '../src/control-budget.js';
import {runtimeObject} from '../src/bindings.js';
import {comparisonSimulation,outside} from '../src/comparison.js';
import {loadOfficial} from '../src/official-resources.js';
const bytes=obj=>new TextEncoder().encode(JSON.stringify(obj));
function toastFixture(){
 const data={namespace:'hud',entry:{anim_type:'offset',from:[200,4],to:[-4,4],duration:1,easing:'out_sine',next:'@hud.hold'},hold:{anim_type:'wait',duration:4,next:'@hud.exit'},exit:{anim_type:'offset',from:[-4,4],to:[200,4],duration:1,easing:'in_sine',destroy_at_end:'toast'},pulse:{anim_type:'alpha',from:.35,to:1,duration:.8,easing:'in_out_sine',next:'@hud.back'},back:{anim_type:'alpha',from:1,to:.35,duration:.8,next:'@hud.pulse'},main:{type:'panel',size:[640,360],controls:[{toast:{type:'image',size:[160,32],anchor_from:'top_right',anchor_to:'top_right',offset:'@hud.entry',controls:[{icon:{type:'image',size:[16,16]}}]}}]}};
 const files=new Map([['RP/ui/hud.json',bytes(data)]]),resolved=resolveProject(files,'RP/ui/hud.json'),ns=nodes({main:resolved.data.main}),scene=layoutScene(ns,'["main"]',{width:640,height:360});return {files,data,ns,scene};
}
test('toast timeline slides in, holds, slides out and hides its preview without changing source',()=>{
 const {files,data,ns,scene}=toastFixture(),original=files.get('RP/ui/hud.json'),compiled=compileAnimations(files,'RP/ui/hud.json',ns,scene.runtime),id='["main","controls",0,"toast"]',child=ns.find(n=>n.name==='icon').id;
 assert.equal(compiled.tracks.length,1);
 const frame=time=>animateScene(ns,scene,compiled,time);
 assert.equal(frame(0).rects.get(id).x,680);assert.equal(frame(1).rects.get(id).x,476);assert.equal(frame(4.9).rects.get(id).x,476);assert.equal(frame(5).rects.get(id).x,476);assert.equal(frame(6).rects.get(id).x,680);
 assert.equal(frame(1).rects.get(child).x-scene.rects.get(child).x,-4);
 assert.equal(presentScene(ns,frame(6)).get(id).visible,false);
 assert.equal(scene.rects.get(id).x,480);assert.equal(data.main.controls[0].toast.offset,'@hud.entry');assert.equal(files.get('RP/ui/hud.json'),original);
});
test('pulse next cycles can be scrubbed deterministically at any time',()=>{
 const {files}=toastFixture(),data={main:{type:'image',size:[20,20],alpha:'@hud.pulse'}},ns=nodes(data),scene=layoutScene(ns,'["main"]',{width:100,height:100}),compiled=compileAnimations(files,'RP/ui/hud.json',ns,scene.runtime),track=compiled.tracks[0];
 assert.equal(track.cycle,0);assert.equal(sampleTrack(track,0).alpha,.35);assert.equal(sampleTrack(track,.8).alpha,1);assert.ok(Math.abs(sampleTrack(track,1.6).alpha-.35)<1e-8);assert.ok(Math.abs(sampleTrack(track,160.8).alpha-1)<1e-8);assert.ok(Math.abs(easing('out_sine',.5)-Math.SQRT1_2)<1e-8);
});
test('event animations require an explicit matching preview event and broken chains stay bounded',()=>{
 const files=new Map([['RP/ui/a.json',bytes({namespace:'a',event:{anim_type:'alpha',from:0,to:1,duration:1,play_event:'screen.enter'},broken:{anim_type:'wait',duration:0,next:'@a.broken'},main:{type:'image',anims:['@a.event','@a.broken','@a.missing']}})]]),data=resolveProject(files,'RP/ui/a.json').data,ns=nodes({main:data.main}),scene=layoutScene(ns,'["main"]',{width:100,height:100});
 const automatic=compileAnimations(files,'RP/ui/a.json',ns,scene.runtime);assert.deepEqual(automatic.events,['screen.enter']);assert.equal(automatic.tracks.length,1);assert.equal(automatic.warnings.length,2);
 assert.equal(compileAnimations(files,'RP/ui/a.json',ns,scene.runtime,{event:'screen.enter'}).tracks.length,2);
});
test('touch stack splitting overlays default hidden but explicit simulation still enables them',()=>{
 for(const name of ['#stack_splitting_bar_visible','#classic_stack_splitting_overlay_visible','#pocket_stack_splitting_overlay_visible','#progressive_select_down_visible','#progressive_select_up_visible','#progressive_select_left_side_visible','#progressive_select_right_side_visible']){
  const obj={bindings:[{binding_name:name,binding_name_override:'#visible'}]};assert.equal(runtimeObject(obj,null,{containerTitle:'戒指'}).visible,false);assert.equal(runtimeObject(obj,null,{containerTitle:'戒指',bindings:{[name]:true}}).visible,true);
 }
});
test('budget provenance separates custom definitions from generated vanilla descendants',()=>{
 const files=new Map([['RP/ui/a.json',bytes({namespace:'a',main:{type:'panel',controls:[{grid:{type:'grid',grid_dimensions:[9,9],grid_item_template:'common.slot',collection_name:'container_items'}}]}})],['__vanilla__/ui/common.json',bytes({namespace:'common',slot:{type:'input_panel',controls:[{image:{type:'image'}}]}})]]),resolved=resolveProject(files,'RP/ui/a.json'),instance=instantiateCollections(resolved.data,files,'RP/ui/a.json'),budget=controlBudget(instance.data,'main',[],{origins:resolved.origins,file:'RP/ui/a.json'});
 assert.equal(budget.custom,2);assert.equal(budget.vanilla,162);assert.equal(budget.total,164);
 const large={main:{type:'panel',controls:Array.from({length:6346},(_,i)=>({['n'+i]:{type:'image',_definitionFile:i<6000?'__vanilla__/ui/common.json':'RP/ui/a.json'}}))}};
 assert.equal(controlBudget(large,'main').severity,'normal');assert.equal(controlBudget(large,'main').custom,347);
 const mixed={main:{type:'panel',controls:[{branch:{type:'panel',visible:false,controls:[{native:{type:'image',_definitionFile:'__vanilla__/ui/common.json'}}]}}]}};
 const branch=nodes(mixed).find(n=>n.name==='branch'),part=controlBudget(mixed,'main',[{id:'branch',node:branch,label:'分支'}]).branches[0];assert.equal(part.custom,1);assert.equal(part.vanilla,1);
});
test('dual-device contexts choose desktop/mobile content independently and detect crossing bounds',()=>{
 const simulation={containerTitle:'§r§2§r',formTitle:'MSQB:开阳',bindings:{'#value':12}},desktop=comparisonSimulation(simulation,false),phone=comparisonSimulation(simulation,true);
 const files=new Map([['RP/ui/chest.json',bytes({namespace:'chest',main:{type:'screen','$screen_content':'ring.desktop',variables:[{requires:'$pocket_screen','$screen_content':'ring.mobile'}]}})],['RP/ui/ring.json',bytes({namespace:'ring',desktop:{type:'panel'},mobile:{type:'panel'}})]]);
 assert.equal(resolveScene(files,'RP/ui/chest.json',desktop,'main').data.main.$screen_content,'ring.desktop');assert.equal(resolveScene(files,'RP/ui/chest.json',phone,'main').data.main.$screen_content,'ring.mobile');
 assert.equal(phone.formTitle,simulation.formTitle);assert.equal(simulation.touch,undefined);assert.equal(outside({x:0,y:0,w:320,h:180},320,180),false);assert.equal(outside({x:300,y:0,w:21,h:10},320,180),true);
});
test('official UI, item, block and font bytes can reload from cache without network',async()=>{
 const saved=new Map(),cache={get:async key=>saved.get(key)||null,put:async(key,value)=>saved.set(key,value)},paths=['ui/ui_common.json','textures/items/a.png','textures/blocks/b.png','font/glyph_e1.png'],index={paths},project=new Map([['RP/ui/test.json',bytes({namespace:'test',main:{texture:'textures/items/a',controls:[{icon:{texture:'textures/blocks/b'}}]}})]]);
 let calls=0;const first=await loadOfficial(project,{index,cache,fontPages:['font/glyph_e1.png'],fetcher:async()=>{calls++;return new Response(bytes({namespace:'common'}));}});assert.equal(calls,4);assert.equal(first.downloaded,4);
 const second=await loadOfficial(project,{index,cache,fontPages:['font/glyph_e1.png'],fetcher:async()=>{throw Error('offline');}});assert.equal(second.failed.length,0);assert.equal(second.cached,4);assert.equal(second.downloaded,0);assert.deepEqual(second.resources,first.resources);
});

test('a disabled or full cache does not turn a successful resource download into a failure',async()=>{
 let calls=0;const cache={get:async()=>{throw Error('storage disabled');},put:async()=>{throw Error('quota');}};
 const result=await loadOfficial(new Map(),{index:{paths:['ui/ui_common.json']},cache,fetcher:async()=>{calls++;return new Response(bytes({namespace:'common'}));}});
 assert.equal(result.failed.length,0);assert.equal(result.downloaded,1);assert.equal(calls,1);assert.ok(result.resources.has('__vanilla__/ui/ui_common.json'));
});
