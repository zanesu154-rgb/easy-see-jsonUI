import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleCatalog} from '../src/state-samples.js';
import {inferChannels,channelValue} from '../src/simulation-tools.js';
import {runtimeObject} from '../src/bindings.js';
import {validateSimulation} from '../src/presets.js';
const bytes=obj=>new TextEncoder().encode(JSON.stringify(obj));
function png(w=16,h=16,tag=0){const value=new Uint8Array(25);value.set([137,80,78,71]);const view=new DataView(value.buffer);view.setUint32(16,w);view.setUint32(20,h);value[24]=tag;return value;}
function boss(){return {bindings:[{source_property_name:"(('%.6s' * #hud_subtitle_text_string) = 'BLOOD:')"},{source_property_name:"('textures/life/frame_' + (('%.7s' * #hud_subtitle_text_string) - 'BLOOD:'))"},...Array.from({length:48},(_,i)=>({source_property_name:`(('%.${i+8}s' * #hud_subtitle_text_string) = (('%.${i+7}s' * #hud_subtitle_text_string) + '1'))`})),{source_property_name:"(#hud_subtitle_text_string - ('%.55s' * #hud_subtitle_text_string))"}]};}
function buttonFixture(){
 const image=(prefix,source)=>({type:'image',bindings:[{source_property_name:`('textures/widgets/${prefix}_' + ${source})`,target_property_name:'#texture'}]});
 const obj={type:'panel',controls:[{line:{collection_name:'form_buttons',collection_index:0,...image('line',"(('%.3s' * #form_button_text) - ('%.2s' * #form_button_text))")}},{first:{type:'button',collection_name:'form_buttons',collection_index:0,controls:[{bg:image('pin',"('%.3s' * #form_button_text)")}]}},{second:{type:'button',collection_name:'form_buttons',collection_index:1,controls:[{bg:image('pin',"('%.3s' * #form_button_text)")}]}}]};
 const files=new Map([['RP/textures/widgets/pin_ZAR.png',png(26,26,1)],['RP/textures/widgets/node_quest_ready.png',png(26,26,1)],['RP/textures/widgets/pin_ZAD.png',png(26,26,2)],['RP/textures/widgets/line_R.png',png(2,2,3)],['RP/textures/widgets/line_D.png',png(2,2,4)],['RP/textures/items/book.png',png()]]);return {obj,files};
}
test('one-click binary states derive stages and preserve explicit binding precedence',()=>{
 const obj=boss(),files=new Map([['RP/textures/life/frame_2.png',png()],['RP/textures/life/frame_9.png',png(16,16,9)]]),groups=sampleCatalog(obj,files,'RP/ui/hud.json'),original={title:'保留',subtitle:'旧值',bindings:{'#hud_subtitle_text_string':'BLOOD:9manual','#other':7}};
 assert.equal(groups[0].recipes.length,11);
 const half=groups[0].recipes[0].make(original);assert.equal(half.subtitle.slice(0,7),'BLOOD:2');assert.equal(half.subtitle.slice(7,55),'1'.repeat(24)+'0'.repeat(24));assert.equal(half.bindings['#hud_subtitle_text_string'],half.subtitle);assert.equal(channelValue(half,'#hud_subtitle_text_string'),half.subtitle);assert.equal(half.title,'保留');assert.equal(original.subtitle,'旧值');assert.equal(half.bindings['#other'],7);
 const full=groups[0].recipes.find(recipe=>recipe.label==='阶段 9 · 100% 填充').make(original);assert.equal(full.subtitle.slice(7,55),'1'.repeat(48));validateSimulation(full);
});
test('button examples combine decorative consumers before buttons and use package aliases for readable states',()=>{
 const {obj,files}=buttonFixture(),groups=sampleCatalog(obj,files,'RP/ui/a.json',{formTitle:'CUSTOM:示例',titleMatches:title=>title.startsWith('CUSTOM:')}),mixed=groups[0].recipes[0].make({});
 assert.equal(mixed.formButtons.length,2);assert.ok(mixed.formButtons.every(button=>/^ZA[RD]/.test(button.text)));assert.equal(mixed.formTitle,'CUSTOM:示例');
 const states=groups.find(group=>group.recipes.some(recipe=>recipe.source==='textures/widgets/pin_ZAR'));assert.ok(states.recipes.some(recipe=>recipe.label.includes('可领取')));
 const original={formTitle:'CUSTOM:真实页',formBody:'实际说明',formButtons:[{text:'ZAD真实说明',texture:'textures/items/own',extra:42}]};
 const ready=states.recipes.find(recipe=>recipe.source.endsWith('ZAR')).make(original);assert.equal(ready.formButtons[0].text,'ZAR真实说明');assert.equal(ready.formButtons[0].texture,'textures/items/own');assert.equal(ready.formButtons[0].extra,42);assert.equal(ready.formTitle,original.formTitle);assert.equal(original.formButtons[0].text,'ZAD真实说明');
});
test('literal tab_on assets cannot become coded tab states',()=>{
 const {files}=buttonFixture(),obj={type:'button',collection_name:'form_buttons',collection_index:0,bindings:[{source_property_name:"('textures/widgets/tab_' + ('%.2s' * #form_button_text))"}]};
 for(const code of ['P0','P1','on','off','hover'])files.set('RP/textures/widgets/tab_'+code+'.png',png(30,20,code.charCodeAt(0)));
 const groups=sampleCatalog(obj,files,'RP/ui/a.json'),states=groups[1];assert.deepEqual(states.recipes.map(recipe=>recipe.source),['textures/widgets/tab_P0','textures/widgets/tab_P1']);
});
test('sequence examples pair matching cold/warm frames from literal image conditions',()=>{
 const obj={bindings:[{source_property_name:"(('%.8s' * #hud_subtitle_text_string) = 'WEATHER:')"}],controls:[]};
 const condition=(end,char)=>`(('%.${end}s' * #hud_subtitle_text_string) = (('%.${end-1}s' * #hud_subtitle_text_string) + '${char}'))`;
 for(let i=0;i<20;i++)for(const [code,name]of [['c','cold'],['w','warm'],['x','half']])obj.controls.push({['cell'+i+code]:{type:'image',texture:'textures/cell_'+name,bindings:[{source_property_name:condition(i+9,code),target_property_name:'#visible'}]}});
 for(const [code,name]of [['n','normal'],['c','cold'],['h','warm']])obj.controls.push({['frame'+code]:{type:'image',texture:'textures/frame_'+name,bindings:[{source_property_name:condition(29,code),target_property_name:'#visible'}]}});
 const schema=inferChannels(obj)[0];assert.equal(schema.fields[1].allowed,'chn');
 const group=sampleCatalog(obj,new Map(),'RP/ui/hud.json')[0],warm=group.recipes.find(recipe=>recipe.label.includes('暖')).make({});assert.equal(warm.subtitle.slice(8,28),'w'.repeat(20));assert.equal(warm.subtitle[28],'h');
});
test('toast samples use imported icon/background resources and fixed field padding',()=>{
 const obj={bindings:[{source_property_name:"(('%.6s' * #text) = 'toast.')"},{source_property_name:"(#text - 'toast.')",target_property_name:'#rest'},{source_property_name:"('%.150s' * #rest)",target_property_name:'#icon'},{source_property_name:"(#icon - '$')",target_property_name:'#icon_path'},{source_property_name:"(('%.200s' * #rest) - #icon)",target_property_name:'#bg'},{source_property_name:"(#bg - '$')",target_property_name:'#bg_path'}]};
 const files=new Map([['RP/textures/items/key.png',png()],['RP/textures/ui/toast_prize.png',png(160,32)],['RP/textures/ui/other_strip.png',png(160,32,3)]]),groups=sampleCatalog(obj,files,'RP/ui/hud.json'),sample=groups[0].recipes[0].make({bindings:{'#other':1}}).bindings['#text'];
 assert.equal(sample.slice(0,6),'toast.');assert.equal(sample.slice(6,156),'textures/items/key'.padEnd(150,'$'));assert.equal(sample.slice(156,206),'textures/ui/toast_prize'.padEnd(50,'$'));
 assert.equal(sampleCatalog(obj,new Map(),'RP/ui/hud.json').length,0);
});
test('container samples retain raw format codes and synchronize existing device overrides',()=>{
 const route={id:'box',sample:'§r§2§r',label:'81 格',content:'ring.panel'},groups=sampleCatalog({},new Map(),'RP/ui/chest.json',{containers:[route]}),original={bindings:{'$pocket_screen':false,'$container_title':'旧标题'},variables:{'$touch':false},other:12};
 const mobile=groups[0].recipes[1].make(original);assert.equal(mobile.containerTitle,route.sample);assert.equal(mobile.bindings.$pocket_screen,true);assert.equal(mobile.variables.$touch,true);assert.equal(mobile.bindings.$container_title,route.sample);assert.equal(original.variables.$touch,false);assert.equal(mobile.other,12);
});
test('missing state resources and unsupported formats do not invent synthetic texture combinations',()=>{
 const {obj}=buttonFixture();assert.equal(sampleCatalog(obj,new Map(),'RP/ui/a.json').length,0);
 assert.equal(sampleCatalog({type:'panel'},new Map(),'RP/ui/a.json').length,0);assert.doesNotThrow(()=>sampleCatalog({type:'button',collection_index:0,bindings:{}},new Map(),'RP/ui/a.json'));
});

