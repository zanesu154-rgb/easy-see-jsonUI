import {createBedrockRuntime} from './script-engine.js';
import {createScriptLoader} from './script-loader.js';
import {normalizePlayerState,playerStateSignature} from './player-saves.js';
export function playerStateChanges(before,after){
 const result=[];for(const owner of ['player','world','scores'])for(const key of new Set([...Object.keys(before[owner]||{}),...Object.keys(after[owner]||{})]))if(JSON.stringify(before[owner]?.[key])!==JSON.stringify(after[owner]?.[key]))result.push(owner+':'+key);
 for(const owner of ['tags','inventory','dimension'])if(JSON.stringify(before[owner])!==JSON.stringify(after[owner]))result.push(owner);return result;
}
// Refreshing a state must never silently grant another item or advance a
// progression counter. Execute speculatively, then commit only an idempotent
// reopen. Explicit user actions remain ordinary mutable game operations.
export async function refreshPlayerSession({Babel,sources,entry,seed,action,compiledCache=new Map(),onProgress=()=>{},setRuntime=()=>{}}){
 seed=normalizePlayerState(seed);const build=()=>{const runtime=createBedrockRuntime({seed,emit:()=>{}}),loader=createScriptLoader({Babel,runtime,sources,onProgress,compiledCache});setRuntime(runtime);loader.load(entry);return {runtime,loader};};
 const candidate=build();if(action)await candidate.runtime.trigger({...action,equip:false});
 const after=candidate.runtime.snapshot().state,changes=playerStateChanges(seed,after);
 if(playerStateSignature(seed)===playerStateSignature(after))return {...candidate,blockedWrites:[]};
 const fallback=build();fallback.runtime.applyState(seed);fallback.runtime.clearOutputs();return {...fallback,blockedWrites:changes};
}
// Thumbnail probing has a separate sandbox. Every path starts from the same
// immutable save; responses that change storage are never used as navigation.
export async function previewPlayerState({Babel,sources,entry,seed,actions=[],compiledCache=new Map(),onProgress=()=>{},setRuntime=()=>{},limit=32}){
 const outputs=[],seen=new Set(),queue=actions.slice(0,12).map(action=>({action,path:[]}));let attempts=0;
 const signature=snapshot=>JSON.stringify([snapshot.form?.kind,snapshot.form?.title,snapshot.form?.body,snapshot.form?.buttons,snapshot.hud]);
 while(queue.length&&attempts<limit){const task=queue.shift(),runtime=createBedrockRuntime({seed,emit:()=>{}}),loader=createScriptLoader({Babel,runtime,sources,onProgress,compiledCache});setRuntime(runtime);attempts++;
  try{loader.load(entry);await runtime.trigger({...task.action,equip:false});let valid=true;
   for(const step of task.path){const before=runtime.snapshot();if(before.form?.title!==step.title||before.form?.buttons[step.index]?.text!==step.text){valid=false;break;}await runtime.respond({id:before.form.id,selection:step.index});if(playerStateSignature(before.state)!==playerStateSignature(runtime.snapshot().state)){valid=false;break;}}
   if(!valid)continue;const snapshot=runtime.snapshot(),key=signature(snapshot);if(seen.has(key))continue;seen.add(key);outputs.push({form:snapshot.form,hud:snapshot.hud});
   if(snapshot.form?.kind==='action'&&task.path.length<3)for(let index=0;index<Math.min(10,snapshot.form.buttons.length);index++){const button=snapshot.form.buttons[index];if(button&&!button.kind)queue.push({action:task.action,path:[...task.path,{title:snapshot.form.title,index,text:button.text}]});}
   await runtime.advance(20);outputs.push({form:runtime.snapshot().form,hud:runtime.snapshot().hud});
  }catch(error){outputs.push({error:String(error.message||error)});}
  await Promise.resolve();
 }
 return {outputs,attempts,limited:queue.length>0};
}
