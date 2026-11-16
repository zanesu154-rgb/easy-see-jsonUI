// Regression for the supplied V1.8.81 reference pack. Requires local app :5173 and Chromium CDP :9222.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [addon,dependency,vanillaPreview,looseTextures] = process.argv.slice(2);
if(!addon||!dependency)throw Error('Usage: node scripts/reference-regression.mjs <V1.8.81.mcaddon> <server_form.json> [vanilla-preview.zip] [guji.zip]');
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => {ws.onopen = resolve; ws.onerror = reject;});
let sequence = 0;
const pending = new Map(), errors = [];
ws.onmessage = event => {const message = JSON.parse(event.data); if(message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails); const p = pending.get(message.id); if(p){pending.delete(message.id); message.error ? p.reject(message.error) : p.resolve(message.result);}};
const send = (method, params = {}) => new Promise((resolve, reject) => {const id = ++sequence; pending.set(id, {resolve,reject}); ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => {const r = await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true}); if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value;};
const waitFor = async expression => {for(let i=0;i<60;i++){if(await evaluate(expression))return; await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression);};
let addedTextures=0;
const upload=async(selector,path)=>{const doc=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});await send('DOM.setFileInputFiles',{nodeId,files:[path]});};
const simulate=async value=>evaluate(`document.getElementById('simulation').value=${JSON.stringify(JSON.stringify(value))};document.getElementById('simulate').click()`);
const clickTree=async text=>evaluate(`(()=>{const row=[...document.querySelectorAll('#tree button')].find(el=>el.textContent.includes(${JSON.stringify(text)}));if(!row)throw Error('Missing tree row: '+${JSON.stringify(text)});row.click()})()`);
const screenshot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/easy-see-'+name+'.png',Buffer.from(r.data,'base64'));};
try {
 await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1100,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:5173'});
 await waitFor("document.querySelectorAll('.control').length > 0");
 await evaluate("window.fetch=async()=>{throw Error('Offline import regression')}");
 const started=Date.now();await upload('#files',addon);
 await waitFor("document.getElementById('project').textContent.includes('武破')");
 const importMs=Date.now()-started;await evaluate("window.__originalAddon=document.getElementById('files').files[0]");
 await evaluate("document.getElementById('dependency').click()");
 await upload('#files',dependency);
 await waitFor("document.getElementById('project').textContent==='server_form.json'");
 await evaluate("window.__originalDependency=document.getElementById('files').files[0]");
 await waitFor("!document.getElementById('vanilla').disabled");
 if(looseTextures){
  await evaluate("document.getElementById('dependency').click()");await upload('#files',looseTextures);
  await waitFor("document.getElementById('project').textContent==='guji.zip'");
  await evaluate("window.__originalTextures=document.getElementById('files').files[0]");
  addedTextures=await evaluate("(async()=>Object.values((await JSZip.loadAsync(window.__originalTextures)).files).filter(e=>!e.dir).length)()");
  await waitFor("!document.getElementById('vanilla').disabled");
 }
 const custom=await evaluate("[...document.querySelectorAll('#tree details summary')].map(e=>e.textContent).filter(s=>s.includes('自定义控件'))");
 assert.match(custom.join(),/5/);
 const titles=await evaluate("[...document.querySelectorAll('#tree button')].filter(el=>el.textContent.startsWith('◇')).map(el=>el.textContent)");
 assert.ok(titles.includes('◇ MSQB:…|…'));assert.ok(titles.some(t=>t.includes('武道修改器')));assert.ok(titles.every(t=>!t.includes('§')));assert.ok(!titles.some(t=>/^◇ (form|f|d|detailForm)$/.test(t)));
 await simulate({subtitle:'MSBOSS:3'+'1'.repeat(24)+'0'.repeat(24)+'§l§c开阳宗主·烈千阳'});
 await clickTree('hud · ms_boss_panel');
 assert.equal(await evaluate("[...document.querySelectorAll('#canvas .control')].filter(e=>e.dataset.controlName.startsWith('fill_')).length"),24);
 const blood=await evaluate("[...document.querySelectorAll('#canvas .control')].filter(e=>e.dataset.controlName.startsWith('fill_')).map(e=>({name:e.dataset.controlName,size:e.style.backgroundSize,position:e.style.backgroundPosition}))");
 assert.ok(blood.every(x=>x.size==='144px 5px'));assert.equal(blood.at(-1).position,'-69px 0px');
 assert.match(await evaluate("document.getElementById('controlStats').textContent"),/未建隐藏 24/);
 assert.match(await evaluate("document.getElementById('issues').textContent"),/未发现已知问题/);
 await screenshot('reference-boss');
 await simulate({subtitle:'MSCOLD:'+'c'.repeat(10)+'w'.repeat(10)+'n0寒意回归'});await clickTree('hud · ms_cold_panel');
 const cold=await evaluate("[...document.querySelectorAll('#canvas .control')].filter(e=>/^cell_(cold|warm|half)_/.test(e.dataset.controlName)).map(e=>e.dataset.controlName)");
 assert.equal(cold.length,20);assert.equal(cold.filter(n=>n.startsWith('cell_cold')).length,10);assert.equal(cold.filter(n=>n.startsWith('cell_warm')).length,10);
 assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-control-name=ms_cold_stage]')).fontSize"),'7.65px');
 await simulate({title:'MSHUD:境界：炼体\n气血：100 / 100'});await clickTree('hud · ms_status_panel');
 const rect=()=>evaluate("(()=>{const e=document.querySelector('[data-control-name=ms_status_panel]');return {w:parseFloat(e.style.width),h:parseFloat(e.style.height),slice:e.style.borderImageSlice}})()");
 const before=await rect();assert.equal(before.slice,'4 fill');
 await simulate({title:'MSHUD:境界：炼体\n气血：100 / 100\n经验：999 / 1000'});
 const after=await rect();assert.ok(after.h>before.h);assert.ok(after.w>=before.w);assert.ok(after.w<=162.1);
 await screenshot('reference-status');
 const sim={formTitle:'MSQB:realm/kai|秘境',formBody:'开阳页 · 构造回归数据',formButtons:[
 {text:'P0成就',texture:'textures/items/treasure'},{text:'P1秘境',texture:'textures/items/kai_trial'},{text:'P0任务',texture:'textures/items/forgotten_book'},
 ...['S0冰河渡口','S0焚天炉','S0天权','S0玉衡','S1开阳','SX','SX'].map(text=>({text,texture:''})),
 ...Array.from({length:24},()=>({text:'QX',texture:''}))]};
 for(const [slot,code,name,texture]of [[0,'QCD','幽火照夜','textures/items/kai_trial'],[1,'QTA','开阳残卷','textures/items/kai_trial'],[2,'QTR','开阳旧事','textures/items/kai_trial'],[8,'QGA','焰灵','textures/items/kai_trial'],[14,'QTL','忠息','textures/items/kai_trial'],[15,'QCR','烈阳不坠','textures/items/kai_trial'],[16,'QCD','力可通神','textures/items/kai_trial']])sim.formButtons[10+slot]={text:code+'02§6'+name+'\n§7回归测试说明',texture};
 await writeFile('/tmp/easy-see-reference-simulation.json',JSON.stringify(sim));
 await upload('#simulationFile','/tmp/easy-see-reference-simulation.json');
 await waitFor("document.getElementById('simulation').value.includes('构造回归数据')");
 await clickTree('long_form');
 await waitFor("document.getElementById('screenName').textContent.endsWith('/ui/server_form.json')");
 await clickTree('◇ MSQB:…|…');
 assert.match(await evaluate("document.getElementById('screenName').textContent"),/自定义表单/);
 assert.equal(await evaluate("document.querySelectorAll('#canvas .control').length"),135);
 await clickTree('long_form');
 const qb=await evaluate("({collectionStats:document.getElementById('collectionStats').textContent,stats:document.getElementById('controlStats').textContent,issues:document.getElementById('issues').textContent,nodes:document.querySelectorAll('#canvas .control').length,visibleTips:[...document.querySelectorAll('#canvas .control')].filter(el=>el.dataset.controlName.startsWith('tip@')&&!el.closest('[hidden]')).length})");
 assert.match(qb.collectionStats,/按钮数据 34 项 · 当前集合按钮 34 个（显示 15 · 隐藏 19）/);
 assert.equal(qb.visibleTips,0);assert.ok(qb.nodes<400);assert.ok(!qb.issues.includes('动态绑定需要游戏数据'));assert.ok(!qb.issues.includes('collection_panel'));assert.ok(!qb.issues.includes('offset 应为'));
 const sourceBefore=await evaluate("document.getElementById('source').value");
 const itemSource=await evaluate("(()=>{const e=[...document.querySelectorAll('#canvas .control')].find(e=>e.dataset.controlName==='icon'&&e.style.backgroundImage);e.click();return document.getElementById('properties').textContent})()");
 assert.match(itemSource,/textures\/items\//);
 await evaluate("document.getElementById('mode').value='preview';document.getElementById('mode').dispatchEvent(new Event('change'))");
 const point=await evaluate("(()=>{const e=[...document.querySelectorAll('#canvas .control')].find(el=>el.dataset.controlName.startsWith('node_')&&el.dataset.controlName.includes('@'));if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,name:e.dataset.controlName}})()");
 // Hover an instantiated quest node by its inherited template name.
 const nodePoint=point||await evaluate("(()=>{const e=[...document.querySelectorAll('#canvas [data-button]')].find(el=>el.dataset.controlName.includes('@ms_questbook.node'));const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,name:e.dataset.controlName}})()");
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:nodePoint.x,y:nodePoint.y});
 assert.equal(await evaluate("[...document.querySelectorAll('#canvas .control')].filter(el=>el.dataset.controlName.startsWith('tip@')&&!el.closest('[hidden]')).length"),1);
 await screenshot('reference-quest');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:20,y:100});
 assert.equal(await evaluate("document.getElementById('source').value"),sourceBefore);
 // Simulation JSON remains outside the project's exported files.
 await evaluate("window.__exports=[];HTMLAnchorElement.prototype.click=function(){window.__exports.push(this.href)};document.getElementById('export').click();document.getElementById('confirmExport').click()");
 await waitFor('window.__exports.length===1');
 const exported=await evaluate("(async()=>{const b=await new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('GET',window.__exports[0]);x.responseType='arraybuffer';x.onload=()=>resolve(x.response);x.onerror=reject;x.send()});const z=await JSZip.loadAsync(b);const original=await JSZip.loadAsync(window.__originalAddon);const mismatched=[];for(const e of Object.values(original.files)){if(e.dir)continue;const a=await e.async('uint8array'),b=await z.file(e.name).async('uint8array');if(a.length!==b.length||a.some((v,i)=>v!==b[i]))mismatched.push(e.name)}const dependency=new Uint8Array(await window.__originalDependency.arrayBuffer()),saved=await z.file('MS_RP/ui/server_form.json').async('uint8array');if(dependency.length!==saved.length||dependency.some((v,i)=>v!==saved[i]))mismatched.push('server_form.json');if(window.__originalTextures){const textures=await JSZip.loadAsync(window.__originalTextures);for(const entry of Object.values(textures.files)){if(entry.dir)continue;const path='MS_RP/textures/ui/'+entry.name,a=await entry.async('uint8array'),saved=z.file(path);if(!saved){mismatched.push(path);continue}const b=await saved.async('uint8array');if(a.length!==b.length||a.some((v,i)=>v!==b[i]))mismatched.push(path)}}return {count:Object.values(z.files).filter(e=>!e.dir).length,hasSim:Object.keys(z.files).some(p=>p.includes('reference-simulation')),hasDependency:Boolean(z.file('MS_RP/ui/server_form.json')),mismatched}})()");
 assert.equal(exported.hasSim,false);assert.equal(exported.hasDependency,true);assert.equal(exported.count,985+addedTextures);assert.deepEqual(exported.mismatched,[]);
 if(vanillaPreview){
 await upload('#vanillaFiles',vanillaPreview);
 await waitFor("document.getElementById('vanillaStatus').textContent.startsWith('原版资源：')");
 const withVanilla=await evaluate("({status:document.getElementById('vanillaStatus').textContent,stats:document.getElementById('controlStats').textContent,issues:document.getElementById('issues').textContent})");
 assert.match(withVanilla.issues,/未发现已知问题/);
 console.log('WITH_OFFICIAL_PREVIEW',withVanilla);
 }
 if(looseTextures&&vanillaPreview){
  await simulate({formTitle:'普通表单',formBody:'纸张和按钮贴图测试',formButtons:[{text:'预览按钮',texture:'textures/items/kai_trial'}]});await clickTree('long_form');
  const guji=await evaluate(`(async()=>{const bg=document.querySelector('[data-control-name="bg@server_form.paper_bg"]');if(!bg)throw Error('Missing normal form paper');const image=new Image();image.src=bg.style.backgroundImage.slice(5,-2);await image.decode();const button=document.querySelector('[data-control-name="form_button@common_buttons.light_text_button"]'),paper=bg.getBoundingClientRect(),rect=button.getBoundingClientRect();return {paperWidth:image.naturalWidth,buttons:[...document.querySelectorAll('#canvas [data-control-name=default]')].filter(e=>e.style.backgroundImage).length,instances:document.querySelectorAll('[data-control-name="form_button@common_buttons.light_text_button"]').length,inside:rect.left>=paper.left&&rect.right<=paper.right}})()`);
  assert.ok(guji.paperWidth>1);assert.ok(guji.buttons>0);assert.equal(guji.instances,1);assert.equal(guji.inside,true);
  await screenshot('reference-guji');console.log('GUJI_PREVIEW',guji);
 }
 // Unapplied source is retained across rendering and file switches, then participates in undo.
 await evaluate("document.getElementById('mode').value='edit';document.getElementById('mode').dispatchEvent(new Event('change'))");
 const baseSource=await evaluate("document.getElementById('source').value"),draft=baseSource+'\n// draft not applied';
 await evaluate(`document.getElementById('source').value=${JSON.stringify(draft)};document.getElementById('source').dispatchEvent(new Event('input'));document.getElementById('zoom').value='1';document.getElementById('zoom').dispatchEvent(new Event('change'))`);
 assert.equal(await evaluate("document.getElementById('source').value"),draft);
 await clickTree('hud · ms_status_panel');await clickTree('long_form');
 assert.equal(await evaluate("document.getElementById('source').value"),draft);
 await evaluate("window.__exports=[];document.getElementById('export').click();document.getElementById('confirmExport').click()");await waitFor('window.__exports.length===1');
 const exportedBase=await evaluate("(async()=>{const b=await new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('GET',window.__exports[0]);x.responseType='arraybuffer';x.onload=()=>resolve(x.response);x.onerror=reject;x.send()});return (await JSZip.loadAsync(b)).file('MS_RP/ui/server_form.json').async('string')})()");
 assert.equal(exportedBase,baseSource);
 await evaluate("document.getElementById('apply').click()");assert.equal(await evaluate("document.getElementById('sourceStatus').textContent"),'');
 await evaluate("document.getElementById('undo').click()");assert.equal(await evaluate("document.getElementById('source').value"),baseSource);
 const invalid=JSON.stringify({namespace:'test',main:{type:'panel',controls:[null],bindings:{}}});
 await evaluate(`document.getElementById('source').value=${JSON.stringify(invalid)};document.getElementById('source').dispatchEvent(new Event('input'));document.getElementById('apply').click()`);
 assert.match(await evaluate("document.getElementById('issues').textContent"),/bindings 必须为数组/);
 await evaluate("document.getElementById('undo').click()");assert.equal(await evaluate("document.getElementById('source').value"),baseSource);
 await evaluate("document.getElementById('preset').value='hud';document.getElementById('preset').dispatchEvent(new Event('change'))");
 assert.match(await evaluate("document.getElementById('screenName').textContent"),/hud_screen.json$/);
 assert.equal(await evaluate("Boolean(document.querySelector('[data-control-name=ms_status_panel]'))"),true);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',importMs,custom,titles:titles.length,bloodCells:blood.length,statusBefore:before,statusAfter:after,quest:qb,exported,checks:['real mcaddon and dependency import','custom HUD controls','formatted and dynamic script titles','48-cell boss half-fill and UV','content-sized nine-slice status panel','simulation file import','inactive branch pruning and diagnostics','single quest node hover tooltip','collection item icons','source and export preservation','no browser exceptions']},null,2));
}finally{ws.close();}
