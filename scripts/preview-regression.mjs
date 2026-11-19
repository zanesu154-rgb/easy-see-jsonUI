// Stage-four animation, comparisons, fonts, cache and budget regressions. Local app :5173, Chromium CDP :9222.
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
 await send('Page.navigate',{url:'http://127.0.0.1:5173'});await waitFor("document.querySelectorAll('.control').length>0");await evaluate("document.getElementById('editMode').click()");await send('Page.bringToFront');
 await evaluate("window.fetch=async()=>{throw Error('Offline stage-four regression')}");
 await upload('#files',addon);await waitLong("document.getElementById('project').textContent.includes('武破')");await waitLong("!document.getElementById('vanilla').disabled");
 await evaluate("document.getElementById('dependency').click()");await upload('#files',dependency);await waitLong("document.getElementById('project').textContent.includes('武破')&&document.getElementById('project').textContent.endsWith(' +1 依赖')");await waitLong("!document.getElementById('vanilla').disabled");
 await select('hud · test_factory');
 const original=await source(),toast='toast.'+'textures/items/kai_trial'.padEnd(150,'$')+'textures/ui/questbook/toast_task'.padEnd(50,'$')+'动画 ABC123';
 await setSim({bindings:{'#text':toast}});
 const seek=async time=>evaluate(`document.getElementById('animationTime').value=${time};document.getElementById('animationTime').dispatchEvent(new Event('input'))`);
 const frame=()=>evaluate("(()=>{const el=[...document.querySelectorAll('#canvas .control')].find(el=>el.dataset.controlName==='test@hud.test');return {x:parseFloat(el.style.left),y:parseFloat(el.style.top),hidden:el.hidden}})()");
 await evaluate("window.__animatedNode=[...document.querySelectorAll('#canvas .control')].find(el=>el.dataset.controlName==='test@hud.test')");
 const frames=[];for(const time of [0,1,4.5,5,6]){await seek(time);frames.push(await frame());}
 console.log('Timeline frames',frames,await evaluate("document.getElementById('animationTracks').textContent"));assert.equal(frames[0].x-frames[1].x,204);assert.equal(frames[1].y,4);assert.equal(frames[1].x,frames[2].x);assert.equal(frames[1].x,frames[3].x);assert.equal(frames[4].hidden,true);assert.ok(await evaluate("window.__animatedNode===[...document.querySelectorAll('#canvas .control')].find(el=>el.dataset.controlName==='test@hud.test')"));
 await seek(1);await evaluate("document.getElementById('playAnimation').click()");await waitFor("Number(document.getElementById('animationTime').value)>1.1");await evaluate("document.getElementById('playAnimation').click()");
 const paused=await evaluate("document.getElementById('animationTime').value");await new Promise(r=>setTimeout(r,150));assert.equal(await evaluate("document.getElementById('animationTime').value"),paused);
 await seek(1);await evaluate("document.getElementById('dualPreview').click()");
 assert.equal(await evaluate("document.querySelectorAll('.comparison-card').length"),2);
 const dual=await evaluate("[...document.querySelectorAll('.comparison-card')].map(card=>({device:card.dataset.device,x:parseFloat([...card.querySelectorAll('[data-preview-control]')].find(el=>el.dataset.previewControl==='test@hud.test').style.left),safe:card.querySelector('.safe-area-guide').style.inset}))");
 assert.equal(dual[0].x-dual[1].x,320);assert.ok(dual.every(view=>view.safe==='5%'));
 await evaluate("document.getElementById('homeButton').click()");assert.ok(await evaluate("document.getElementById('comparison').hidden"));
 await evaluate("document.getElementById('homeButton').click()");assert.equal(await evaluate("document.querySelectorAll('.comparison-card').length"),2);
 await seek(0);assert.ok(await evaluate("[...document.querySelectorAll('.comparison-status')].every(el=>Number(el.dataset.outside)>0)"));
 await evaluate("document.getElementById('pixelFont').click()");await waitFor("document.getElementById('fontStatus').textContent.includes('内置 ASCII')");
 assert.ok(await evaluate("document.querySelectorAll('#canvas .bitmap-glyph').length>0"));assert.ok(await evaluate("document.querySelectorAll('#comparison .bitmap-glyph').length>0"));
 assert.equal(await source(),original);
 await evaluate("document.getElementById('dualPreview').click();document.getElementById('animationEnabled').click();document.getElementById('resetFont').click()");
 const quest={formTitle:'MSQB:realm/kai|开阳',formButtons:Array.from({length:34},(_,i)=>({text:i<3?'P0分页':i<10?'S0小页':'QX',texture:''}))};quest.formButtons[10]={text:'QCD02节点',texture:'textures/items/kai_trial'};
 await setSim(quest);await route('MSQB:');
 const glow=()=>evaluate("Number([...document.querySelectorAll('#canvas .control')].find(el=>el.dataset.controlName==='glow'&&!el.hidden).style.opacity)");
 await seek(0);assert.ok(Math.abs(await glow()-.35)<.0001);await seek(.8);assert.equal(await glow(),1);await seek(1.6);assert.ok(Math.abs(await glow()-.35)<.0001);
 await evaluate("document.getElementById('animationEnabled').click()");
 await upload('#vanillaFiles',vanillaArchive);await waitLong("document.getElementById('vanillaStatus').textContent.startsWith('原版资源：')");
 const budget=await evaluate("({text:document.getElementById('controlBudget').textContent,severity:document.getElementById('controlBudget').className,branches:document.getElementById('budgetBranches').textContent})");
 assert.match(budget.text,/本包 \d+ · 原版 \d+ · 合计/);assert.match(budget.branches,/questbook_form：本包 367/);assert.equal(budget.severity,'budget normal');console.log('Form budget',budget);
 const rings=[];
 for(const pocket of [false,true])for(const code of ['2','3','4']){
  await route('标题 = §r§'+code+'§r');await evaluate(`document.getElementById('containerDevice').value=${JSON.stringify(pocket?'pocket':'desktop')};document.getElementById('applyContainer').click()`);
  assert.equal(await evaluate("[...document.querySelectorAll('#canvas .control')].filter(el=>/progressive_select_progress_bar|stack_progress_bar_down|progressive_(down|up|left_side|right_side)/.test(el.dataset.controlName)&&!el.hidden).length"),0);
  assert.match(await evaluate("document.getElementById('controlBudget').textContent"),/本包 \d+ · 原版 \d+/);rings.push({pocket,code,budget:await evaluate("document.getElementById('controlBudget').textContent")});console.log('Ring',pocket,code);
 }
 await route('标题 = §r§2§r');await evaluate("document.getElementById('dualPreview').click()");
 const variants=await evaluate("[...document.querySelectorAll('.comparison-status')].map(el=>el.textContent)");assert.ok(variants[0].includes('ms_ring.panel_81'));assert.ok(variants[1].includes('ms_ring.panel_81_m'));
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/easy-see-stage-four-dual.png',Buffer.from(shot.data,'base64'));
 await evaluate("document.getElementById('dualPreview').click()");
 // Import a private-use glyph page into the dependency layer; never write it
 // into an existing resource file or ship the user's assets with the editor.
 await evaluate("(async()=>{const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,8,8);const blob=await new Promise(r=>canvas.toBlob(r)),zip=new JSZip();zip.file('Glyph/font/glyph_e1.png',await blob.arrayBuffer());const content=await zip.generateAsync({type:'uint8array'}),dt=new DataTransfer();dt.items.add(new File([content],'font-dependency.zip'));document.getElementById('dependency').click();const input=document.getElementById('files');input.files=dt.files;input.dispatchEvent(new Event('change'));})()");
 await waitLong("document.getElementById('project').textContent.endsWith(' +2 依赖')");await waitLong("!document.getElementById('vanilla').disabled");await select('hud · test_factory');await setSim({bindings:{'#text':toast+'\ue100'}});
 await evaluate("document.getElementById('packFont').click()");await waitFor("document.getElementById('fontStatus').textContent.includes('个字形')");assert.ok(await evaluate("[...document.querySelectorAll('#canvas .bitmap-glyph')].some(el=>el.textContent==='\ue100')"));
 assert.equal(await source(),original);
 // IndexedDB round trip across an actual page reload; the second pass has an
 // injected offline fetcher and must not issue any download requests.
 const cacheVersion='regression-'+Date.now();
 const cached=await evaluate(`(async()=>{const {ResourceCache}=await import('./src/resource-cache.js'),{loadOfficial}=await import('./src/official-resources.js'),cache=new ResourceCache(${JSON.stringify(cacheVersion)});const paths=['ui/ui_common.json','textures/items/demo.png','textures/blocks/demo.png','font/glyph_e1.png'];const project=new Map([['RP/ui/demo.json',new TextEncoder().encode(JSON.stringify({namespace:'demo',main:{texture:'textures/items/demo',controls:[{b:{texture:'textures/blocks/demo'}}]}}))]]);const result=await loadOfficial(project,{cache,index:{paths},fontPages:['font/glyph_e1.png'],fetcher:async()=>new Response(JSON.stringify({namespace:'common'}))});return {downloaded:result.downloaded,stats:await cache.inspect()};})()`);
 assert.equal(cached.downloaded,4);assert.equal(cached.stats.count,4);
 await send('Page.reload');await waitFor("document.querySelectorAll('.control').length>0");
 const offline=await evaluate(`(async()=>{const {ResourceCache}=await import('./src/resource-cache.js'),{loadOfficial}=await import('./src/official-resources.js'),cache=new ResourceCache(${JSON.stringify(cacheVersion)}),other=new ResourceCache(${JSON.stringify(cacheVersion+'-other')});await other.put('keep',new Uint8Array([7]));const paths=['ui/ui_common.json','textures/items/demo.png','textures/blocks/demo.png','font/glyph_e1.png'],project=new Map([['RP/ui/demo.json',new TextEncoder().encode(JSON.stringify({namespace:'demo',main:{texture:'textures/items/demo',controls:[{b:{texture:'textures/blocks/demo'}}]}}))]]);let downloads=0;const result=await loadOfficial(project,{cache,index:{paths},fontPages:['font/glyph_e1.png'],fetcher:async()=>{downloads++;throw Error('offline');}});await cache.clear();const cleared=await cache.inspect(),retained=await other.get('keep');await other.clear();return {cached:result.cached,failed:result.failed.length,downloads,cleared:cleared.count,retained:[...retained]};})()`);
 assert.deepEqual(offline,{cached:4,failed:0,downloads:0,cleared:0,retained:[7]});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',frames,dual,budget,rings,cached,offline,checks:['toast in/hold/out and seek/pause','dual device variants and safe/outside guides','pixel ASCII and pack private-use glyph','source unchanged','touch overlays hidden in six ring layouts','custom/vanilla budgets','IndexedDB reload and offline cache hit','version-isolated clear','no browser exceptions']},null,2));
}finally{ws.close();await fetch('http://127.0.0.1:9222/json/close/'+target.id);}
