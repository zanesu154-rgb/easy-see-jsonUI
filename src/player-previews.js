import {ScriptSandbox} from './script-sandbox.js';
import {actionCandidates} from './script-project.js';
import {playerStateSignature} from './player-saves.js';
import {inferChannels,channelValue} from './simulation-tools.js';
import {instantiateCollections} from './collections.js';
import {cached} from './cache.js';
import {sampleCatalog} from './state-samples.js';
import {interfaceCategory,routeMatches} from './navigation.js';
export function projectStateHash(project){let hash=2166136261;for(const [file,source]of Object.entries(project?.sources||{}).sort(([a],[b])=>a.localeCompare(b)))for(const character of file+'\n'+source){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16);}
export class PlayerPreviewCatalog{
 constructor(onChange){this.onChange=onChange;this.cache={status:'idle',outputs:[]};this.generation=0;}
 stop(){this.generation++;this.sandbox?.stop();this.sandbox=null;}
 invalidate(status='idle'){this.stop();this.cache={status,outputs:[]};this.onChange?.(this.cache);}
 restore(cache,state,sourceHash,entry){if(cache?.status==='ready'&&cache.key===entry+'|'+sourceHash+'|'+playerStateSignature(state)){this.stop();this.cache=structuredClone(cache);this.onChange?.(this.cache);return true;}return false;}
 async generate(controller,state){
  const entry=controller.entry||controller.pack.value,key=entry+'|'+controller.sourceHash+'|'+playerStateSignature(state);if(this.cache.key===key&&['ready','loading'].includes(this.cache.status))return;
  this.stop();const generation=this.generation;this.cache={status:'loading',key,entry,outputs:[]};this.onChange?.(this.cache);
  const sandbox=this.sandbox=new ScriptSandbox(message=>{
   if(generation!==this.generation)return;
   if(message.type==='snapshot'&&message.operation==='start'){
    const all=actionCandidates(controller.project,message.loaded,message.events).filter(action=>action.event==='itemUse'&&action.item&&Object.values(controller.project.sources).some(source=>(source.includes('"'+action.item+'"')||source.includes("'"+action.item+"'"))&&/new\s+(ActionFormData|ModalFormData|MessageFormData)\b/.test(source)));
    const actions=[...(controller.lastAction?[controller.lastAction]:[]),{event:'__easysee_preview_idle',label:'当前存档'},...all].filter((action,index,list)=>list.findIndex(other=>JSON.stringify(other)===JSON.stringify(action))===index).slice(0,12);
    sandbox.request({type:'preview',state,actions});
   }else if(message.type==='preview'){
    this.cache={status:'ready',key,entry,outputs:message.outputs,limited:message.limited,attempts:message.attempts};sandbox.stop();this.onChange?.(this.cache);
   }else if(message.type==='fatal'||message.type==='failed'){
    sandbox.stop();this.cache={status:'failed',key,outputs:[],message:message.message||'部分预览脚本无法运行'};this.onChange?.(this.cache);
   }
  });
  try{await sandbox.start(controller.project,controller.entry||controller.pack.value,state);}catch(error){if(generation===this.generation){this.cache={status:'failed',key,outputs:[],message:error.message};this.onChange?.(this.cache);}}
 }
}
export function playerCardSimulation(files,screen,route,state,cache,base,{hudExamples=false}={}){
 if(!state||!cache)return null;
 const expanded=cached(files,'save-card-object:'+screen.id,()=>{
  const {name,obj}=screen.node;
  return obj.factory?instantiateCollections({[name]:obj},files,screen.file,{},null,{rootName:name,previewFactory:true}).data[name]:obj;
 });
 const cardSchemas=cached(files,'save-card:'+screen.id,()=>inferChannels(expanded,files));
 const runtime=route&&route.kind!=='container'||cardSchemas.length;
 if(!runtime)return {simulation:{...base,inventoryItems:state.inventory.map(item=>item?{name:item.nameTag||item.typeId,count:item.amount,texture:'textures/items/'+item.typeId.split(':').at(-1)}:null)},status:'ready'};
 if(cache.status==='loading')return {status:'pending',caption:'正在按当前存档预览…'};
 const toSimulation=output=>{
  const bindings={...base.bindings};
  for(const name of ['#title_text','#body_text','#form_text','#hud_title_text_string','#hud_subtitle_text_string','#hud_actionbar_text_string'])delete bindings[name];
  bindings['#text']=output.hud?.messages?.at(-1)?.text||'';
  return {...base,bindings,formTitle:output.form?.title||'',formBody:output.form?.body||'',formButtons:output.form?.buttons||[],title:output.hud?.title||'',subtitle:output.hud?.subtitle||'',actionbar:output.hud?.actionbar||''};
 };
 if(route&&route.kind!=='container'){const output=cache.outputs.find(output=>output.form&&routeMatches(route,output.form.title));return output?{simulation:toSimulation(output),status:'ready'}:{status:'unavailable',caption:'此存档的预览动作尚未打开该分支'};}
 for(const output of cache.outputs){if(!output.hud)continue;const simulation=toSimulation(output);for(const schema of cardSchemas){if(schema.channel==='#text'){const message=output.hud.messages?.findLast(message=>message.text.startsWith(schema.prefix));if(message)simulation.bindings['#text']=message.text;}if(schema.prefix&&channelValue(simulation,schema.channel).startsWith(schema.prefix))return {simulation,status:'ready'};}}
 if(hudExamples&&interfaceCategory(screen)==='HUD'){
  const recipe=cached(files,'save-card-example:'+screen.id,()=>sampleCatalog(expanded,files,screen.file,{channelOnly:true})[0]?.recipes[0]);
  if(recipe)return {simulation:recipe.make(toSimulation({})),status:'example',caption:'示例 · 当前存档暂无此通道输出'};
 }
 return {status:'unavailable',caption:cache.status==='ready'?'当前存档未触发此通道':'当前存档尚未生成脚本预览'};
}
