import {test} from 'node:test';import assert from 'node:assert/strict';
import {nodes} from '../src/core.js';import {layoutScene} from '../src/layout.js';
import {presentScene,clipInsets,intersectRect,pointInRect} from '../src/scene-presentation.js';
const build=(data,states=new Map())=>{const ns=nodes(data),scene=layoutScene(ns,'["main"]',{width:640,height:360});return presentScene(ns,scene,states);};

test('layers accumulate across parent branches, including negative and zero layers',()=>{
 const data={main:{layer:10,controls:[{a:{layer:0,type:'button',controls:[{over:{layer:40,controls:[{tip:{layer:60}}]}}]}},{b:{layer:1,controls:[{icon:{layer:5}}]}},{negative:{layer:-3,controls:[{text:{layer:0}}]}}]}};
 const result=build(data);
 assert.equal(result.get('["main","controls",0,"a","controls",0,"over","controls",0,"tip"]').layer,110);
 assert.equal(result.get('["main","controls",1,"b","controls",0,"icon"]').layer,16);
 assert.equal(result.get('["main","controls",2,"negative","controls",0,"text"]').layer,7);
});
test('flattened state branches retain inherited visibility, opacity, and color',()=>{
 const data={main:{alpha:.5,color:[1,0,0],controls:[{a:{type:'button',alpha:.4,default_control:'idle',hover_control:'over',controls:[{idle:{}},{over:{controls:[{tip:{}}]}}]}}]}};
 const button='["main","controls",0,"a"]',tip='["main","controls",0,"a","controls",1,"over","controls",0,"tip"]';
 assert.equal(build(data).get(tip).visible,false);
 const result=build(data,new Map([[button,'hover']]));assert.equal(result.get(tip).visible,true);assert.equal(result.get(tip).opacity,.2);assert.deepEqual(result.get(tip).color,[1,0,0]);
 assert.equal(result.get('["main","controls",0,"a","controls",0,"idle"]').visible,false);
});
test('ancestor clipping is retained independently from paint hierarchy',()=>{
 const data={main:{size:[100,100],anchor_from:'top_left',anchor_to:'top_left',clips_children:true,controls:[{panel:{size:[50,50],offset:[10,10],anchor_from:'top_left',anchor_to:'top_left',clips_children:true,controls:[{child:{size:[40,40],offset:[40,0],anchor_from:'top_left',anchor_to:'top_left'}}]}}]}};
 const result=build(data),child=result.get('["main","controls",0,"panel","controls",0,"child"]');
 assert.deepEqual(child.clip,{x:10,y:10,w:50,h:50});assert.equal(clipInsets(child.rect,child.clip),'inset(0px 30px -10px -40px)');
 assert.deepEqual(intersectRect({x:0,y:0,w:10,h:10},{x:20,y:20,w:10,h:10}),{x:20,y:20,w:0,h:0});
});
test('button hit boxes include top/left but exclude bottom/right and zero-size boxes',()=>{
 const rect={left:10,top:20,right:36,bottom:46,width:26,height:26};
 assert.equal(pointInRect(rect,10,20),true);assert.equal(pointInRect(rect,35.9,45.9),true);
 assert.equal(pointInRect(rect,36,30),false);assert.equal(pointInRect(rect,20,46),false);assert.equal(pointInRect(rect,9.9,30),false);
 assert.equal(pointInRect({...rect,width:0},10,20),false);
});
