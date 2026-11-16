import {inferChannels,channelValue,fieldValues,composeChannel,setChannel,binaryFill,texturePatterns,stateMatrix} from './simulation-tools.js';
import {presentScene,clipInsets} from './scene-presentation.js';
const label=(text,control)=>{const el=document.createElement('label');el.append(document.createTextNode(text),control);return el;};
export function renderFields(container,obj,files,simulation,{index,onApply,onError}){
 const previous=container.querySelector('#channelSchema')?.value;container.replaceChildren();const schemas=inferChannels(obj,files);
 if(!schemas.length){const note=document.createElement('small');note.textContent='未识别到固定通道格式，可使用模拟 JSON 或已保存的预设。';container.append(note);return [];}
 const select=document.createElement('select');select.id='channelSchema';for(const schema of schemas){const option=document.createElement('option');option.value=schema.id;option.textContent=schema.prefix+' · '+schema.channel;select.append(option);}if(schemas.some(schema=>schema.id===previous))select.value=previous;container.append(label('通道格式',select));
 const fields=document.createElement('div');fields.id='channelFields';container.append(fields);
 const populate=()=>{
  fields.replaceChildren();const schema=schemas.find(s=>s.id===select.value),values=fieldValues(schema,channelValue(simulation,schema.channel,index)),controls=[];
  const prefix=document.createElement('small');prefix.textContent='固定前缀：'+schema.prefix;fields.append(prefix);
  schema.fields.forEach((field,i)=>{
   let input;const width=field.end-field.start;
   if(field.kind==='binary'){
    input=document.createElement('input');input.type='range';input.min=0;input.max=100;input.step=1;input.value=Math.round((values[i].split('1').length-1)/width*100);input.dataset.kind='binary';
    const output=document.createElement('output');output.textContent=input.value+'%';input.oninput=()=>output.textContent=input.value+'%';const group=document.createElement('div');group.append(input,output);fields.append(label(`${width} 格填充（第 ${field.start+1}–${field.end} 位）`,group));
   }else if(field.options.length){input=document.createElement('select');for(const value of field.options){const option=document.createElement('option');option.value=value;option.textContent=value;input.append(option);}input.value=values[i];fields.append(label(`枚举字段（第 ${field.start+1}–${field.end} 位）`,input));}
   else{input=document.createElement(field.kind==='text'?'textarea':'input');input.value=values[i];if(Number.isFinite(width))input.maxLength=width;input.dataset.kind=field.kind;fields.append(label(field.kind==='path'?`贴图路径（${width} 字符，自动补 ${field.padding}）`:Number.isFinite(width)?`第 ${field.start+1}–${field.end} 位`:'后续文字',input));}
   controls.push(input);
  });
  const apply=document.createElement('button');apply.id='applyChannelFields';apply.textContent='应用字段到预览';apply.onclick=()=>{try{const values=controls.map((input,i)=>schema.fields[i].kind==='binary'?binaryFill(schema.fields[i].end-schema.fields[i].start,input.value):input.value);onApply(setChannel(simulation,schema.channel,composeChannel(schema,values),index));}catch(error){onError(error.message);}};fields.append(apply);for(const input of controls)if(input.type==='range'||input.tagName==='SELECT')input.onchange=()=>apply.click();
 };
 select.onchange=populate;populate();return schemas;
}
let matrixURLs=[];
export function renderMatrix(container,obj,files,file){
 const previous=container.querySelector('select')?.selectedOptions[0]?.textContent;matrixURLs.forEach(URL.revokeObjectURL);matrixURLs=[];container.replaceChildren();const patterns=texturePatterns(obj,files);
 if(!patterns.length){container.textContent='没有可枚举的拼贴图表达式。';return;}
 const selector=document.createElement('select');for(const [i,pattern]of patterns.entries()){const option=document.createElement('option');option.value=i;option.textContent=pattern.prefix+'…'+pattern.suffix+' · '+pattern.channel;selector.append(option);if(option.textContent===previous)selector.value=i;}container.append(selector);
 const output=document.createElement('div');container.append(output);
 const draw=()=>{
  matrixURLs.forEach(URL.revokeObjectURL);matrixURLs=[];output.replaceChildren();const matrix=stateMatrix(patterns[Number(selector.value)],files,file),missing=matrix.states.filter(state=>state.resource.status!=='found').length;
  const summary=document.createElement('small');summary.textContent=!matrix.states.length?'没有可枚举的资源名，请加载依赖后检查':`${matrix.states.length} 种组合 · ${missing} 项缺图或路径不明确`+(matrix.limited?' · 组合超过 128，仅列出现有资源':'');output.append(summary);
  const grid=document.createElement('div');grid.className='texture-matrix';output.append(grid);
  for(const state of matrix.states){const cell=document.createElement('div');cell.className='matrix-cell'+(state.resource.status==='found'?'':' missing');cell.title=state.texture+'\n'+(state.resource.message||'');
   if(state.resource.path){const url=URL.createObjectURL(new Blob([files.get(state.resource.path)]));matrixURLs.push(url);const img=new Image();img.src=url;img.alt=state.value;cell.append(img);}
   const text=document.createElement('span');text.textContent=state.value+(state.resource.status==='found'?'':' · 缺图');cell.append(text);grid.append(cell);
  }
 };selector.onchange=draw;draw();
}
export function buttonComparisons(container,ns,scene,buttonId,elements){
 container.replaceChildren();if(!buttonId){container.textContent='选中一个按钮可并排查看默认、悬停与按下。';return;}
 const byId=new Map(ns.map(n=>[n.id,n])),root=byId.get(buttonId);if(!root)return;
 for(const state of ['default','hover','pressed']){
  const card=document.createElement('div');card.className='state-card';const heading=document.createElement('small');heading.textContent={default:'默认',hover:'悬停',pressed:'按下'}[state];card.append(heading);
  const visible=[...presentScene(ns,scene,new Map([[buttonId,state]]))].filter(([id,item])=>item.visible&&root.path.every((part,i)=>byId.get(id)?.path[i]===part));
  if(!visible.length){container.append(card);continue;}
  const x=Math.min(...visible.map(([,p])=>p.rect.x)),y=Math.min(...visible.map(([,p])=>p.rect.y)),w=Math.max(...visible.map(([,p])=>p.rect.x+p.rect.w))-x,h=Math.max(...visible.map(([,p])=>p.rect.y+p.rect.h))-y;
  const frame=document.createElement('div');frame.className='state-frame';const surface=document.createElement('div');surface.style.cssText=`position:relative;width:${w}px;height:${h}px;transform-origin:top left;transform:scale(${Math.min(220/Math.max(w,1),120/Math.max(h,1),2)})`;
  for(const [id,item]of visible){const source=elements.get(id);if(!source)continue;const clone=source.cloneNode(true);clone.classList.remove('selected');clone.hidden=false;for(const key of Object.keys(clone.dataset))delete clone.dataset[key];Object.assign(clone.style,{left:item.rect.x-x+'px',top:item.rect.y-y+'px',pointerEvents:'none',zIndex:String(item.layer),clipPath:clipInsets(item.rect,item.clip)});surface.append(clone);}
  frame.append(surface);card.append(frame);container.append(card);
 }
}
