import {test} from 'node:test';
import assert from 'node:assert/strict';
import Babel from '../vendor/babel/babel.min.cjs';
import {normalizePlayerState,patchPlayerState,playerStateSignature,PlayerSaves} from '../src/player-saves.js';
import {playerFields,fieldKind,mergeObservations} from '../src/player-fields.js';
import {createBedrockRuntime} from '../src/script-engine.js';
import {createScriptLoader} from '../src/script-loader.js';
import {refreshPlayerSession,previewPlayerState} from '../src/player-session.js';
import {ScriptControls} from '../src/script-controls.js';
function load(code,seed={}){const sources={'P/main.js':code},runtime=createBedrockRuntime({seed}),loader=createScriptLoader({Babel,runtime,sources});loader.load('P/main.js');return {runtime,loader,sources};}
test('state validation keeps primitive types, vector properties, scores, tags and exact item metadata',()=>{
 const source={tick:18,player:{n:3,yes:true,json:'{"done":false}',position:{x:1,y:2,z:3}},world:{mode:'normal'},tags:['a','a'],scores:{level:{Player:6}},inventory:[{typeId:'demo:book',amount:1,nameTag:'my book',lore:['line'],dynamicProperties:{ready:true}}]};
 const state=normalizePlayerState(source);assert.equal(state.inventory.length,36);assert.deepEqual(state.tags,['a']);assert.equal(typeof state.player.n,'number');assert.equal(typeof state.player.yes,'boolean');assert.equal(typeof state.player.json,'string');assert.deepEqual(state.inventory[0].dynamicProperties,{ready:true});state.player.n=5;assert.equal(source.player.n,3);
 for(const bad of [{player:{x:null}},{player:{x:NaN}},{player:{x:[1]}},{scores:{a:{Player:1.5}}},{inventory:[{typeId:'invalid',amount:1}]},{inventory:Array(37)},{tags:[4]},{tick:-1},{world:new Date()}])assert.throws(()=>normalizePlayerState(bad));
});
test('field patches are immutable, clear values rather than stringify them, and protect special property keys',()=>{
 const original=normalizePlayerState({player:{a:1,json:'{"nested":true}'},scores:{q:{Player:2}}});const next=patchPlayerState(original,{owner:'player',key:'a'},false);assert.equal(next.player.a,false);assert.equal(original.player.a,1);assert.equal(patchPlayerState(next,{owner:'player',key:'a'},undefined,{unset:true}).player.a,undefined);
 const special=patchPlayerState(original,{owner:'world',key:'__proto__'},'literal');assert.equal(Object.getPrototypeOf(special.world),Object.prototype);assert.equal(Object.hasOwn(special.world,'__proto__'),true);assert.equal(special.world.__proto__,'literal');
 const score=patchPlayerState(original,{owner:'scoreboard',key:'objective/with/slash/person',objective:'objective/with/slash',participant:'person'},8);assert.equal(score.scores['objective/with/slash'].person,8);assert.throws(()=>patchPlayerState(original,{owner:'inventory',key:'36'},null));
});
test('player saves keep a separate namespace, current working state, active selection and atomic import',()=>{
 const saves=new PlayerSaves(),first=saves.save('P/main.js','新手',{player:{level:0}},{action:{event:'itemUse',item:'demo:book'}}),second=saves.save('P/main.js','高级',{player:{level:2}});saves.setWorking('P/main.js',{player:{level:3}});assert.equal(second.state.player.level,2);assert.equal(saves.current('P/main.js').state.player.level,3);saves.select(first.id);assert.equal(saves.current('P/main.js').state.player.level,0);
 const restored=new PlayerSaves();restored.load(saves.text());assert.equal(restored.entries.length,2);assert.equal(restored.entries.find(value=>value.id===restored.active.get('P/main.js')).name,'新手');const before=restored.text();assert.throws(()=>restored.load({version:1,saves:[{entry:'P/main.js',name:'bad',state:{inventory:[{typeId:'bad',amount:0}]}}]}));assert.equal(restored.text(),before);
 assert.throws(()=>restored.load({version:1,saves:[{entry:'P/main.js',name:'bad',state:{},observations:[{id:'a',key:'a',owner:'player',options:'invalid'}]}]}));assert.equal(restored.text(),before);
 assert.equal(restored.current('Other/main.js'),undefined);
});
test('an explicit action scopes observations without pulling in every startup or background access',async()=>{
 const {runtime}=load(`import {world,system} from '@minecraft/server';world.getDynamicProperty('startup');system.runInterval(()=>world.getAllPlayers()[0].getDynamicProperty('background'),1);world.afterEvents.itemUse.subscribe(({source,itemStack})=>{if(itemStack.typeId==='demo:a')source.getDynamicProperty('a');else source.getDynamicProperty('b');});`);
 await runtime.trigger({event:'itemUse',item:'demo:a'});assert.deepEqual(runtime.snapshot().actionReads.map(row=>row.id),['player:a']);await runtime.trigger({event:'itemUse',item:'demo:b'});assert.deepEqual(runtime.snapshot().actionReads.map(row=>row.id),['player:b']);assert.ok(runtime.snapshot().reads.some(row=>row.id==='world:startup'));assert.ok(runtime.snapshot().reads.some(row=>row.id==='player:background'));
});
test('observed boolean helpers and fallback values produce correct editable types without boxing primitives',async()=>{
 const {runtime}=load(`import{world}from'@minecraft/server';const dp=(p,k)=>p.getDynamicProperty(k);world.afterEvents.itemUse.subscribe(({source})=>{if(dp(source,'ready')===true)source.sendMessage('ready');const n=source.getDynamicProperty('n')??0;if(typeof n!=='number')throw Error('boxed');const raw=source.getDynamicProperty('json')??'{"nested":{"n":1}}';JSON.parse(raw);});`);await runtime.trigger({event:'itemUse'});const fields=playerFields(runtime.snapshot());assert.equal(fieldKind(fields.find(row=>row.key==='ready')),'boolean');assert.equal(fieldKind(fields.find(row=>row.key==='n')),'number');assert.equal(fieldKind(fields.find(row=>row.key==='json')),'json-string');assert.equal(fields.find(row=>row.key==='ready').sources[0].file,'P/main.js');
});
test('array indices and switch comparisons are linked to the correct storage binding even when values coincide',async()=>{
 const {runtime}=load(`import{world}from'@minecraft/server';const names=['新手','中级','高级'];const get=(p,k)=>p.getDynamicProperty(k)??0;world.afterEvents.itemUse.subscribe(({source})=>{const level=get(source,'realm');const other=get(source,'other');source.sendMessage(names[level]);const mode=get(source,'mode');switch(mode){case 0:break;case 1:break;case 2:break;}if(level===1){};});`);await runtime.trigger({event:'itemUse'});const fields=runtime.snapshot().actionReads;assert.deepEqual(fields.find(row=>row.key==='realm').options.map(option=>option.label),['新手','中级','高级']);assert.equal(fields.find(row=>row.key==='other').options,undefined);assert.deepEqual(fields.find(row=>row.key==='mode').options.map(option=>option.value),[0,1,2]);
});
test('instrumentation preserves computed calls, writes, exceptions, live imports and awaited initializers',async()=>{
 const {runtime,loader}=load(`import{world}from'@minecraft/server';export async function check(){const obj={n:2,f(){return this.n}};const key='f';obj['n']+=1;const value=await Promise.resolve(obj[key]());let threw=false;try{const bad=(()=>{throw Error('expected')})();}catch{threw=true;}return [value,threw,obj.n];}`);assert.deepEqual(await loader.load('P/main.js').check(),[3,true,3]);assert.equal(runtime.snapshot().reads.length,0);
});
test('JSON, tags, scores, unset and inventory fields read current storage instead of stale observed values',()=>{
 const state=normalizePlayerState({player:{x:7,json:'{"done":true}'},tags:['ready'],scores:{level:{Player:4}},inventory:[{typeId:'demo:coin',amount:3}]});const fields=playerFields({state,action:{kind:'trigger'},actionReads:[{id:'player:x',owner:'player',key:'x',value:1},{id:'player:missing',owner:'player',key:'missing',hints:{fallback:false}}]},{all:true});assert.equal(fields.find(row=>row.id==='player:x').value,7);assert.ok(fields.some(row=>row.owner==='inventory'));assert.ok(fields.some(row=>row.owner==='scoreboard'));assert.equal(fieldKind(fields.find(row=>row.key==='json')),'json-string');
 const known=mergeObservations([{id:'player:x',owner:'player',key:'x',options:[{value:0,label:'新手'},{value:1,label:'高级'}],optionSource:{kind:'array-index'},sources:[{file:'a.js',line:1}]}],[{id:'player:x',owner:'player',key:'x',options:[{value:1,label:'1'}],optionSource:{kind:'comparison'}}]);assert.equal(known[0].options[1].label,'高级');
});
test('safe refresh uses a fresh cache and current storage while replaying no reward callbacks',async()=>{
 const sources={'P/main.js':`import{world}from'@minecraft/server';import{ActionFormData}from'@minecraft/server-ui';let cached;world.afterEvents.itemUse.subscribe(({source})=>{cached??=source.getDynamicProperty('level')??0;new ActionFormData().title('L'+cached).button('领取').show(source).then(r=>{if(!r.canceled)source.setDynamicProperty('reward',(source.getDynamicProperty('reward')??0)+1);});});`};const initial=normalizePlayerState({player:{level:0,reward:1}});const result=await refreshPlayerSession({Babel,sources,entry:'P/main.js',seed:{...initial,player:{level:2,reward:1}},action:{event:'itemUse',item:'demo:book'}});assert.deepEqual(result.blockedWrites,[]);assert.equal(result.runtime.snapshot().form.title,'L2');assert.equal(result.runtime.snapshot().state.player.reward,1);assert.equal(initial.player.level,0);
});
test('non-idempotent reopening commits the edit but does not grant an additional reward',async()=>{
 const sources={'P/main.js':`import{world}from'@minecraft/server';world.afterEvents.itemUse.subscribe(({source})=>source.setDynamicProperty('coins',(source.getDynamicProperty('coins')??0)+1));`};const seed=normalizePlayerState({player:{coins:1,level:2}});const result=await refreshPlayerSession({Babel,sources,entry:'P/main.js',seed,action:{event:'itemUse'}});assert.deepEqual(result.blockedWrites,['player:coins']);assert.equal(result.runtime.snapshot().state.player.coins,1);assert.equal(result.runtime.snapshot().state.player.level,2);await result.runtime.trigger({event:'itemUse'});assert.equal(result.runtime.snapshot().state.player.coins,2);
});
test('thumbnail probing cannot modify the authoritative save or learn a post-reward state as navigation',async()=>{
 const sources={'P/main.js':`import{world}from'@minecraft/server';import{ActionFormData}from'@minecraft/server-ui';world.afterEvents.itemUse.subscribe(({source})=>{new ActionFormData().title('Level '+source.getDynamicProperty('level')).button('奖励').show(source).then(r=>{if(!r.canceled){source.setDynamicProperty('coins',99);new ActionFormData().title('AFTER_REWARD').button('OK').show(source);}});});`};const seed=normalizePlayerState({player:{level:2,coins:0}}),before=JSON.stringify(seed),result=await previewPlayerState({Babel,sources,entry:'P/main.js',seed,actions:[{event:'itemUse'}],limit:5});assert.equal(JSON.stringify(seed),before);assert.ok(result.outputs.some(output=>output.form?.title==='Level 2'));assert.ok(!result.outputs.some(output=>output.form?.title==='AFTER_REWARD'));
});
test('clock is saved but excluded from storage dirty detection; snapshots and item metadata are independent copies',()=>{
 assert.equal(playerStateSignature({tick:1}),playerStateSignature({tick:100}));assert.notEqual(playerStateSignature({tick:1},{clock:true}),playerStateSignature({tick:100},{clock:true}));const runtime=createBedrockRuntime({seed:{player:{position:{x:1,y:2,z:3}},inventory:[{typeId:'demo:book',amount:1,lore:['hello'],dynamicProperties:{x:true}}]}});const player=runtime.server.world.getAllPlayers()[0],vector=player.getDynamicProperty('position');vector.x=9;assert.equal(player.getDynamicProperty('position').x,1);const snapshot=runtime.snapshot();snapshot.state.player.position.x=20;assert.equal(runtime.snapshot().state.player.position.x,1);assert.deepEqual(snapshot.state.inventory[0].lore,['hello']);assert.equal(snapshot.state.inventory[0].dynamicProperties.x,true);assert.equal(player.getComponent('inventory').container.emptySlotsCount,35);
});

