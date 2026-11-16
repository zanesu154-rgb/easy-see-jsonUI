import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectionStats} from '../src/collection-stats.js';

test('active scene stats include authored and generated buttons, never their descendants',()=>{
  const scene={runtime:new Map([
    ['authored',{type:'button',_collectionIndex:0}],
    ['generated',{type:'button',_collectionIndex:1,_generated:true}],
    ['icon',{type:'image',_collectionIndex:0}],
    ['label',{type:'label',_collectionIndex:1}],
    ['plain',{type:'button'}],
    ['missing',{type:'button',_collectionIndex:34,_collectionMissing:true}],
  ]),rects:new Map(['authored','generated','icon','label','plain'].map(id=>[id,{}]))};
  const presentation=new Map([['authored',{visible:true}],['generated',{visible:false}]]);
  assert.deepEqual(collectionStats(scene,presentation),{built:2,visible:1,hidden:1,missing:1});
  presentation.get('generated').visible=true;
  assert.equal(collectionStats(scene,presentation).visible,2);
  assert.deepEqual(collectionStats({runtime:new Map(),rects:new Map()},new Map()),{built:0,visible:0,hidden:0,missing:0});
});
