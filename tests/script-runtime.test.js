import {test} from 'node:test';
import assert from 'node:assert/strict';
import Babel from '../vendor/babel/babel.min.cjs';
import {createBedrockRuntime} from '../src/script-engine.js';
import {createScriptLoader} from '../src/script-loader.js';
import {scriptProject,resolveModule,actionCandidates} from '../src/script-project.js';
const bytes=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value));
function script(source,seed={}){const output=[],runtime=createBedrockRuntime({seed,emit:message=>output.push(message)}),sources={'P/scripts/main.js':source},loader=createScriptLoader({Babel,runtime,sources});loader.load('P/scripts/main.js');return {runtime,output,loader};}
test('only manifest script entries are offered; item names use item definitions and language files',()=>{
 const project=scriptProject(new Map([['P/manifest.json',bytes({header:{name:'pack.name'},modules:[{type:'script',entry:'scripts/main.js'}]})],['P/scripts/main.js',bytes('world.afterEvents.itemUse.subscribe(()=>"demo:book")')],['P/items/book.json',bytes({'minecraft:item':{description:{identifier:'demo:book'},components:{'minecraft:display_name':{value:'item.demo:book.name'}}}})],['P/texts/zh_CN.lang',bytes('pack.name=演示包\nitem.demo:book.name=§6任务书')],['Other/scripts/never-run.js',bytes('throw Error("no")')]]));
 assert.equal(project.packs.length,1);assert.equal(project.packs[0].entry,'P/scripts/main.js');assert.equal(project.packs[0].name,'演示包');assert.equal(project.items[0].name,'任务书');
 const actions=actionCandidates(project,['P/scripts/main.js'],[{phase:'after',name:'itemUse'},{phase:'system',name:'scriptEventReceive'}]);assert.equal(actions[0].label,'右键 任务书');assert.equal(actions[1].event,'scriptEventReceive');
});
test('module resolver supports extensionless files and rejects external modules and missing files',()=>{
 const sources={'P/scripts/lib.js':''};assert.equal(resolveModule('P/scripts/main.js','./lib',sources),'P/scripts/lib.js');assert.throws(()=>resolveModule('P/scripts/main.js','https://example.com/a.js',sources),/外部模块/);assert.throws(()=>resolveModule('P/scripts/main.js','./missing.js',sources),/未找到/);assert.throws(()=>resolveModule('main.js','../../../x',sources),/越界/);
});
test('module loader preserves live bindings, aliased imports, lexical shadowing and re-exports across cycles',()=>{
 const runtime=createBedrockRuntime(),sources={
  'P/main.js':`import {value,inc} from './a.js'; import {read} from './b.js'; export function sample(){inc();const f=(value)=>value;return [value,read(),f(99)];}`,
  'P/a.js':`import './b.js';export let value=1;export function inc(){value++;}`,
  'P/b.js':`import {value as v} from './a.js';export const read=()=>v;export {inc} from './a.js';`
 },loader=createScriptLoader({Babel,runtime,sources}),main=loader.load('P/main.js');assert.deepEqual(main.sample(),[2,2,99]);assert.deepEqual(main.sample(),[3,3,99]);assert.equal(loader.loaded.length,3);
});
test('action form selection resumes the actual Promise and produces a new form',async()=>{
 const {runtime}=script(`import {world} from '@minecraft/server';import {ActionFormData} from '@minecraft/server-ui';world.afterEvents.itemUse.subscribe(async({source})=>{const result=await new ActionFormData().title('第一张').button('下一张').show(source);if(!result.canceled)new ActionFormData().title('序号 '+result.selection).button('完成').show(source);});`);
 await runtime.trigger({event:'itemUse'});const first=runtime.snapshot().form;assert.equal(first.title,'第一张');await runtime.respond({id:first.id,selection:0});assert.equal(runtime.snapshot().form.title,'序号 0');await assert.rejects(runtime.respond({id:first.id,selection:0}),/过期/);
});
test('closing a form reports canceled and allows subsequent forms; busy forms do not replace the current one',async()=>{
 const runtime=createBedrockRuntime(),player=runtime.server.world.getAllPlayers()[0],form=new runtime.ui.ActionFormData().title('A').button('A');let result;form.show(player).then(value=>result=value);const busy=await new runtime.ui.ActionFormData().title('B').show(player);assert.equal(busy.cancelationReason,'UserBusy');assert.equal(runtime.snapshot().form.title,'A');await runtime.respond({id:runtime.snapshot().form.id,canceled:true});assert.equal(result.canceled,true);assert.equal(result.cancelationReason,'UserClosed');assert.equal(runtime.snapshot().form,null);
});
test('modal values are typed, validated and handed back to scripts; message selection uses its original index',async()=>{
 const runtime=createBedrockRuntime(),player=runtime.server.world.getAllPlayers()[0];let result;
 new runtime.ui.ModalFormData().title('输入').dropdown('选项',['甲','乙'],{defaultValueIndex:1}).slider('数字',0,10,{valueStep:2,defaultValue:4}).toggle('开关',{defaultValue:true}).textField('文本','提示',{defaultValue:'初值'}).show(player).then(value=>result=value);
 const id=runtime.snapshot().form.id;await assert.rejects(runtime.respond({id,values:[2,4,true,'x']}),/无效/);await runtime.respond({id,values:[1,6,false,'文字']});assert.deepEqual(result.formValues,[1,6,false,'文字']);new runtime.ui.MessageFormData().button1('是').button2('否').show(player).then(value=>result=value);await runtime.respond({id:runtime.snapshot().form.id,selection:1});assert.equal(result.selection,1);
});
test('virtual ticks control intervals, timeout ordering, promises and canceled tasks',async()=>{
 const runtime=createBedrockRuntime(),system=runtime.server.system,events=[];system.run(()=>events.push('next'));const interval=system.runInterval(()=>events.push(system.currentTick),2);system.runTimeout(()=>system.clearRun(interval),5);system.waitTicks(3).then(()=>events.push('promise'));assert.deepEqual(events,[]);await runtime.advance(6);assert.deepEqual(events,['next',2,'promise',4]);assert.equal(runtime.now(),1700000000300);
});
test('a failing callback does not stop other subscribers or later ticks',async()=>{
 const runtime=createBedrockRuntime(),system=runtime.server.system;let count=0;runtime.server.world.afterEvents.itemUse.subscribe(()=>{throw Error('错误');});runtime.server.world.afterEvents.itemUse.subscribe(()=>count++);system.runInterval(()=>{throw Error('定时错误')},1);await runtime.trigger({event:'itemUse'});await runtime.advance(1);assert.equal(count,1);assert.equal(runtime.snapshot().errors.length,3);
});
test('storage API round-trips dynamic properties, tags, scores and inventory without changing initial state',()=>{
 const seed={player:{realm:6},world:{mode:'hard'},tags:['ready'],inventory:[{typeId:'demo:coin',amount:2}]},copy=structuredClone(seed),runtime=createBedrockRuntime({seed}),{world}=runtime.server,player=world.getAllPlayers()[0];assert.equal(player.getDynamicProperty('realm'),6);player.setDynamicProperty('realm',7);assert.equal(world.getDynamicProperty('mode'),'hard');assert.equal(player.hasTag('ready'),true);player.addTag('claimed');const objective=world.scoreboard.addObjective('quests');objective.setScore(player.scoreboardIdentity,3);objective.addScore(player.scoreboardIdentity,2);assert.equal(objective.getScore(player.scoreboardIdentity),5);const inventory=player.getComponent('minecraft:inventory').container;inventory.addItem(new runtime.server.ItemStack('demo:coin',3));assert.equal(inventory.getItem(0).amount,5);inventory.getItem(0).amount=99;assert.equal(inventory.getItem(0).amount,5);assert.deepEqual(seed,copy);assert.equal(runtime.snapshot().state.player.realm,7);assert.ok(runtime.snapshot().reads.some(read=>read.id==='player:realm'&&read.write));
});
test('HUD and chat preserve rawtext and only supported commands report success',()=>{
 const output=[],runtime=createBedrockRuntime({emit:message=>output.push(message)}),player=runtime.server.world.getAllPlayers()[0];player.onScreenDisplay.setTitle('标题',{subtitle:'副标题'});player.onScreenDisplay.setActionBar('动作栏');player.sendMessage({rawtext:[{text:'toast.'},{text:'图标$背景$文字'}]});player.runCommand('titleraw @s title {"rawtext":[{"text":"新标题"}]}');player.runCommand('scoreboard objectives add test dummy');player.runCommand('scoreboard players set @s test 6');assert.equal(runtime.snapshot().hud.title,'新标题');assert.equal(runtime.snapshot().hud.messages[0].text,'toast.图标$背景$文字');assert.equal(runtime.snapshot().state.scores.test.Player,6);assert.equal(player.runCommand('structure load unknown').successCount,0);assert.ok(runtime.snapshot().unsupported.some(row=>row.api.includes('structure')));assert.ok(output.some(row=>row.type==='hud'));
});
test('unknown APIs return documented empty values and aggregate call counts with source stacks',()=>{
 const runtime=createBedrockRuntime(),player=runtime.server.world.getAllPlayers()[0];player.playSound('test');player.playSound('test');assert.deepEqual(runtime.server.world.getDimension('overworld').getEntities(),[]);const row=runtime.snapshot().unsupported.find(row=>row.api==='Player.playSound');assert.equal(row.count,2);assert.match(row.stack,/script-runtime.test.js/);
});
test('ES module errors preserve the imported package path for the script viewer',()=>{
 const runtime=createBedrockRuntime(),loader=createScriptLoader({Babel,runtime,sources:{'P/main.js':`import './bad.js'`,'P/bad.js':'export const = broken'}});assert.throws(()=>loader.load('P/main.js'),error=>error.file==='P/bad.js'&&error.loc.line===1);
});

