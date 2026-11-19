// Package-derived one-click state samples and reversible preview data. Local app :5173, Chromium CDP :9222.
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
 await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1800,height:1250,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:5173'});await waitFor("document.querySelectorAll('.control').length>0");await evaluate("document.getElementById('editMode').click()");
 await evaluate("window.fetch=async()=>{throw Error('Offline state sample regression')}");
 await upload('#files',addon);await waitLong("document.getElementById('project').textContent.includes('武破')");await waitLong("!document.getElementById('vanilla').disabled");
 await evaluate("document.getElementById('dependency').click()");await upload('#files',dependency);await waitLong("document.getElementById('project').textContent.includes('武破')&&document.getElementById('project').textContent.endsWith(' +1 依赖')");await waitLong("!document.getElementById('vanilla').disabled");
 await upload('#vanillaFiles',vanillaArchive);await waitLong("document.getElementById('vanillaStatus').textContent.startsWith('原版资源：')");
 await select('hud · ms_boss_panel');const sourceBefore=await source(),original=await sim();
 await evaluate("document.getElementById('applyStateSample').click()");assert.match((await sim()).subtitle,/^MSBOSS:/);assert.equal(await evaluate("[...document.querySelectorAll('#canvas .control')].filter(el=>el.dataset.controlName.startsWith('fill_')).length"),24);assert.equal(await evaluate("document.getElementById('sampleMode').dataset.active"),'true');
 const choose=async label=>evaluate(`(()=>{const select=document.getElementById('sampleState'),option=[...select.options].find(option=>option.textContent===${JSON.stringify(label)});if(!option)throw Error('Missing sample '+${JSON.stringify(label)});select.value=option.value;select.dispatchEvent(new Event('change'));})()`);
 await choose('阶段 7 · 100% 填充');assert.equal((await sim()).subtitle.slice(7,8),'7');assert.equal(await evaluate("[...document.querySelectorAll('#canvas .control')].filter(el=>el.dataset.controlName.startsWith('fill_')).length"),48);
 await choose('阶段 1 · 0% 填充');assert.equal(await evaluate("[...document.querySelectorAll('#canvas .control')].filter(el=>el.dataset.controlName.startsWith('fill_')).length"),0);
 await evaluate("document.getElementById('restoreStateSample').click()");assert.deepEqual(await sim(),original);assert.equal(await evaluate("document.getElementById('restoreStateSample').disabled"),true);assert.equal(await source(),sourceBefore);
 // A manually applied value, its un-applied JSON draft, and named presets all
 // survive trying a derived state and pressing Restore.
 const manual={subtitle:'MSBOSS:4'+'1'.repeat(12)+'0'.repeat(36)+'真实模拟数据',title:'保留状态',bindings:{'#custom':42}};await setSim(manual);
 await evaluate("document.getElementById('presetName').value='手动数据';document.getElementById('savePreset').click()");
 const presetsBefore=await downloadText(()=>evaluate("document.getElementById('exportPresets').click()"));
 const draft=JSON.stringify({...manual,subtitle:'尚未应用的草稿'},null,4);await evaluate(`document.getElementById('simulation').value=${JSON.stringify(draft)}`);
 await evaluate("document.getElementById('applyStateSample').click();document.getElementById('restoreStateSample').click()");assert.equal(await evaluate("document.getElementById('simulation').value"),draft);
 // Restore the textarea to the already applied value without applying a new one.
 await evaluate(`document.getElementById('simulation').value=${JSON.stringify(JSON.stringify(manual))}`);
 const presetsAfter=await downloadText(()=>evaluate("document.getElementById('exportPresets').click()"));assert.equal(presetsAfter.content,presetsBefore.content);
 await evaluate("document.getElementById('applyStateSample').click()");await setSim(manual);assert.equal(await evaluate("document.getElementById('restoreStateSample').disabled"),true);
 await route('MSQB:');assert.equal(await evaluate("document.getElementById('previewStatus').dataset.kind"),'missing-buttons');
 await evaluate("[...document.querySelectorAll('#previewStatus button')].find(button=>button.textContent.includes('一键预览')).click()");
 await evaluate("document.getElementById('preset').value='quest';document.getElementById('preset').dispatchEvent(new Event('change'))");
 const mixed=await sim();assert.equal(mixed.formButtons.length,34);assert.ok(await evaluate("document.getElementById('previewStatus').hidden"));
 assert.equal(await evaluate("document.querySelectorAll('#canvas .control[data-missing-index]').length"),0);
 const invalid=await evaluate("[...document.querySelectorAll('#issues .issue')].map(el=>el.textContent).filter(text=>new RegExp('textures/ui/questbook/(g_|n_|o_|tip_|tab_|subtab_)').test(text))");assert.deepEqual(invalid,[]);
 await evaluate("(()=>{const select=document.getElementById('sampleGroup');select.value=[...select.options].find(option=>option.textContent.startsWith('n_ ')).value;select.dispatchEvent(new Event('change'));})()");
 const choices=await evaluate("[...document.getElementById('sampleState').options].map(option=>option.textContent)");assert.equal(choices.length,17);assert.ok(choices.some(label=>label.includes('可领取')));assert.ok(choices.some(label=>label.includes('锁定')));
 const shapesBefore=(await sim()).formButtons.slice(10).map(button=>button.text.slice(0,2));await choose(choices.find(label=>label.startsWith('全部可领取')));assert.deepEqual((await sim()).formButtons.slice(10).map(button=>button.text.slice(0,2)),shapesBefore);assert.ok((await sim()).formButtons.slice(10).every(button=>button.text[2]==='R'));
 await choose(choices.find(label=>label.includes('QCR')));const ready=await sim();assert.ok(ready.formButtons.slice(10).every(button=>button.text.startsWith('QCR')));assert.ok(await evaluate("document.getElementById('sampleMode').textContent.includes('示例模式')"));
 await evaluate("document.getElementById('mode').value='preview';document.getElementById('mode').dispatchEvent(new Event('change'))");
 const button=await evaluate("(()=>{const el=[...document.querySelectorAll('#canvas .control')].find(el=>el.dataset.controlName==='n0@ms_questbook.node');const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:button.x,y:button.y});
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/easy-see-pack-state-samples.png',Buffer.from(shot.data,'base64'));
 await choose(choices.find(label=>label.includes('QX')));assert.ok((await sim()).formButtons.slice(10).every(button=>button.text==='QX'));
 const hiddenTextures=await evaluate("[...document.querySelectorAll('#issues .issue')].map(el=>el.textContent).filter(text=>new RegExp('textures/ui/questbook/(g_|n_|o_|tip_)').test(text))");assert.deepEqual(hiddenTextures,[]);
 const questSource=await source();await evaluate("document.getElementById('restoreStateSample').click()");assert.equal((await sim()).formButtons?.length||0,0);assert.equal(await source(),questSource);
 await select('hud · ms_cold_panel');await evaluate("document.getElementById('applyStateSample').click()");assert.ok((await sim()).subtitle.startsWith('MSCOLD:'));
 const warmLabel=await evaluate("[...document.getElementById('sampleState').options].find(option=>option.textContent.includes('暖')).textContent");await choose(warmLabel);const warm=(await sim()).subtitle;assert.equal(warm.slice(7,27),'w'.repeat(20));assert.equal(warm[27],'h');
 await select('hud · ms_frost_overlay');await evaluate("document.getElementById('applyStateSample').click()");assert.equal((await sim()).subtitle[28],'1');
 await select('hud · test_factory');await evaluate("document.getElementById('applyStateSample').click()");const toast=(await sim()).bindings['#text'];assert.ok(toast.startsWith('toast.'));assert.ok(toast.slice(6,156).replaceAll('$','').startsWith('textures/items/'));assert.ok(toast.slice(156,206).replaceAll('$','').includes('toast_'));
 await select('hud · ms_status_panel');await evaluate("document.getElementById('applyStateSample').click()");assert.ok((await sim()).title.startsWith('MSHUD:'));await choose('多行文字');assert.ok((await sim()).title.includes('\n'));
 await route('标题 = §r§2§r');await evaluate("(()=>{const select=document.getElementById('sampleGroup');select.value='containers';select.dispatchEvent(new Event('change'));const state=document.getElementById('sampleState'),option=[...state.options].find(option=>option.textContent.includes('§r§3§r')&&option.textContent.endsWith('手机'));state.value=option.value;state.dispatchEvent(new Event('change'));})()");assert.equal((await sim()).containerTitle,'§r§3§r');assert.equal((await sim()).touch,true);assert.match(await evaluate("document.getElementById('containerResolved').textContent"),/panel_243_m/);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',questChoices:choices,mixedButtons:mixed.formButtons.length,toast:toast.slice(156,206).replaceAll('$',''),checks:['boss one-click 0/50/100 and stage changes','original data and unapplied draft restore','named presets unchanged','manual application exits example mode','34 package-derived quest buttons without invalid textures','12 node states with resource-derived labels','cold/warm frame pairing and frost levels','toast package backgrounds and padded fields','multi-line status examples','container raw-title mobile variants','source unchanged','no browser exceptions']},null,2));
}finally{ws.close();await fetch('http://127.0.0.1:9222/json/close/'+target.id);}
