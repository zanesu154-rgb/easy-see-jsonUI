import {test} from 'node:test';import assert from 'node:assert/strict';import {SourceDrafts} from '../src/source-drafts.js';
test('drafts survive file switches independently of exported source bytes',()=>{
 const drafts=new SourceDrafts();drafts.update('a.json','draft A','source A');drafts.update('b.json','draft B','source B');
 assert.deepEqual(drafts.read('a.json','source A'),{text:'draft A',dirty:true,conflict:false});assert.equal(drafts.read('b.json','source B').text,'draft B');
 drafts.remove('a.json');assert.equal(drafts.read('a.json','source A').text,'source A');assert.equal(drafts.read('b.json','source B').dirty,true);
});
test('changes to underlying project bytes preserve and flag older drafts',()=>{
 const drafts=new SourceDrafts();drafts.update('a','draft','old');assert.equal(drafts.read('a','new').conflict,true);
 drafts.update('a','edited draft','new');assert.equal(drafts.read('a','new').conflict,true);assert.equal(drafts.read('a','old').text,'edited draft');
 drafts.update('a','new','new');assert.equal(drafts.read('a','new').dirty,false);
});
