import {test} from 'node:test';import assert from 'node:assert/strict';import {loadOfficial,OFFICIAL_REF} from '../src/official-resources.js';import {unchangedRoot} from '../src/baseline.js';
const bytes=o=>new TextEncoder().encode(JSON.stringify(o));
test('fetches official dependencies without requesting private custom filenames',async()=>{const calls=[];const result=await loadOfficial(new Map([['P/ui/custom.json',bytes({namespace:'mod','main@common.panel':{texture:'textures/ui/example'}})]]),{index:{paths:['ui/common.json','textures/ui/example.png']},fetcher:async(url,options)=>{calls.push({url,options});if(url.includes('api.github.com'))return Response.json({tree:['ui/common.json','textures/ui/example.png'].map(p=>({type:'blob',path:'resource_pack/'+p}))});return new Response(url.endsWith('example.png')?'image':JSON.stringify({namespace:'common',panel:{type:'panel'}}),{status:200})}});assert.ok(result.resources.has('__vanilla__/textures/ui/example.png'));assert.ok(calls.every(c=>c.url.includes(OFFICIAL_REF)&&!c.options.body));assert.ok(calls.every(c=>!c.url.includes('custom.json')));assert.equal(result.failed.length,0)});
test('unchanged roots compare source definitions, preserve modified siblings',()=>{const f=new Map([['P/ui/a.json',bytes({namespace:'a',original:{type:'panel',size:[10,20]},edited:{type:'panel',size:[30,20]}})],['__vanilla__/ui/a.json',bytes({namespace:'a',original:{size:[10,20],type:'panel'},edited:{type:'panel',size:[10,20]}})]]);assert.equal(unchangedRoot(f,'P/ui/a.json','original'),true);assert.equal(unchangedRoot(f,'P/ui/a.json','edited'),false)});

test('bundled index eliminates API calls, includes items and blocks, and retries the CDN',async()=>{
 const calls=[];
 const result=await loadOfficial(new Map(),{index:{paths:['textures/items/apple.png','textures/blocks/stone.png']},simulation:{formButtons:[{text:'a',texture:'textures/items/apple'},{text:'b',texture:'textures/blocks/stone'}]},fetcher:async(url,options)=>{calls.push(url);assert.ok(options.signal);if(url.startsWith('https://raw.'))throw Error('CORS');return new Response('image');}});
 assert.equal(result.resources.size,2);assert.equal(result.failed.length,0);
 assert.ok(calls.every(url=>!url.includes('api.github.com')));assert.ok(calls.some(url=>url.includes('cdn.jsdelivr.net')));
});

test('a second resource sweep resumes after the cap without downloading existing assets again',async()=>{
 const paths=Array.from({length:165},(_,i)=>'textures/items/item_'+i+'.png');
 const options={index:{paths},simulation:{formButtons:paths.map(texture=>({text:'item',texture}))},fetcher:async()=>new Response('image')};
 const first=await loadOfficial(new Map(),options);assert.equal(first.resources.size,160);assert.equal(first.limited,true);
 let requests=0;
 const second=await loadOfficial(first.resources,{...options,fetcher:async()=>{requests++;return new Response('image');}});
 assert.equal(requests,5);assert.equal(second.resources.size,5);assert.equal(second.limited,false);
});