test('non-button action elements do not consume response indices',async()=>{
 const runtime=createBedrockRuntime(),player=runtime.server.world.getAllPlayers()[0];let result;new runtime.ui.ActionFormData().header('标题').button('甲').divider().label('说明').button('乙').show(player).then(value=>result=value);const form=runtime.snapshot().form;assert.equal(form.buttons.length,2);assert.equal(form.elements[4].index,1);await runtime.respond({id:form.id,selection:1});assert.equal(result.selection,1);
});
test('before-event cancellation suppresses after-event dispatch and dimension changes keep the previous dimension',async()=>{
 const runtime=createBedrockRuntime(),world=runtime.server.world;let after=0,change;world.beforeEvents.itemUse.subscribe(event=>event.cancel=true);world.afterEvents.itemUse.subscribe(()=>after++);world.afterEvents.playerDimensionChange.subscribe(event=>change=event);await runtime.trigger({event:'itemUse',item:'test:book'});assert.equal(after,0);await runtime.trigger({event:'playerDimensionChange',dimension:'nether'});await runtime.trigger({event:'playerDimensionChange',dimension:'the_end'});assert.equal(change.fromDimension.id,'minecraft:nether');assert.equal(change.toDimension.id,'minecraft:the_end');
});
test('dynamic imports use the same package-only resolver',async()=>{
 const runtime=createBedrockRuntime(),loader=createScriptLoader({Babel,runtime,sources:{'P/main.js':`export const read=async()=>{const lib=await import('./lib.js');return lib.value;};`,'P/lib.js':'export const value=42;'}});assert.equal(await loader.load('P/main.js').read(),42);
});

test('vanilla item triggers are offered even without local item definitions',()=>{
 const project={items:[],sources:{'P/main.js':`const BOOK='minecraft:book';world.afterEvents.itemUse.subscribe(event=>{if(event.itemStack.typeId===BOOK)open();});`}};const result=actionCandidates(project,['P/main.js'],[{name:'itemUse',phase:'before'},{name:'itemUse',phase:'after'}]);assert.equal(result.length,1);assert.equal(result[0].item,'minecraft:book');assert.equal(result[0].phase,undefined);
});

test('oversized forms fail in the script runtime instead of crashing the existing collection renderer',async()=>{
 const runtime=createBedrockRuntime(),form=new runtime.ui.ActionFormData();for(let i=0;i<501;i++)form.button(String(i));await assert.rejects(form.show(runtime.server.world.getAllPlayers()[0]),/500/);assert.equal(runtime.snapshot().form,null);
});
test('non-Error module throws retain their message and file',()=>{
 const runtime=createBedrockRuntime(),loader=createScriptLoader({Babel,runtime,sources:{'P/main.js':`throw 'custom failure';`}});assert.throws(()=>loader.load('P/main.js'),error=>error.message==='custom failure'&&error.file==='P/main.js');
});
