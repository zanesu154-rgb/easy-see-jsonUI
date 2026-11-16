import {test} from 'node:test';
import assert from 'node:assert/strict';
import {editValue} from '../src/source-edit.js';
import {parse} from '../src/core.js';

test('offset changes only the changed number, preserving BOM, CRLF, tabs, comments and trailing commas',()=>{
 const source='\uFEFF// 数据格式：状态面板\r\n{\r\n\t"main": {\r\n\t\t"offset": [ 10 /* 左边距 */, -20, ], // 位置\r\n\t\t"text": "§6中文 // 字符串",\r\n\t},\r\n}\r\n';
 const next=editValue(source,['main','offset'],[11,-20]);
 assert.equal(next,source.replace('10 /*','11 /*'));
 assert.equal(editValue(next,['main','offset'],[10,-20]),source);
});
test('nested control paths preserve @ names, escapes and unrelated source bytes',()=>{
 const source='{"main":{"controls":[{"x@demo.base":{"text":"old","offset":[1, 2]}}]}}';
 const next=editValue(source,['main','controls',0,'x@demo.base','text'],'a"\\b\n中');
 assert.equal(next,source.replace('"old"',JSON.stringify('a"\\b\n中')));
 assert.equal(parse(next).data.main.controls[0]['x@demo.base'].text,'a"\\b\n中');
});
test('insertions and deletions keep surrounding comments and formatting conventions',()=>{
 const source='{\r\n\t"main": {\r\n\t\t// keep me\r\n\t\t"type": "panel",\r\n\t\t"offset": [1, 2], // keep position note\r\n\t}\r\n}\r\n';
 const added=editValue(source,['main','visible'],false);
 assert.match(added,/\r\n\t\t"visible": false/);assert.ok(added.includes('// keep me'));assert.ok(added.includes('// keep position note'));assert.equal(parse(added).data.main.visible,false);
 const removed=editValue(added,['main','visible'],undefined);
 assert.equal(parse(removed).data.main.visible,undefined);assert.ok(removed.includes('// keep me'));assert.ok(removed.includes('// keep position note'));
 assert.equal(editValue(source,['main','offset'],[1,2]),source);
});
test('invalid documents, missing control parents and duplicate edit paths are rejected',()=>{
 assert.throws(()=>editValue('{broken',['main','offset'],[0,0]));
 assert.throws(()=>editValue('{"main":{}}',['missing','offset'],[0,0]));
 assert.throws(()=>editValue('{"main":{"offset":[1,2],"offset":[3,4]}}',['main','offset'],[5,6]),/重复键/);
});

test('source textarea round trip preserves file line endings even on no-op apply',async()=>{
 const {sourceInput}=await import('../src/source-edit.js');
 const original='\uFEFF// keep\r\n{\n  "a": 1\r\n}\r\n';
 assert.equal(sourceInput(original.replace(/\r\n/g,'\n'),original),original);
 assert.equal(sourceInput('{\n  "a": 2\n}\n','{\r\n  "a": 1\r\n}\r\n'),'{\r\n  "a": 2\r\n}\r\n');
});

test('clearing any object property preserves leading, trailing and inner comments',()=>{
 const cases=[
  '{\n // why offset\n "offset": [1, 2], // position\n "type": "panel"\n}',
  '{\n "type": "panel",\n // why offset\n "offset": [1, 2] // position\n}',
  '{"offset":[1 /* x */, // y\n2], "type":"panel",}',
  '{"offset":[1 /* x */, 2],}',
  '{"offset":[1 /* x */, 2]}',
 ];
 for(const source of cases){
  const next=editValue(source,['offset'],undefined);
  for(const note of ['// why offset','// position','/* x */','// y'])if(source.includes(note))assert.ok(next.includes(note),next);
  assert.equal(parse(next).error,undefined,next);assert.equal(parse(next).data.offset,undefined);
  assert.equal(parse(next).data.type,parse(source).data.type);
 }
});
