import {test} from 'node:test';import assert from 'node:assert/strict';import {resolveProject} from '../src/resolver.js';
const files=d=>new Map(Object.entries(d).map(([p,v])=>[p,new TextEncoder().encode(JSON.stringify(v))]));
test('instance overrides reach inherited variable template and array offset',()=>{const f=files({'P/ui/test.json':{namespace:'demo',tip:{type:'image',size:[80,20],offset:'$tip_offset'},button:{$tooltip_ref:'demo.tip','$tip_offset|default':[0,0],controls:[{'tooltip@$tooltip_ref':{}}]},screen:{controls:[{'button@demo.button':{$tip_offset:[30,-42]}}]}}});const r=resolveProject(f,'P/ui/test.json'),tip=r.data.screen.controls[0]['button@demo.button'].controls[0]['tooltip@$tooltip_ref'];assert.equal(tip.type,'image');assert.deepEqual(tip.offset,[30,-42]);assert.ok(!r.issues.some(i=>i.message.includes('未找到继承定义')))});
test('inherited defaults cannot overwrite instance dimensions',()=>{const f=files({'P/ui/test.json':{namespace:'demo',base:{'$width|default':10,size:['$width',20]},screen:{controls:[{'box@demo.base':{$width:70}}]}}});assert.deepEqual(resolveProject(f,'P/ui/test.json').data.screen.controls[0]['box@demo.base'].size,[70,20])});
test('missing reference variables are diagnosed as variables rather than missing vanilla',()=>{const r=resolveProject(files({'P/ui/test.json':{namespace:'demo',button:{controls:[{'tip@$undefined':{}}]}}}),'P/ui/test.json');assert.ok(r.issues.some(i=>i.message.includes('继承变量未赋值')));assert.ok(!r.issues.some(i=>i.message.includes('demo.$undefined')))});

test('nested binding and mapping variables resolve within their instance scope',()=>{
 const f=files({'P/ui/a.json':{namespace:'demo',base:{'$binding|default':'#default',bindings:[{binding_name:'$binding',binding_name_override:'#text'}],button_mappings:[{to_button_id:'$target'}]},screen:{controls:[{'child@demo.base':{$binding:'#title_text',$target:'button.menu_exit'}}]}}});
 const child=resolveProject(f,'P/ui/a.json').data.screen.controls[0]['child@demo.base'];assert.equal(child.bindings[0].binding_name,'#title_text');assert.equal(child.button_mappings[0].to_button_id,'button.menu_exit');
});
test('control array variables preserve local child overrides until expansion',()=>{
 const f=files({'P/ui/a.json':{namespace:'demo',base:{type:'panel',controls:'$children'},screen:{controls:[{'group@demo.base':{$caption:'parent',$children:[{child:{type:'label',$caption:'child',text:'$caption'}}]}}]}}});
 const child=resolveProject(f,'P/ui/a.json').data.screen.controls[0]['group@demo.base'].controls[0].child;assert.equal(child.text,'child');
});
