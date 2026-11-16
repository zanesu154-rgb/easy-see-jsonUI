import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nodes} from '../src/core.js';
import {layoutScene} from '../src/layout.js';
import {sceneIssues} from '../src/diagnostics.js';
import {previewReadiness} from '../src/preview-readiness.js';
const file='RP/ui/quest.json';
const data={main:{type:'panel',size:[100,100],controls:[{button:{type:'button',size:[26,26],collection_name:'form_buttons',collection_index:0,controls:[{glow:{type:'image',bindings:[{source_property_name:"('textures/ui/g_' + ('%.3s' * #form_button_text))",target_property_name:'#texture'}]}},{text:{type:'label',text:'#form_button_text'}}]}}]}};
const ns=nodes(data),id=ns.find(n=>n.name==='button').id;
const layout=(simulation={},mode='edit')=>layoutScene(ns,'["main"]',{width:100,height:100,simulation,mode});
const issues=scene=>sceneIssues({parsed:{data},resolved:{data,issues:[]},ns,runtime:scene.runtime,files:new Map(),file,rootName:'main'});

test('missing button data preserves one editable placeholder without evaluating its dynamic images',()=>{
 const scene=layout();assert.equal(scene.runtime.get(id)._missingDataPlaceholder,true);assert.equal(scene.rects.get(id).w,26);
 assert.equal(scene.rects.size,2);assert.equal(scene.runtime.has(ns.find(n=>n.name==='glow').id),false);assert.deepEqual(issues(scene),[]);
 const ready=previewReadiness(scene,ns,'main');assert.equal(ready.kind,'missing-buttons');assert.equal(ready.missing,1);assert.match(ready.message,/尚无按钮模拟数据/);
 assert.equal(data.main.controls[0].button._missingDataPlaceholder,undefined);
});
test('preview mode hides missing collection items and explains the missing data',()=>{
 const scene=layout({},'preview');assert.equal(scene.rects.has(id),false);assert.equal(scene.rects.size,1);
 const status=previewReadiness(scene,ns,'main',{mode:'preview'});assert.match(status.message,/预览模式不显示/);
});
test('real button data renders descendants and retains genuine missing-resource warnings',()=>{
 const scene=layout({formButtons:[{text:'QCD节点'}]});assert.equal(scene.runtime.get(id)._missingDataPlaceholder,false);assert.ok(scene.runtime.has(ns.find(n=>n.name==='glow').id));
 assert.equal(previewReadiness(scene,ns,'main',{buttonCount:1}).kind,'ready');assert.ok(issues(scene).some(issue=>issue.message.includes('textures/ui/g_QCD')));
 assert.ok(!issues(scene).some(issue=>issue.message.startsWith('textures/ui/g_：')));
});
test('hidden HUD channels explain the blank canvas and offer the inferred format',()=>{
 const data={boss:{type:'panel',size:[190,40],bindings:[{source_property_name:"(('%.7s' * #hud_subtitle_text_string) = 'MSBOSS:')",target_property_name:'#visible'}],controls:[{frame:{type:'image'}}]}};
 const ns=nodes(data),scene=layoutScene(ns,'["boss"]',{width:640,height:360});
 const status=previewReadiness(scene,ns,'boss',{schemas:[{prefix:'MSBOSS:'}]});assert.equal(status.kind,'hidden');assert.equal(status.canFill,true);assert.match(status.message,/MSBOSS:/);
 const populated=layoutScene(ns,'["boss"]',{width:640,height:360,simulation:{subtitle:'MSBOSS:7'+'1'.repeat(48)}});assert.equal(previewReadiness(populated,ns,'boss').kind,'ready');
 assert.equal(previewReadiness(scene,ns,'boss',{error:'第 2 行'}).kind,'parse-error');
});
