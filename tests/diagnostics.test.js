import {test} from 'node:test';import assert from 'node:assert/strict';
import {nodes,diagnose} from '../src/core.js';import {layoutScene} from '../src/layout.js';import {sceneIssues,groupIssues} from '../src/diagnostics.js';
test('resolved bindings are quiet and missing bindings produce one diagnostic per control',()=>{
 const data={main:{type:'label',text:'#text',bindings:[{binding_name:'#title_text',binding_name_override:'#text'},{source_property_name:"(#title_text = '任务')",target_property_name:'#visible'}]}};
 const ns=nodes(data),scene=layoutScene(ns,'["main"]',{width:640,height:360,simulation:{formTitle:'任务'}});
 const check=runtime=>sceneIssues({parsed:{data},resolved:{data,issues:[]},ns,runtime,files:new Map(),file:'a.json',rootName:'main'});
 assert.deepEqual(check(scene.runtime),[]);
 const r=new Map([['["main"]',{_trace:[{error:'缺少模拟值 #a'},{error:'缺少模拟值 #b'},{error:'缺少模拟值 #a'}]}]]);
 assert.equal(check(r).length,1);assert.match(check(r)[0].message,/#a.*#b/);
});
test('unresolved array variables are not shape errors, supported collection panels are quiet',()=>{
 assert.deepEqual(diagnose({main:{type:'collection_panel',offset:'$tip_offset'}}),[]);
 assert.equal(diagnose({main:{offset:12}})[0].severity,'error');
});
test('repeated same-type diagnostics retain their count and paths',()=>{
 const grouped=groupIssues([{message:'尚未支持预览控件类型 slider。',path:['a']},{message:'尚未支持预览控件类型 slider。',path:['b']}]);
 assert.equal(grouped.length,1);assert.equal(grouped[0].count,2);assert.deepEqual(grouped[0].paths,[['a'],['b']]);
});

test('unsupported widgets and missing templates in inactive branches do not flood the active scene',()=>{
 const data={main:{type:'panel',controls:[{inactive:{visible:false,type:'scroll_view',controls:[{child:{type:'input_panel'}}]}},{active:{type:'label',text:'任务'}}]}};
 const ns=nodes(data),scene=layoutScene(ns,'["main"]',{width:640,height:360});
 const issues=sceneIssues({parsed:{data},resolved:{data,issues:[{path:['main','controls',0,'inactive','controls',0,'child'],severity:'warning',message:'未找到继承定义：隐藏模板'}]},ns,runtime:scene.runtime,files:new Map(),file:'a.json',rootName:'main'});
 assert.deepEqual(issues,[]);
});

test('malformed control and binding structures remain diagnosable without crashing preview',async()=>{
 const {resolveProject}=await import('../src/resolver.js');const {instantiateCollections}=await import('../src/collections.js');const {screens}=await import('../src/project.js');
 const data={namespace:'test',main:{type:'panel',controls:[null,{bad:42},{valid:{type:'label',text:'valid',bindings:[null]}}],bindings:{},modifications:{}}};
 const files=new Map([['P/ui/a.json',new TextEncoder().encode(JSON.stringify(data))]]);const resolved=resolveProject(files,'P/ui/a.json');
 assert.doesNotThrow(()=>screens(files));const instances=instantiateCollections(resolved.data,files,'P/ui/a.json');const ns=nodes(instances.data);assert.doesNotThrow(()=>layoutScene(ns,'["main"]',{width:640,height:360}));
 const errors=diagnose(resolved.data,[],{runtime:true}).filter(i=>i.severity==='error');assert.equal(errors.length,5);assert.ok(errors.some(i=>i.message==='bindings 必须为数组。'));
});

test('valid JSON with a non-object document root is diagnosed as invalid UI',()=>{
 for(const data of [null,[],42,'text'])assert.equal(sceneIssues({parsed:{data},resolved:{data:{},issues:[]},ns:[],runtime:new Map(),files:new Map(),file:'a.json'} )[0].message,'JSON UI 顶层必须为对象。');
});

test('native HUD runtime hints fold separately from actionable package diagnostics outside containers',()=>{
 const data={main:{type:'panel',controls:[{native:{type:'label',text:'#native',_definitionFile:'__vanilla__/ui/hud.json',bindings:[{binding_name:'#native'}]}},{custom:{type:'label',text:'#custom',bindings:[{binding_name:'#custom'}]}}]}},ns=nodes(data),scene=layoutScene(ns,'["main"]',{width:640,height:360});
 const issues=sceneIssues({parsed:{data},resolved:{data,issues:[]},ns,runtime:scene.runtime,files:new Map(),file:'P/ui/hud.json',rootName:'main'});
 assert.equal(issues.length,2);assert.equal(issues.find(issue=>issue.message.includes('#native')).category,'vanilla-runtime');assert.equal(issues.find(issue=>issue.message.includes('#custom')).category,undefined);
});
