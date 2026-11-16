import {expressionTree} from './expression.js';
import {textureResource} from './resources.js';
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function span(tree){
 if(tree?.type==='ref'&&tree.value.startsWith('#'))return {channel:tree.value,start:0,end:Infinity};
 if(tree?.type!=='binary')return;
 if(tree.op==='*'&&typeof tree.left?.value==='string'){
  const match=/^%\.(\d+)s$/.exec(tree.left.value),right=span(tree.right);if(match&&right)return {...right,end:Math.min(right.end,right.start+Number(match[1]))};
 }
 if(tree.op==='-'){
  const a=span(tree.left),b=span(tree.right);if(!a)return;
  if(b&&a.channel===b.channel&&a.start===b.start&&b.end<=a.end)return {...a,start:b.end};
  if(tree.right.type==='literal'&&typeof tree.right.value==='string'){
   if(tree.right.value==='$')return {...a,padding:'$'};
   if(a.start===0&&tree.right.value.length<a.end)return {...a,start:tree.right.value.length};
  }
 }
}
export {span as expressionSpan};
export function expressionSources(obj){
 const result=[];
 const expand=(tree,aliases)=>{if(!tree)return tree;if(tree.type==='ref'&&aliases.has(tree.value))return aliases.get(tree.value);if(tree.type==='binary')return {...tree,left:expand(tree.left,aliases),right:expand(tree.right,aliases)};if(tree.type==='unary')return {...tree,value:expand(tree.value,aliases)};return tree;};
 function walk(value,path=[],parent=new Map()){
  if(!value||typeof value!=='object')return;
  const aliases=new Map(parent);
  for(const binding of Array.isArray(value.bindings)?value.bindings:[]){
   if(!binding||typeof binding!=='object')continue;
   if(binding.binding_name_override&&binding.binding_name)aliases.set(binding.binding_name_override,aliases.get(binding.binding_name)||{type:'ref',value:binding.binding_name});
   if(typeof binding.source_property_name==='string'){
    const tree=expand(expressionTree(binding.source_property_name).tree,aliases);
    result.push({source:binding.source_property_name,path:[...path,'bindings'],tree,target:binding.target_property_name});
    if(tree&&binding.target_property_name)aliases.set(binding.target_property_name,tree);
   }
  }
  for(const [key,child]of Object.entries(value)){
   if(key==='bindings')continue;
   if(typeof child==='string'&&key.startsWith('$')&&/[#]/.test(child))result.push({source:child,path:[...path,key],tree:expand(expressionTree(child).tree,aliases)});
   else if(child&&typeof child==='object')walk(child,[...path,key],aliases);
  }
 }
 walk(obj);return result;
}
function plusParts(tree){return tree?.type==='binary'&&tree.op==='+'?[...plusParts(tree.left),...plusParts(tree.right)]:[tree];}
export function texturePatterns(obj,files,{sources}={}){
 const found=new Map();
 for(const {source,tree}of sources||expressionSources(obj)){
  if(!tree)continue;
  const parts=plusParts(tree),windows=parts.map(span).filter(Boolean),literals=parts.filter(p=>p?.type==='literal').map(p=>p.value);
  if(windows.length!==1||parts.some(p=>!span(p)&&p?.type!=='literal'))continue;
  const window=windows[0];if(!Number.isFinite(window.end))continue;
  const variable=parts.findIndex(p=>span(p)),prefix=parts.slice(0,variable).map(p=>p.value).join(''),suffix=parts.slice(variable+1).map(p=>p.value).join('');
  if(!prefix.startsWith('textures/'))continue;
  const key=prefix+'|'+suffix+'|'+window.channel+'|'+window.start+'|'+window.end;if(found.has(key))continue;
  const matcher=new RegExp('(?:^|/)'+escape(prefix)+'(.{'+(window.end-window.start)+'})'+escape(suffix)+'\\.(?:png|jpe?g)$','i');
  const values=[...new Set([...files.keys()].flatMap(path=>matcher.exec(path)?.[1]||[]))].sort();
  found.set(key,{...window,prefix,suffix,values,source});
 }
 return [...found.values()];
}
export function inferChannels(obj,files=new Map()){
 const channels=new Map(),patterns=texturePatterns(obj,files);
 const get=channel=>{if(!channels.has(channel))channels.set(channel,{channel,prefixes:new Set(),ranges:[],characters:new Map(),cuts:new Set([0])});return channels.get(channel);};
 function walk(node){
  if(!node)return;
  const value=span(node);
  if(value){const info=get(value.channel);if(value.start>0||value.padding)info.ranges.push(value);if(Number.isFinite(value.end))info.cuts.add(value.end);if(value.start)info.cuts.add(value.start);}
  if(node.type==='binary'&&node.op==='='){
   for(const [left,right]of [[node.left,node.right],[node.right,node.left]]){
    const a=span(left);
    if(a?.start===0&&right.type==='literal'&&typeof right.value==='string'&&right.value.length===a.end&&a.end>1)get(a.channel).prefixes.add(right.value);
    if(a?.start===0&&right.type==='binary'&&right.op==='+'){
     const b=span(right.left),literal=right.right;if(b?.channel===a.channel&&a.end===b.end+1&&literal.type==='literal'&&typeof literal.value==='string'&&literal.value.length===1){const info=get(a.channel),allowed=info.characters.get(b.end)||new Set();allowed.add(literal.value);info.characters.set(b.end,allowed);}
    }
   }
  }
  if(node.left)walk(node.left);if(node.right)walk(node.right);if(node.type==='unary')walk(node.value);
 }
 for(const {tree}of expressionSources(obj))walk(tree);
 const result=[];
 for(const info of channels.values())for(const prefix of info.prefixes){
  const start=prefix.length,characters=[...info.characters].filter(([pos])=>pos>=start).sort(([a],[b])=>a-b),runs=[];
  for(const [pos,allowed]of characters){const last=runs.at(-1),key=[...allowed].sort().join('');if(last&&last.end===pos&&last.key===key){last.end++;}else runs.push({start:pos,end:pos+1,key});}
  const ranges=runs.filter(run=>run.end-run.start>1).map(run=>({...run,kind:/^[01]+$/.test(run.key)?'binary':'sequence'}));
  const cuts=[...info.cuts].filter(cut=>cut>=start&&!ranges.some(run=>cut>run.start&&cut<run.end));cuts.push(start);
  const sorted=[...new Set(cuts)].sort((a,b)=>a-b),fields=[];
  for(let i=0;i<sorted.length;i++){
   const a=sorted[i],b=sorted[i+1]??Infinity,run=ranges.find(r=>r.start===a&&r.end===b),known=info.ranges.filter(r=>r.start===a&&r.end===b),pattern=patterns.find(p=>p.channel===info.channel&&p.start===a&&p.end===b);
   fields.push({start:a,end:b,kind:run?.kind||(!Number.isFinite(b)?'text':known.some(r=>r.padding)?'path':pattern?.values.length?'enum':'fixed'),padding:known.find(r=>r.padding)?.padding,allowed:run?.key||(b-a===1?[...(info.characters.get(a)||[])].sort().join(''):undefined),options:pattern?.values||[]});
  }
  result.push({id:info.channel+'|'+prefix,channel:info.channel,prefix,fields});
 }
 return result;
}
export function channelValue(sim,channel,index){
 const keys={'#hud_title_text_string':'title','#hud_subtitle_text_string':'subtitle','#hud_actionbar_text_string':'actionbar','#title_text':'formTitle'};
 if(channel==='#form_button_text'&&Number.isInteger(index)&&sim.formButtons?.[index]!==undefined)return typeof sim.formButtons[index]==='string'?sim.formButtons[index]:sim.formButtons[index].text;
 if(Object.hasOwn(sim.bindings||{},channel))return String(sim.bindings[channel]??'');
 return String(keys[channel]?sim[keys[channel]]??'':sim.bindings?.[channel]??'');
}
export function setChannel(sim,channel,value,index){
 const result=structuredClone(sim),keys={'#hud_title_text_string':'title','#hud_subtitle_text_string':'subtitle','#hud_actionbar_text_string':'actionbar','#title_text':'formTitle'};
 if(channel==='#form_button_text'&&Number.isInteger(index)&&result.formButtons?.[index]!==undefined){const item=result.formButtons[index];result.formButtons[index]=typeof item==='string'?value:{...item,text:value};}
 else if(keys[channel]){result[keys[channel]]=value;if(Object.hasOwn(result.bindings||{},channel))result.bindings[channel]=value;}else result.bindings={...result.bindings,[channel]:value};return result;
}
export function fieldValues(schema,value=''){
 const valid=value.startsWith(schema.prefix);return schema.fields.map(field=>{
  const raw=valid?value.slice(field.start,field.end):'';
  if(field.kind==='binary')return raw.length===field.end-field.start&&/^[01]+$/.test(raw)?raw:'0'.repeat(field.end-field.start);
  if(field.kind==='enum')return raw||field.options[0]||'';
  if(field.padding)return raw.replace(new RegExp(escape(field.padding)+'+$'),'');
  return raw||(field.kind==='sequence'?('n'.repeat(field.end-field.start)):field.kind==='text'?'示例':'');
 });
}
export function composeChannel(schema,values){
 let text=schema.prefix;
 schema.fields.forEach((field,i)=>{let value=String(values[i]??'');if(Number.isFinite(field.end)){const width=field.end-field.start;if(value.length>width)throw Error(`第 ${field.start+1} 位字段最多 ${width} 个字符`);value=value.padEnd(width,field.padding||' ');}text+=value;});return text;
}
export function binaryFill(length,percent){const filled=Math.max(0,Math.min(length,Math.round(length*Number(percent)/100)));return '1'.repeat(filled)+'0'.repeat(length-filled);}
export function stateMatrix(pattern,files,file){
 const width=pattern.end-pattern.start,values=pattern.values;
 if(!values.length)return {states:[],limited:false};
 // Only combine names connected by one changing position. P0/P1 form a
 // family; the unrelated literal "on" must not contribute o/n to that family.
 const pending=new Set(values),families=[];
 while(pending.size){
  const family=[pending.values().next().value];pending.delete(family[0]);
  for(let i=0;i<family.length;i++)for(const value of pending){
   let differences=0;for(let j=0;j<width;j++)if(family[i][j]!==value[j])differences++;
   if(differences===1){family.push(value);pending.delete(value);}
  }
  families.push(family);
 }
 const states=new Set();let limited=false;
 for(const family of families){
  let product=[''];
  for(let i=0;i<width;i++){
   const alphabet=[...new Set(family.map(value=>value[i]))];
   if(product.length*alphabet.length+states.size>128){limited=true;break;}
   product=product.flatMap(prefix=>alphabet.map(char=>prefix+char));
  }
  if(limited)break;for(const value of product)states.add(value);
 }
 const result=limited?values:[...states].sort();
 return {states:result.map(value=>({value,texture:pattern.prefix+value+pattern.suffix,resource:textureResource(files,file,pattern.prefix+value+pattern.suffix)})),limited};
}