test('confirmed hidden prefixes hide every consumer and switching back preserves original descriptions',()=>{
 const {obj,files}=buttonFixture();for(const entry of obj.controls)for(const item of Object.values(entry))item.bindings=[...(item.bindings||[]),{source_property_name:"(not (('%.2s' * #form_button_text) = 'ZX'))",target_property_name:'#visible'}];
 const groups=sampleCatalog(obj,files,'RP/ui/a.json'),group=groups.find(group=>group.recipes.some(recipe=>recipe.label.includes('ZX'))),original={formButtons:[{text:'ZAD实际文字',texture:'textures/items/book'},{text:'ZAR第二项'}]};
 const hidden=group.recipes.find(recipe=>recipe.label.includes('ZX')).make(original);assert.ok(hidden.formButtons.every(button=>button.text==='ZX'));
 for(const entry of obj.controls)for(const item of Object.values(entry))assert.equal(runtimeObject(item,null,hidden).visible,false);
 const ready=group.recipes.find(recipe=>recipe.source==='textures/widgets/pin_ZAR').make(hidden,original);assert.equal(ready.formButtons[0].text,'ZAR实际文字');assert.equal(original.formButtons[0].text,'ZAD实际文字');
});
test('ordinary form factories can preview example items without a pre-existing collection',async()=>{
 const {instantiateCollections}=await import('../src/collections.js');
 const obj={type:'collection_panel',collection_name:'form_buttons',factory:{control_ids:{button:'@form.row'}}},files=new Map([['RP/ui/row.json',bytes({namespace:'form',row:{type:'button',text:'#form_button_text'}})]]),groups=sampleCatalog(obj,files,'RP/ui/main.json'),simulation=groups[0].recipes[0].make({});
 assert.equal(simulation.formButtons.length,4);assert.equal(instantiateCollections({main:obj},files,'RP/ui/main.json',simulation).created,4);assert.equal(obj.controls,undefined);
 assert.equal(channelValue({bindings:{'#text':42}},'#text'),'42');
});

