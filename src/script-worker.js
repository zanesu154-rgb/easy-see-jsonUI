import {createBedrockRuntime} from './script-engine.js';
import {createScriptLoader} from './script-loader.js';
import {normalizePlayerState} from './player-saves.js';
import {refreshPlayerSession,previewPlayerState} from './player-session.js';
// Serialized into an opaque-origin sandboxed Worker together with trusted engine/loader code.
export function scriptWorkerMain(){
 const send=globalThis.postMessage.bind(globalThis);let runtime=createBedrockRuntime({emit:send});
 const RealDate=globalThis.Date;globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[runtime.now()]));}static now(){return runtime.now();}};
 globalThis.setTimeout=(fn,ms=0,...args)=>runtime.server.system.runTimeout(()=>fn(...args),Math.ceil(ms/50));
 globalThis.setInterval=(fn,ms=0,...args)=>runtime.server.system.runInterval(()=>fn(...args),Math.ceil(ms/50));
 globalThis.clearTimeout=globalThis.clearInterval=id=>runtime.server.system.clearRun(id);
 let loader=null,chain=Promise.resolve(),project=null;const compiledCache=new Map();
 globalThis.console=Object.fromEntries(['log','warn','error','info','debug'].map(level=>[level,(...args)=>runtime.log(level,...args)]));
 globalThis.addEventListener('unhandledrejection',event=>{runtime.error(event.reason);event.preventDefault();});
 globalThis.addEventListener('error',event=>{runtime.error(event.error||event.message);event.preventDefault();});
 globalThis.onmessage=event=>{const message=event.data;chain=chain.then(async()=>{
  const previousRuntime=runtime,previousLoader=loader;
  try{
   if(message.type==='start'){
    project={sources:message.sources,entry:message.entry};runtime=createBedrockRuntime({emit:send,seed:normalizePlayerState(message.seed||{})});
    loader=createScriptLoader({Babel:globalThis.Babel,runtime,sources:message.sources,compiledCache,onProgress:file=>send({type:'progress',file})});
    loader.load(message.entry);
   }else if(message.type==='refresh'){
    const result=await refreshPlayerSession({Babel:globalThis.Babel,...project,seed:message.state,action:message.action,compiledCache,setRuntime:value=>{runtime=value;},onProgress:file=>send({type:'progress',file})});runtime=result.runtime;runtime.setEmitter(send);loader=result.loader;message.blockedWrites=result.blockedWrites;message.reset=true;
   }else if(message.type==='preview'){
    const previous=runtime,result=await previewPlayerState({Babel:globalThis.Babel,...project,seed:normalizePlayerState(message.state),actions:message.actions,compiledCache,setRuntime:value=>{runtime=value;},onProgress:file=>send({type:'progress',file})});runtime=previous;send({type:'preview',request:message.request,...result});return;
   }else if(message.type==='trigger')await runtime.trigger(message.action);
   else if(message.type==='respond')await runtime.respond(message.response);
   else if(message.type==='advance')await runtime.advance(message.ticks);
   send({type:'snapshot',operation:message.type,reset:message.reset||false,blockedWrites:message.blockedWrites||[],request:message.request,...runtime.snapshot(),loaded:loader?.loaded||[]});
  }catch(err){if(message.type==='refresh'||message.type==='preview'){runtime=previousRuntime;loader=previousLoader;}runtime.error(err);send({type:'failed',operation:message.type,reset:message.reset||false,blockedWrites:message.blockedWrites||[],request:message.request,...runtime.snapshot(),loaded:loader?.loaded||[]});}
 });};
 send({type:'ready'});
}