test('state call instrumentation preserves method getter order, receiver and awaited arguments',async()=>{
 const {loader}=load(`export async function check(){const order=[];const object={n:7,get getDynamicProperty(){order.push('getter');return function(value){order.push('call');return this.n+value;}}};const result=object.getDynamicProperty(await Promise.resolve().then(()=>{order.push('argument');return 2;}));return [result,order];}`);
 assert.deepEqual(await loader.load('P/main.js').check(),[9,['getter','argument','call']]);
});
test('thumbnail discovery keeps distinct HUD-only actions without a form',async()=>{
 const sources={'P/main.js':`import{world}from'@minecraft/server';world.afterEvents.itemUse.subscribe(({source,itemStack})=>source.onScreenDisplay.setTitle(itemStack.typeId));`};
 const result=await previewPlayerState({Babel,sources,entry:'P/main.js',seed:normalizePlayerState(),actions:[{event:'itemUse',item:'demo:a'},{event:'itemUse',item:'demo:b'}]});
 assert.ok(result.outputs.some(output=>output.hud?.title==='demo:a'));assert.ok(result.outputs.some(output=>output.hud?.title==='demo:b'));
});
test('an invalid script snapshot stops cleanly before replacing the last valid player state',()=>{
 const controller=Object.create(ScriptControls.prototype),previous={state:normalizePlayerState({player:{level:2}})};let stopped=false;
 Object.assign(controller,{snapshot:previous,status:{textContent:''},stop(){stopped=true;},update(){},onSnapshot(){assert.fail('invalid storage must not be saved');}});
 controller.receive({type:'snapshot',operation:'trigger',state:{tags:[42]}});assert.equal(stopped,true);assert.equal(controller.snapshot,previous);assert.match(controller.status.textContent,/脚本状态无法保存/);
});
