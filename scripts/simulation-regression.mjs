// Stage-three containers, formats, matrices and presets. Local app :5173, Chromium CDP :9222.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [addon,dependency,vanillaArchive]=process.argv.slice(2);
if(!addon||!dependency||!vanillaArchive)throw Error('Usage: node scripts/simulation-regression.mjs <reference.mcaddon> <server_form.json> <full-vanilla.zip>');
const target=await(await fetch('http://127.0.0.1:9222/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
let sequence=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const waitFor=async expression=>{for(let i=0;i<80;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression);};
const upload=async(selector,path)=>{const {root}=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector});await send('DOM.setFileInputFiles',{nodeId,files:[path]});};
const source=()=>evaluate("document.getElementById('source').value");
const displayed=value=>value.replace(/\r\n/g,'\n');
const prop=async(key,value)=>evaluate(`(()=>{const input=[...document.querySelectorAll('#properties label')].find(el=>el.firstChild.textContent===${JSON.stringify(key)})?.querySelector('input');if(!input)throw Error('Missing property');input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('change'));})()`);
const select=async name=>evaluate(`(()=>{const button=[...document.querySelectorAll('#tree button')].find(b=>b.textContent===${JSON.stringify(name)});if(!button)throw Error('Missing row');button.click();})()`);
const importText=async(text,name='safe-edit.json',archive=false)=>{
 await evaluate(`(async()=>{let content=${JSON.stringify(text)};${archive?"const zip=new JSZip();zip.file('P/ui/test.json',content);zip.file('.easysee/project.json',JSON.stringify({version:1,generatedFiles:{'P/ui/test.json':true}}));content=await zip.generateAsync({type:'uint8array'});":''}const dt=new DataTransfer();dt.items.add(new File([content],${JSON.stringify(name)}));const input=document.getElementById('files');document.getElementById('import').click();input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
 await waitFor(`document.getElementById('project').textContent===${JSON.stringify(name)}`);await waitFor("!document.getElementById('vanilla').disabled");
};
const review=async()=>{await evaluate("document.getElementById('export').click();document.querySelectorAll('#exportChanges details').forEach(el=>el.open=true)");await new Promise(r=>setTimeout(r,50));return evaluate("({summary:document.getElementById('exportSummary').textContent,changes:document.getElementById('exportChanges').textContent,drafts:document.getElementById('exportDrafts').textContent})");};
const cancel=()=>evaluate("document.getElementById('cancelExport').click()");
const beginDownloads=()=>evaluate("window.__downloads=[];HTMLAnchorElement.prototype.click=function(){window.__downloads.push({name:this.download,url:this.href})}");
const downloadText=async action=>{
 await beginDownloads();await action();await waitFor('window.__downloads.length===1');
 return evaluate("(async()=>{const d=window.__downloads[0],content=await new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('GET',d.url);x.responseType='arraybuffer';x.onload=()=>resolve(new TextDecoder('utf-8',{ignoreBOM:true}).decode(x.response));x.onerror=reject;x.send()});return {...d,content};})()");
};
const waitLong=async expression=>{for(let i=0;i<600;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression);};
const sim=()=>evaluate("JSON.parse(document.getElementById('simulation').value)");
const setSim=async value=>evaluate(`document.getElementById('simulation').value=${JSON.stringify(JSON.stringify(value))};document.getElementById('simulate').click()`);
const route=async term=>evaluate(`(()=>{const row=[...document.querySelectorAll('#tree [data-route]')].find(el=>el.textContent.includes(${JSON.stringify(term)}));if(!row)throw Error('No route '+${JSON.stringify(term)});row.click();})()`);
const downloadBytes=async action=>{await beginDownloads();await action();await waitLong('window.__downloads.length===1');return evaluate("(async()=>{const entry=window.__downloads[0],bytes=await new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('GET',entry.url);x.responseType='arraybuffer';x.onload=()=>resolve(x.response);x.onerror=reject;x.send()});window.__stage3Downloaded=bytes;return {name:entry.name,size:bytes.byteLength};})()");};
try{
 await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1700,height:1200,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:5173'});await waitFor("document.querySelectorAll('.control').length>0");await evaluate("document.getElementById('editMode').click()");
 await evaluate("window.fetch=async()=>{throw Error('Offline simulation regression')}");
 await upload('#files',addon);await waitLong("document.getElementById('project').textContent.includes('武破')");await waitLong("!document.getElementById('vanilla').disabled");
 await evaluate("document.getElementById('dependency').click()");await upload('#files',dependency);await waitLong("document.getElementById('project').textContent.includes('武破')&&document.getElementById('project').textContent.endsWith(' +1 依赖')");await waitLong("!document.getElementById('vanilla').disabled");
 console.log('Loaded project');
 await select('hud · ms_boss_panel');await setSim({formTitle:'MSQB:old|stale'});
 const fill=await evaluate("document.querySelector('#channelFields input[data-kind=binary]')!==null");assert.equal(fill,true);
 await evaluate("document.querySelector('#channelFields input[data-kind=binary]').value='0';document.querySelector('#channelFields input[data-kind=binary]').dispatchEvent(new Event('change'))");assert.equal(await evaluate("[...document.querySelectorAll('#canvas .control')].filter(el=>el.dataset.controlName.startsWith('fill_')).length"),0);
 await evaluate("document.querySelector('#channelFields select').value='7';document.querySelector('#channelFields select').dispatchEvent(new Event('change'))");
 await evaluate("document.querySelector('#channelFields input[data-kind=binary]').value='50';document.querySelector('#channelFields input[data-kind=binary]').dispatchEvent(new Event('change'))");
 assert.equal((await sim()).subtitle.slice(8,56),'1'.repeat(24)+'0'.repeat(24));
 assert.equal(await evaluate("[...document.querySelectorAll('#canvas .control')].filter(el=>el.dataset.controlName.startsWith('fill_')).length"),24);
 await evaluate("document.getElementById('presetName').value='首领 50%';document.getElementById('savePreset').click()");
 await evaluate("document.querySelector('#channelFields input[data-kind=binary]').value='100';document.querySelector('#channelFields input[data-kind=binary]').dispatchEvent(new Event('change'))");
 assert.equal(await evaluate("[...document.querySelectorAll('#canvas .control')].filter(el=>el.dataset.controlName.startsWith('fill_')).length"),48);
 await evaluate("document.getElementById('loadSavedPreset').click()");assert.match(await evaluate("document.getElementById('screenName').textContent"),/hud_screen/);assert.equal((await sim()).subtitle.slice(8,56),'1'.repeat(24)+'0'.repeat(24));
 // The normal interface entry must expose the toast template through its factory.
 await select('hud · test_factory');
 assert.equal(await evaluate("document.querySelectorAll('#channelFields input[data-kind=path]').length"),2);
 await evaluate("(()=>{const paths=document.querySelectorAll('#channelFields input[data-kind=path]');paths[0].value='textures/items/kai_trial';paths[1].value='textures/ui/questbook/toast_task';document.querySelector('#channelFields textarea').value='奖励说明';document.getElementById('applyChannelFields').click();})()");
 const toast=(await sim()).bindings['#text'];assert.equal(toast,'toast.'+'textures/items/kai_trial'.padEnd(150,'$')+'textures/ui/questbook/toast_task'.padEnd(50,'$')+'奖励说明');
 assert.ok(await evaluate("document.getElementById('factoryPreviewNote').textContent.includes('只读事件样本')"));
 assert.ok(await evaluate("[...document.querySelectorAll('#canvas .control')].some(el=>el.dataset.controlName==='test@hud.test'&&!el.hidden)"));
 await evaluate("document.getElementById('browseView').value='interfaces';document.getElementById('browseView').dispatchEvent(new Event('change'))");
 const quest={formTitle:'MSQB:realm/kai|开阳',formBody:'第三阶段回归',formButtons:Array.from({length:34},(_,i)=>({text:i<3?'P0分页':i<10?'S0小页':'QX',texture:''}))};quest.formButtons[10]={text:'QCD02节点\n说明',texture:'textures/items/kai_trial'};
 await evaluate(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(quest))}],'sim_qb.json'));const input=document.getElementById('simulationFile');input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
 await waitLong("[...document.getElementById('savedPresets').options].some(option=>option.textContent.startsWith('sim_qb'))");await route('MSQB:');
 await evaluate("document.getElementById('inspectMatrix').click()");await waitLong("document.querySelectorAll('#textureMatrix select option').length>0");
 await evaluate("(()=>{const select=document.querySelector('#textureMatrix select'),option=[...select.options].find(option=>option.textContent.startsWith('textures/ui/questbook/n_'));if(!option)throw Error('Missing node pattern');select.value=option.value;select.dispatchEvent(new Event('change'));})()");
 assert.equal(await evaluate("document.querySelectorAll('#textureMatrix .matrix-cell').length"),12);assert.equal(await evaluate("document.querySelectorAll('#textureMatrix .matrix-cell.missing').length"),0);
 for(const prefix of ['tab_','subtab_']){
  await evaluate(`(()=>{const select=document.querySelector('#textureMatrix select'),option=[...select.options].find(option=>option.textContent.startsWith('textures/ui/questbook/${prefix}'));if(!option)throw Error('Missing tab pattern');select.value=option.value;select.dispatchEvent(new Event('change'));})()`);
  assert.equal(await evaluate("document.querySelectorAll('#textureMatrix .matrix-cell.missing').length"),0,prefix);
 }
 assert.equal(await evaluate("document.querySelectorAll('#stateComparison .state-card').length"),3);
 assert.ok(await evaluate("document.getElementById('controlBudget').textContent.includes('含隐藏分支')"));
 await evaluate("document.getElementById('matrixDetails').open=false");
 console.log('Fields, matrix and presets passed');
 await upload('#vanillaFiles',vanillaArchive);await waitLong("document.getElementById('vanillaStatus').textContent.startsWith('原版资源：')");
 const containers=[];
 for(const pocket of [false,true])for(const [code,name]of [['2','ms_ring.panel_81'],['3','ms_ring.panel_243'],['4','ms_ring_dt.infinity_chest_panel']]){
  await route('标题 = §r§'+code+'§r');
  await evaluate(`document.getElementById('containerDevice').value=${JSON.stringify(pocket?'pocket':'desktop')};document.getElementById('applyContainer').click()`);
  assert.equal(await evaluate("[...document.querySelectorAll('#canvas .control')].filter(el=>/container_item_lock_(red|yellow)|item_lock_cell_image/.test(el.dataset.controlName)&&!el.hidden).length"),0);
  if(!pocket&&code==='2'){
   const layout=await evaluate("(()=>{const controls=[...document.querySelectorAll('#canvas .control')],find=name=>controls.find(el=>el.dataset.controlName===name),inventory=find('inventory_grid'),hotbar=find('hotbar_grid@common.hotbar_grid_template'),cell=controls.find(el=>el.dataset.controlName==='cell_image@common.cell_image'),art=find('gui_art');return {title:find('chest_label@chest.chest_label')?.textContent,titleColor:find('chest_label@chest.chest_label')?.style.color,label:find('inventory_label@chest.chest_label')?.textContent,inventoryX:inventory?.style.left,hotbarX:hotbar?.style.left,cellWidth:cell?.style.width,cellHeight:cell?.style.height,artX:parseFloat(art?.style.left),folded:document.getElementById('containerRuntimeIssues')?.open,foldedCount:document.querySelectorAll('#containerRuntimeIssues .issue').length,looseInfo:[...document.querySelectorAll('#issues > .issue.info')].map(el=>el.textContent)}})()");
   assert.equal(layout.title,'须弥戒');assert.equal(layout.titleColor,'rgb(77, 77, 77)');assert.equal(layout.label,'物品栏');assert.equal(layout.inventoryX,layout.hotbarX);assert.equal(layout.cellWidth,'18px');assert.equal(layout.cellHeight,'18px');assert.ok(layout.artX>=0&&layout.artX<=140);assert.equal(layout.folded,false);assert.ok(layout.foldedCount>0);assert.ok(!layout.looseInfo.some(text=>text.includes('#item_renderer_data')));
   const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/easy-see-ring81-fixed.png',Buffer.from(shot.data,'base64'));
  }
  console.log('Container',pocket,code);const chosen=await evaluate("document.getElementById('containerResolved').textContent");assert.ok(chosen.includes(name+(pocket?'_m':'')),chosen);
  const slots=await evaluate("document.querySelectorAll('#canvas .container-slot:not([hidden])').length");assert.ok(slots>=81,chosen+' '+slots);containers.push({pocket,chosen,slots});
 }
 await route('标题 = §r§1§r');assert.match(await evaluate("document.getElementById('containerResolved').textContent"),/灵海戒/);
 await route('标题 = §r§2§r');const value=await sim();await setSim({...value,containerItems:[{name:'开阳试炼',texture:'textures/items/kai_trial',count:12}]});
 assert.ok(await evaluate("document.querySelectorAll('#canvas .slot-preview').length>0"));
 const neutral=await sim();await setSim({...neutral,bindings:{...neutral.bindings,'#item_lock_in_slot':true}});
 assert.ok(await evaluate("[...document.querySelectorAll('#canvas .control')].some(el=>el.dataset.controlName.startsWith('container_item_lock_red')&&!el.hidden)"));
 await setSim(neutral);
 await evaluate("document.getElementById('presetName').value='储物戒手机版';document.getElementById('savePreset').click()");
 await evaluate("document.getElementById('browseView').value='files';document.getElementById('browseView').dispatchEvent(new Event('change'))");
 const files=await evaluate("[...document.querySelectorAll('#tree summary')].map(el=>el.textContent)");for(const file of ['chest_screen.json','ms_ring_panels.json','ms_ring_dongtian.json'])assert.ok(files.some(text=>text.includes(file)),file);
 console.log('Container variants passed');
 const workspace=await downloadBytes(()=>evaluate("document.getElementById('exportWorkspace').click()"));assert.equal(workspace.name,'easy-see-project.zip');
 const metadata=await evaluate(`(async()=>{const zip=await JSZip.loadAsync(window.__stage3Downloaded);window.__stage3Workspace=new File([window.__stage3Downloaded],'stage3-project.zip');return {presets:JSON.parse(await zip.file('.easysee/presets.json').async('string')).presets.length,settings:!!zip.file('.easysee/project.json')};})()`);
 assert.equal(metadata.presets,3);assert.equal(metadata.settings,true);
 await evaluate("(()=>{document.getElementById('import').click();const dt=new DataTransfer();dt.items.add(window.__stage3Workspace);const input=document.getElementById('files');input.files=dt.files;input.dispatchEvent(new Event('change'));})()");await waitLong("document.getElementById('project').textContent==='stage3-project.zip'");
 assert.equal(await evaluate("document.getElementById('savedPresets').options.length"),3);
 await evaluate("(()=>{const select=document.getElementById('savedPresets');select.value=[...select.options].find(option=>option.textContent.startsWith('sim_qb')).value;document.getElementById('loadSavedPreset').click();})()");assert.deepEqual(await sim(),quest);
 await review();const resource=await downloadBytes(()=>evaluate("document.getElementById('confirmExport').click()"));
 const exported=await evaluate(`(async()=>{const zip=await JSZip.loadAsync(window.__stage3Downloaded);return {metadata:Object.keys(zip.files).filter(path=>path.includes('.easysee/')),count:Object.values(zip.files).filter(entry=>!entry.dir).length};})()`);assert.deepEqual(exported.metadata,[]);assert.equal(exported.count,985);
 assert.deepEqual(errors,[]);const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/easy-see-stage-three.png',Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({result:'PASS',containers,metadata,exported,checks:['boss slider 0-100% without manual strings','toast fields through interface factory and read-only sample','named presets and imported sim_qb','12 node-state textures and 3 button states','budget includes hidden branches','six ring layouts without lock overlays, correct cells/labels and folded native diagnostics','container item sprites','all UI files in file view','editor project sidecar round trip','resource export excludes editor metadata','no browser exceptions']},null,2));
}finally{ws.close();await fetch('http://127.0.0.1:9222/json/close/'+target.id);}
