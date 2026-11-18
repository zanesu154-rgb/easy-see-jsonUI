// Button hit regions and cumulative layer regressions. Requires local app :5173 and Chromium CDP :9222.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [addon,dependency] = process.argv.slice(2);
if(!addon||!dependency)throw Error('Usage: node scripts/interaction-regression.mjs <reference.mcaddon> <server_form.json>');
const target = await (await fetch('http://127.0.0.1:9222/json/new?about:blank',{method:'PUT'})).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {ws.onopen = resolve; ws.onerror = reject;});
let sequence = 0;
const pending = new Map(), errors = [];
ws.onmessage = event => {const message = JSON.parse(event.data); if(message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails); const p = pending.get(message.id); if(p){pending.delete(message.id); message.error ? p.reject(message.error) : p.resolve(message.result);}};
const send = (method, params = {}) => new Promise((resolve, reject) => {const id = ++sequence; pending.set(id, {resolve,reject}); ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => {const r = await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true}); if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value;};
const waitFor = async expression => {for(let i=0;i<60;i++){if(await evaluate(expression))return; await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression);};
const upload=async(selector,path)=>{const doc=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});await send('DOM.setFileInputFiles',{nodeId,files:[path]});};
const locate=name=>evaluate(`(()=>{const el=[...document.querySelectorAll('#canvas .control')].find(e=>e.dataset.controlName===${JSON.stringify(name)});if(!el)throw Error('Missing control '+${JSON.stringify(name)});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,left:r.left,top:r.top,width:r.width,height:r.height}})()`);
let heldButtons=0;
const mouse=(type,p,extra={})=>{if(type==='mousePressed')heldButtons=1;if(type==='mouseReleased')heldButtons=0;return send('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,buttons:heldButtons,button:heldButtons?'left':'none',...extra});};
const move=p=>mouse('mouseMoved',p);
const click=async p=>{await move(p);await mouse('mousePressed',p,{button:'left',clickCount:1});await mouse('mouseReleased',p,{button:'left',clickCount:1});};
const state=name=>evaluate(`document.querySelector('[data-control-name=${name}]').dataset.buttonState`);
const result=()=>evaluate("document.getElementById('clickResult').textContent");
const setMode=mode=>evaluate(`document.getElementById('mode').value='${mode}';document.getElementById('mode').dispatchEvent(new Event('change'))`);
try{
 await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:5173'});await waitFor("document.querySelectorAll('.control').length>0");await evaluate("document.getElementById('editMode').click()");await evaluate("document.getElementById('browseView').value='files';document.getElementById('browseView').dispatchEvent(new Event('change'))");
 await evaluate("window.fetch=async()=>{throw Error('Offline interaction regression')}");
 const anchor=o=>({anchor_from:'top_left',anchor_to:'top_left',...o});
 const fixture={namespace:'hit_test',main:anchor({type:'panel',size:[300,180],layer:10,controls:[
 {a:anchor({type:'button',size:[26,26],offset:[20,30],collection_index:0,default_control:'face',hover_control:'over',pressed_control:'over',controls:[{face:anchor({type:'image',size:[26,26],texture:'textures/gray'})},{over:anchor({type:'panel',size:[26,26],layer:40,controls:[{tip:anchor({type:'image',size:[100,50],offset:[30,0],layer:60,texture:'textures/red'})}]})}]})},
 {b:anchor({type:'button',size:[26,26],offset:[80,30],collection_index:1,layer:1,default_control:'b_face',controls:[{b_face:anchor({type:'image',size:[26,26],layer:5,texture:'textures/blue'})}]})},
 {movable:anchor({type:'panel',size:[60,40],offset:[150,90],layer:2,controls:[{moving_child:anchor({type:'image',size:[10,10],offset:[5,5],texture:'textures/gray'})}]})},
 {clipper:anchor({type:'panel',size:[20,20],offset:[230,90],layer:3,clips_children:true,controls:[{clipped:anchor({type:'button',size:[30,20],offset:[10,0],collection_index:2,default_control:'clip_face',controls:[{clip_face:anchor({type:'image',size:[30,20],texture:'textures/blue'})}]})}]})}
 ]})};
 await evaluate(`(async()=>{const zip=new JSZip();zip.file('P/ui/hit.json',JSON.stringify(${JSON.stringify(fixture)}));for(const [name,color]of [['red','rgb(240,30,40)'],['blue','rgb(20,70,220)'],['gray','rgb(80,80,80)']]){const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,1,1);const blob=await new Promise(r=>c.toBlob(r));zip.file('P/textures/'+name+'.png',await blob.arrayBuffer());}const f=new File([await zip.generateAsync({type:'uint8array'})],'interaction-fixture.zip'),dt=new DataTransfer();dt.items.add(f);const input=document.getElementById('files');input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
 await waitFor("document.getElementById('project').textContent==='interaction-fixture.zip'");await waitFor("!document.getElementById('vanilla').disabled");
 await evaluate("document.getElementById('simulation').value=JSON.stringify({formButtons:['A','B','C']});document.getElementById('simulate').click()");
 await setMode('preview');
 const source=await evaluate("document.getElementById('source').value");
 const ratios=['1','0.75','1.5','fit'];let testedPixels=[];
 for(const zoom of ratios){
  await move({x:30,y:100});await evaluate(`document.getElementById('zoom').value='${zoom}';document.getElementById('zoom').dispatchEvent(new Event('change'))`);
  const a=await locate('a'),b=await locate('b');await move(a);
  assert.equal(await state('a'),'hover');
  const layer=await evaluate("({tip:document.querySelector('[data-control-name=tip]').style.zIndex,icon:document.querySelector('[data-control-name=b_face]').style.zIndex,allFlat:[...document.querySelectorAll('#canvas .control')].every(e=>e.parentElement.id==='canvas')})");
  assert.equal(Number(layer.tip),110);assert.equal(Number(layer.icon),16);assert.equal(layer.allFlat,true);
  const screenshot=await send('Page.captureScreenshot',{format:'png'});
  const rgb=await evaluate(`(async()=>{const image=new Image();image.src='data:image/png;base64,${screenshot.data}';await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return [...ctx.getImageData(${Math.round(b.x)},${Math.round(b.y)},1,1).data].slice(0,3)})()`);
  assert.deepEqual(rgb,[240,30,40]);testedPixels.push({zoom,rgb});
  await click(b);assert.equal(await state('a'),'default');assert.match(await result(),/序号：1/);
  await move(a);const outside={x:a.left+a.width*4.8,y:a.y};await move(outside);
  assert.equal(await state('a'),'default');const before=await result();await click(outside);assert.equal(await result(),before);
  await move(a);await mouse('mousePressed',a,{button:'left',clickCount:1});assert.equal(await state('a'),'pressed');
  await move(outside);assert.equal(await state('a'),'default');await mouse('mouseReleased',outside,{button:'left',clickCount:1});assert.equal(await result(),before);
  await move(a);await mouse('mousePressed',a,{button:'left',clickCount:1});await move(outside);await move(a);assert.equal(await state('a'),'pressed');await mouse('mouseReleased',a,{button:'left',clickCount:1});assert.match(await result(),/序号：0/);
 }
 const clipped=await locate('clipped');const beforeClip=await result();
 await click({x:clipped.left+clipped.width*.85,y:clipped.y});assert.equal(await result(),beforeClip);
 await click({x:clipped.left+clipped.width*.15,y:clipped.y});assert.match(await result(),/序号：2/);
 assert.equal(await evaluate("document.getElementById('source').value"),source);
 // Forced branches stay visual-only, and edit drag still carries the complete subtree.
 await setMode('edit');await evaluate("document.getElementById('buttonState').value='pressed';document.getElementById('buttonState').dispatchEvent(new Event('change'));document.getElementById('zoom').value='1';document.getElementById('zoom').dispatchEvent(new Event('change'))");
 assert.equal(await evaluate("document.querySelector('[data-control-name=tip]').hidden"),false);
 // Editing now intentionally prefers the already selected control.
 await evaluate("document.querySelector('[data-control-name=movable]').click()");
 const parent=await locate('movable'),child=await locate('moving_child'),from={x:parent.left+35,y:parent.top+25},to={x:from.x+12,y:from.y+15};
 const childLeft=await evaluate("parseFloat(document.querySelector('[data-control-name=moving_child]').style.left)");
 await move(from);await mouse('mousePressed',from,{button:'left',clickCount:1});await move(to);
 await waitFor("parseFloat(document.querySelector('[data-control-name=moving_child]').style.left)==="+(childLeft+12));
 const during=await locate('moving_child');assert.equal(Math.round(during.left-child.left),12);assert.equal(Math.round(during.top-child.top),15);
 await mouse('mouseReleased',to,{button:'left',clickCount:1});
 assert.deepEqual(await evaluate("JSON.parse(document.getElementById('source').value).main.controls[2].movable.offset"),[162,105]);
 await evaluate("document.getElementById('undo').click()");assert.equal(await evaluate("document.getElementById('source').value"),source);
 // Real reference case: item 26's tooltip covers item 25's own rectangle.
 await evaluate("document.getElementById('import').click()");await upload('#files',addon);await waitFor("document.getElementById('project').textContent.includes('武破')");
 await evaluate("document.getElementById('dependency').click()");await upload('#files',dependency);await waitFor("document.getElementById('project').textContent==='server_form.json'");
 const sim={formTitle:'MSQB:realm/kai|秘境',formButtons:Array.from({length:34},(_,i)=>({text:i<3?'P0分页':i<10?'S0小页':'QX',texture:''}))};
 for(const [i,name]of [[10,'较早节点'],[11,'较晚节点'],[25,'不灭之焰'],[26,'力可通神']])sim.formButtons[i]={text:'QTA02'+name,texture:'textures/items/kai_trial'};
 await evaluate(`document.getElementById('simulation').value=${JSON.stringify(JSON.stringify(sim))};document.getElementById('simulate').click();[...document.querySelectorAll('#tree button')].find(e=>e.textContent.trim().match(/^[▾▸] long_form$/)).click();document.getElementById('buttonState').value='default';document.getElementById('buttonState').dispatchEvent(new Event('change'))`);
 await setMode('preview');
 const indexPoint=async index=>evaluate(`(()=>{const e=[...document.querySelectorAll('#canvas [data-button]')].find(el=>JSON.parse(el.dataset.node).at(-1).includes('@ms_questbook.node')&&el.dataset.controlName==='n${index-10}@ms_questbook.node');if(!e)throw Error('missing reference node');const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 const p26=await indexPoint(26),p25=await indexPoint(25);await move(p26);
 const covering=await evaluate(`(()=>{const tip=[...document.querySelectorAll('#canvas .control')].find(e=>e.dataset.controlName.startsWith('tip@')&&!e.hidden),r=tip.getBoundingClientRect();return ${p25.x}>=r.left&&${p25.x}<r.right&&${p25.y}>=r.top&&${p25.y}<r.bottom})()`);assert.equal(covering,true);
 await click(p25);assert.match(await result(),/序号：25/);
 const p10=await indexPoint(10);await move(p10);
 const actualLayers=await evaluate("(()=>{const tip=[...document.querySelectorAll('#canvas .control')].find(e=>e.dataset.controlName.startsWith('tip@')&&!e.hidden),icon=[...document.querySelectorAll('#canvas .control')].find(e=>e.dataset.controlName==='icon'&&e.dataset.node.includes('n1@ms_questbook.node'));return {tip:Number(tip.style.zIndex),neighborIcon:Number(icon.style.zIndex)}})()");
 assert.ok(actualLayers.tip>actualLayers.neighborIcon);
 const picture=await send('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/easy-see-interaction-fixed.png',Buffer.from(picture.data,'base64'));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',testedPixels,actualLayers,checks:['tooltip paints above later sibling icons','26x26 button hit bounds across four zoom levels','tooltip-only area does not hover or click button','release outside cancels activation','drag back inside preserves pressed state','ancestor clipping restricts hits','forced states preserve source','edit parent drag carries children and supports undo','real index 26 tooltip covering index 25 still clicks 25','no browser exceptions']},null,2));
}finally{ws.close();await fetch('http://127.0.0.1:9222/json/close/'+target.id).catch(()=>{});}