test('semantic state switching retains each shape and real description instead of replacing all shapes',()=>{
 const {obj,files}=buttonFixture();files.set('RP/textures/widgets/node_quest_done.png',png(26,26,2));
 for(const [name,tag]of [['pin_ZBR',3],['node_task_ready',3],['pin_ZBD',4],['node_task_done',4]])files.set('RP/textures/widgets/'+name+'.png',png(26,26,tag));
 const groups=sampleCatalog(obj,files,'RP/ui/a.json'),state=groups.flatMap(group=>group.recipes).find(recipe=>recipe.label.startsWith('全部可领取'));
 const original={formButtons:[{text:'ZBD原文甲',texture:'a'},{text:'ZAD原文乙',texture:'b'}]},next=state.make(original);
 assert.equal(next.formButtons[0].text,'ZBR原文甲');assert.equal(next.formButtons[1].text,'ZAR原文乙');assert.equal(original.formButtons[0].text,'ZBD原文甲');
});


test('unsupported multi-part texture expressions stay manual instead of producing bogus sample paths',()=>{
 const obj={type:'button',collection_name:'form_buttons',collection_index:0,bindings:[{source_property_name:"('textures/ui/n_' + ('%.1s' * #form_button_text) + '_' + ('%.2s' * #form_button_text))",target_property_name:'#texture'}]};
 assert.equal(sampleCatalog(obj,new Map(),'RP/ui/a.json').length,0);
});

test('uniform profiles require compatible resources for every consumer of that state family',()=>{
 const {obj,files}=buttonFixture(),[line,first,second]=obj.controls;line.line.collection_index=1;obj.controls=[first,line,second];files.delete('RP/textures/widgets/line_D.png');
 const groups=sampleCatalog(obj,files,'RP/ui/a.json'),states=groups.find(group=>group.id.startsWith('buttons:textures/widgets/pin_'));
 assert.ok(states.recipes.some(recipe=>recipe.source.endsWith('ZAR')));assert.ok(!states.recipes.some(recipe=>recipe.source.endsWith('ZAD')));
});
