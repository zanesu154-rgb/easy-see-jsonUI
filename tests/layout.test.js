import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nodes} from '../src/core.js';
import {layoutScene} from '../src/layout.js';
const layout=(main,options={})=>layoutScene(nodes({main}),JSON.stringify(['main']),{width:640,height:360,...options});

test('content-sized background follows formatted multiline label and scaling',()=>{
 const main={type:'image',size:['100%c + 12px','100%c + 8px'],controls:[{text:{type:'label',size:['default','default'],font_size:'normal',font_scale_factor:1,line_padding:3,text:'甲乙§6丙\n丁戊',offset:[6,4],anchor_from:'top_left',anchor_to:'top_left'}}]};
 const scene=layout(main),root=scene.rects.get('["main"]'),child=scene.rects.get('["main","controls",0,"text"]');
 assert.equal(root.w,39);assert.equal(root.h,38);assert.equal(child.w,27);assert.equal(child.h,30);
 assert.equal(child.x-root.x,6);assert.equal(child.y-root.y,4);
});

test('default label wraps at max_size and percent width constrains default height',()=>{
 const scene=layout({type:'panel',size:[50,100],controls:[{text:{type:'label',size:['default','default'],max_size:[18,'default'],text:'甲乙丙丁'}}]});
 const child=scene.rects.get('["main","controls",0,"text"]');assert.equal(child.w,18);assert.equal(child.h,24);
 const constrained=layout({type:'panel',size:[18,100],controls:[{text:{type:'label',size:['100%','default'],text:'甲乙丙丁'}}]});
 assert.equal(constrained.rects.get('["main","controls",0,"text"]').h,24);
});

test('stack content uses sum while percent cm uses maximum child extent',()=>{
 const children=[{a:{size:[12,10]}},{b:{size:[20,15]}}];
 assert.equal(layout({type:'stack_panel',size:['100%cm','100%c'],controls:children}).rects.get('["main"]').h,25);
 assert.equal(layout({type:'stack_panel',size:['100%cm','100%c'],controls:children}).rects.get('["main"]').w,20);
 assert.equal(layout({type:'stack_panel',size:[100,'100%cm'],controls:children}).rects.get('["main"]').h,15);
});

test('hidden title branches and descendants are pruned before runtime and DOM layout',()=>{
 const scene=layout({type:'panel',controls:[{hidden:{visible:false,controls:[{child:{text:'#missing'}}]}},{shown:{type:'label',text:'可见'}}]});
 assert.equal(scene.total,4);assert.equal(scene.rects.size,2);assert.equal(scene.pruned,2);
 assert.equal(scene.runtime.has('["main","controls",0,"hidden","controls",0,"child"]'),false);
});

test('percentage children retain max_size and wrap using their constrained width',()=>{
 const scene=layout({size:[200,100],controls:[{text:{type:'label',size:['100%','default'],max_size:[18,'default'],text:'甲乙丙丁'}}]});
 const child=scene.rects.get('["main","controls",0,"text"]');assert.equal(child.w,18);assert.equal(child.h,24);
});
test('parent content and child percentage sizes converge together',()=>{
 const scene=layout({size:['100%c','100%c'],controls:[{child:{size:['50% + 10px',20]}}]});
 const root=scene.rects.get('["main"]'),child=scene.rects.get('["main","controls",0,"child"]');
 assert.ok(Math.abs(root.w-20)<.02);assert.ok(Math.abs(child.w-20)<.02);assert.deepEqual(scene.issues,[]);
});
test('unbounded content cycles produce a diagnostic instead of hanging',()=>{
 const scene=layout({size:['100%c + 12px',30],controls:[{child:{size:['100%',10]}}]});
 assert.equal(scene.issues.length,1);assert.match(scene.issues[0].message,/未收敛/);assert.ok(Number.isFinite(scene.rects.get('["main"]').w));
});
test('stack positions nested descendants from the placed child origin',()=>{
 const scene=layout({type:'stack_panel',size:[100,100],anchor_from:'top_left',anchor_to:'top_left',controls:[{a:{size:[20,10]}},{b:{size:[20,20],controls:[{label:{size:[4,4],anchor_from:'top_left',anchor_to:'top_left',offset:[2,3]}}]}}]});
 const b=scene.rects.get('["main","controls",1,"b"]'),label=scene.rects.get('["main","controls",1,"b","controls",0,"label"]');assert.equal(b.y,10);assert.equal(label.y,13);assert.equal(label.x-b.x,2);
});

test('ignored touch and mouse branches do not produce duplicate controls',()=>{
 const main={type:'panel',controls:[{mouse:{ignored:'$touch',size:[100,20]}},{touch:{ignored:'(not $touch)',size:[100,20]}}]};
 const desktop=layout(main);assert.ok(desktop.rects.has('["main","controls",0,"mouse"]'));assert.ok(!desktop.rects.has('["main","controls",1,"touch"]'));
 const touch=layout(main,{simulation:{touch:true}});assert.ok(touch.rects.has('["main","controls",1,"touch"]'));assert.ok(!touch.rects.has('["main","controls",0,"mouse"]'));
});
test('horizontal stack fill leaves room for a content-sized scrollbar',()=>{
 const scene=layout({type:'stack_panel',orientation:'horizontal',size:[200,100],controls:[{viewport:{type:'panel',size:['fill','100%']}},{track:{type:'stack_panel',size:['default','100%'],controls:[{image:{size:[5,100]}}]}}]});
 assert.equal(scene.rects.get('["main","controls",0,"viewport"]').w,195);assert.equal(scene.rects.get('["main","controls",1,"track"]').w,5);
});
