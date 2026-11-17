import {simulationVariables} from './conditional-variables.js';
const buttonCache=new WeakMap();
import {resolveTemplate} from './resolver.js';
function normalizeButtons(simulation={},form){const source=simulation.formButtons??form?.fields.filter(f=>f.kind==='button').map(f=>({text:f.dynamic?'[动态内容]':f.text,texture:f.texture||''}))??[];if(!Array.isArray(source))throw Error('formButtons 必须是数组');if(source.length>500)throw Error('第一版按钮集合最多支持 500 项');return source.map((v,i)=>{if(typeof v==='string')return {text:v,texture:'',index:i};if(!v||typeof v!=='object'||Array.isArray(v)||typeof v.text!=='string')throw Error('第 '+i+' 个按钮需要 text 字符串');return {...v,text:v.text,texture:typeof v.texture==='string'?v.texture:'',index:i}})}
export function collectionScope(obj,parent,simulation,form){const collection=obj.collection_name||parent?._collectionName;if(collection&&collection!=='form_buttons'){
 const context={...parent,_collectionName:collection},index=Number.isInteger(obj.collection_index)?obj.collection_index:parent?._containerIndex;
 if(index!==undefined&&['container_items','inventory_items','hotbar_items'].includes(collection)){
  const source=collection==='container_items'?simulation.containerItems:collection==='hotbar_items'?simulation.hotbarItems:simulation.inventoryItems;const item=source?.[index]||{};Object.assign(context,{_containerIndex:index,'#collection_index':index,'#item_name':item.name||'','#hover_text':item.name||'','#item_count':String(item.count||''),'#stack_count':String(item.count||''),'#item_id_aux':item.id??0,'#item_has_durability':false,'#is_durability_visible':false,'#is_empty':!item.texture});return {context,containerIndex:index,item};
 }
 return {context};
}const buttons=formButtons(simulation,form),index=Number.isInteger(obj.collection_index)?obj.collection_index:parent?._collectionIndex;const context={...parent,_collectionName:collection||'form_buttons','#form_button_contents':buttons.length};if(index===undefined)return {context};const item=buttons[index];return {index,missing:!item,context:{...context,_collectionIndex:index,'#collection_index':index,'#form_button_text':item?.text||'','#form_button_texture':item?.texture||'','#button_id':item?.button_id??'button.form_button_click'}}}
// Collection factories use their data. A selected event factory can additionally
// show one read-only sample per template; this does not simulate game events.
export function instantiateCollections(data,files,file,simulation={},form,{rootName,previewFactory=false}={}){const buttons=formButtons(simulation,form),warnings=[],templates=new Map();let created=0,gridCreated=0;function template(ref){
 if(templates.has(ref))return templates.get(ref);
 const result=resolveTemplate(files,file,ref,simulation.containerTitle!==undefined?{conditional:true,context:simulationVariables(simulation)}:{});
 if(result){
  const mark=(obj,path)=>{const out={...obj,_definitionFile:result.origins.get(JSON.stringify(path))?.file||result.file};if(Array.isArray(obj.controls))out.controls=obj.controls.map((entry,i)=>entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.fromEntries(Object.entries(entry).map(([key,child])=>[key,child&&typeof child==='object'&&!Array.isArray(child)?mark(child,[...path,'controls',i,key]):child])):entry);return out;};
  result.obj=mark(result.obj,[result.name]);
 }
 templates.set(ref,result);return result;
}
function copy(v,generated=false,depth=0,isRoot=false){if(depth>64){warnings.push('集合模板嵌套过深');return {}}if(Array.isArray(v))return v.map(x=>copy(x,generated,depth+1));if(!v||typeof v!=='object')return v;const out={...v};if(generated)out._generated=true;if(Array.isArray(v.controls))out.controls=v.controls.map(entry=>entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.fromEntries(Object.entries(entry).map(([k,x])=>[k,copy(x,generated,depth+1)])):entry);if(v.type==='grid'&&Array.isArray(v.grid_dimensions)&&v.grid_dimensions.length===2){
 const [cols,rows]=v.grid_dimensions.map(Number);
 if(Number.isInteger(cols)&&Number.isInteger(rows)&&cols>0&&rows>0){
  const count=Math.min(cols*rows,1024);if(count<cols*rows)warnings.push('网格预览最多生成 1024 格');
  const target=template(v.grid_item_template),base=target?.obj||{type:'panel'};out.controls=[...(out.controls||[])];
  for(let index=0;index<count;index++){
   const item=copy({...base,type:base.type||'panel',size:base.size||['100%','100%'],collection_name:v.collection_name||base.collection_name||base.$item_collection_name||'container_items',collection_index:index,grid_position:[index%cols,Math.floor(index/cols)],_containerSlot:true,_templateFile:target?.file},true,depth+1);
   out.controls.push({['slot_'+index]:item});gridCreated++;
  }
 }
}
if(v.collection_name==='form_buttons'&&v.factory?.control_ids?.button){const target=template(v.factory.control_ids.button),base=target?.obj;if(!base)warnings.push('未找到按钮工厂模板：'+v.factory.control_ids.button);else{out.controls=[...(out.controls||[])];for(const item of buttons){if(created>=500){warnings.push('集合实例数量达到 500 上限');break}created++;out.controls.push({['button_'+item.index]:copy({...base,_templateFile:target.file,collection_index:item.index},true,depth+1)})}}}const messages=Array.isArray(simulation.chatMessages)&&v.factory?.name==='chat_item_factory'?simulation.chatMessages.slice(-32):undefined;
if(((isRoot&&rootName&&previewFactory)||messages)&&v.factory?.control_ids&&v.collection_name!=='form_buttons'){
 const entries=Object.entries(v.factory.control_ids);out.controls=[...(out.controls||[])];
 if(entries.length>8)warnings.push('事件工厂只预览前 8 个模板样本');
 for(const [id,ref]of entries.slice(0,8)){
  const target=template(ref);
  if(!target){warnings.push('未找到事件工厂模板：'+ref);continue;}
  if(messages){for(const [index,message]of messages.entries())out.controls.push({['event_'+id+'_'+(message.id??index)]:copy({...target.obj,_templateFile:target.file,_eventContext:{'#text':String(message.text??'')},_eventTick:Number(message.tick)||0},true,depth+1)});}
  else out.controls.push({['preview_'+id]:copy({...target.obj,_templateFile:target.file,_factoryPreview:true},true,depth+1)});
 }
}

return out;}return {data:Object.fromEntries(Object.entries(data||{}).map(([k,v])=>[k,!rootName||k===rootName?copy(v,false,0,true):v])),created,gridCreated,warnings};}

export function formButtons(simulation={},form){let entries=buttonCache.get(simulation);if(!entries){entries=new Map();buttonCache.set(simulation,entries)}if(!entries.has(form))entries.set(form,normalizeButtons(simulation,form));return entries.get(form)}
