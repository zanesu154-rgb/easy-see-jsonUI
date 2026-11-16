// Text and font regressions. Requires local app :5173 and Chromium CDP :9222.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [addon,dependency,vanillaPreview,previewTypeface] = process.argv.slice(2);
if(!addon||!dependency)throw Error('Usage: node scripts/text-regression.mjs <V1.8.81.mcaddon> <server_form.json> [vanilla-preview.zip] [preview-font.ttf]');
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => {ws.onopen = resolve; ws.onerror = reject;});
let sequence = 0;
const pending = new Map(), errors = [];
ws.onmessage = event => {const message = JSON.parse(event.data); if(message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails); const p = pending.get(message.id); if(p){pending.delete(message.id); message.error ? p.reject(message.error) : p.resolve(message.result);}};
const send = (method, params = {}) => new Promise((resolve, reject) => {const id = ++sequence; pending.set(id, {resolve,reject}); ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => {const r = await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true}); if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value;};
const waitFor = async expression => {for(let i=0;i<60;i++){if(await evaluate(expression))return; await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression);};
const upload=async(selector,path)=>{const doc=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});await send('DOM.setFileInputFiles',{nodeId,files:[path]});};
const simulate=async value=>evaluate(`document.getElementById('simulation').value=${JSON.stringify(JSON.stringify(value))};document.getElementById('simulate').click()`);
const select=async text=>evaluate(`(()=>{const row=[...document.querySelectorAll('#tree button')].find(el=>el.textContent.trim()===${JSON.stringify(text)});if(!row)throw Error('Missing row: '+${JSON.stringify(text)});row.click()})()`);
const screenshot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/easy-see-'+name+'.png',Buffer.from(r.data,'base64'));};
try{
 await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1100,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:5173'});await waitFor("document.querySelectorAll('.control').length>0");await evaluate("document.getElementById('browseView').value='files';document.getElementById('browseView').dispatchEvent(new Event('change'))");
 await evaluate("window.fetch=async()=>{throw Error('Offline text regression')}");
 await upload('#files',addon);await waitFor("document.getElementById('project').textContent.includes('武破')");
 if(dependency){await evaluate("document.getElementById('dependency').click()");await upload('#files',dependency);await waitFor("document.getElementById('project').textContent==='server_form.json'");await waitFor("!document.getElementById('vanilla').disabled");}
 const hudGroup=await evaluate("(()=>{const row=[...document.querySelectorAll('#tree button')].find(el=>el.textContent==='hud · ms_status_panel');return row.closest('details').parentElement.closest('details').querySelector('summary').textContent})()");
 assert.match(hudGroup,/hud.*hud_screen/);
 const title='§6奖励 勇气之证 ×12、混沌清露 ×3';
 const payload='toast.'+'textures/items/kai_trial'.padEnd(150,'$')+'textures/ui/questbook/toast_task'.padEnd(50,'$')+title;
 await simulate({bindings:{'#text':payload}});await select('hud · test');
 const toast=await evaluate(`(async()=>{const root=document.querySelector('[data-control-name=test]'),label=document.querySelector('#canvas [data-control-name=text] .control-text'),icon=document.querySelector('#canvas [data-control-name=icon]');for(const el of [root,icon]){const image=new Image();image.src=el.style.backgroundImage.slice(5,-2);await image.decode();}return {text:label.textContent,align:label.style.textAlign,lines:label.children.length,issues:document.getElementById('issues').textContent}})()`);
 assert.equal(toast.text,title.replace(/§./g,''));assert.equal(toast.align,'left');assert.equal(toast.lines,1);assert.ok(!toast.issues.includes('应为包含两个值的数组'));assert.ok(!toast.issues.includes('未找到贴图'));
 await screenshot('toast-fixed');
 await simulate({title:'MSHUD:中文状态 ABC 123\n奖励 勇气之证 ×12、混沌清露 ×3\n超出最大宽度时应该自动换行并撑开背景，最后一行 -12%'});await select('hud · ms_status_panel');
 const wrapped=await evaluate("(()=>{const root=document.querySelector('[data-control-name=ms_status_panel]'),text=document.querySelector('#canvas [data-control-name=ms_status_text]'),label=text.querySelector('.control-text'),height=parseFloat(text.style.height);return {height,background:parseFloat(root.style.height),lineHeight:parseFloat(label.firstChild.style.height),lines:label.children.length,last:label.lastChild.textContent,lastBottom:label.lastChild.getBoundingClientRect().bottom,textBottom:text.getBoundingClientRect().bottom}})()");
 assert.ok(wrapped.lines>3);assert.equal(wrapped.height,wrapped.lineHeight*wrapped.lines);assert.ok(Math.abs(wrapped.background-wrapped.height-8)<.01);assert.ok(wrapped.lastBottom<=wrapped.textBottom+.1);assert.match(wrapped.last,/-12%/);
 await screenshot('wrapped-status-fixed');
 const baseSource=await evaluate("document.getElementById('source').value");
 // Import a local Minecraft font page with one A glyph (10 px ink in a 16 px cell).
 await evaluate(`(async()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(16,64,10,16);const blob=await new Promise(resolve=>canvas.toBlob(resolve));const zip=new JSZip();zip.file('font/glyph_00.png',await blob.arrayBuffer());const file=new File([await zip.generateAsync({type:'uint8array'})],'test-font.zip');const dt=new DataTransfer();dt.items.add(file);const input=document.getElementById('fontFile');input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
 await waitFor("document.getElementById('fontStatus').textContent.includes('1 个字形')");
 assert.equal(await evaluate("document.querySelectorAll('#canvas .bitmap-glyph').length"),1);
 assert.equal(await evaluate("document.getElementById('source').value"),baseSource);
 await evaluate("document.getElementById('resetFont').click()");assert.equal(await evaluate("document.querySelectorAll('#canvas .bitmap-glyph').length"),0);
 if(previewTypeface){
  await upload('#fontFile',previewTypeface);await waitFor("document.getElementById('fontStatus').textContent.includes('字宽按游戏单位校准')");
  assert.match(await evaluate("getComputedStyle(document.querySelector('#canvas .game-glyph')).fontFamily"),/EasySeePreviewFont/);
  assert.equal(await evaluate("document.getElementById('source').value"),baseSource);
  await evaluate("document.getElementById('resetFont').click()");
 }
 // A stale official request must not overwrite a successfully loaded manual layer.
 await evaluate(`window.__releaseMode=false;window.__releaseDownloads=[];window.fetch=()=>window.__releaseMode?Promise.resolve(new Response('',{status:404})):new Promise(resolve=>window.__releaseDownloads.push(()=>resolve(new Response('',{status:404}))));document.getElementById('vanilla').click()`);
 await waitFor('window.__releaseDownloads.length>0');
 if(vanillaPreview){
   await upload('#vanillaFiles',vanillaPreview);await waitFor("document.getElementById('vanillaStatus').textContent.startsWith('原版资源：')");
   await evaluate("window.__releaseMode=true;window.__releaseDownloads.forEach(done=>done())");
   await waitFor("!document.getElementById('vanilla').disabled");
   assert.match(await evaluate("document.getElementById('vanillaStatus').textContent"),/^原版资源：/);
 }else await evaluate("window.__releaseMode=true;window.__releaseDownloads.forEach(done=>done())");
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',toast,wrapped,hudGroup,checks:['all padding removed from toast fields','toast background and icon decoded','default left alignment','reward line fits','wrapped height contains last -12% line','Minecraft glyph page import and reset','font does not alter source','custom controls grouped under HUD','stale resource status preserved']},null,2));
}finally{ws.close();}
