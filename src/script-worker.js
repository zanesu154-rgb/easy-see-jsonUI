// Serialized into an opaque-origin sandboxed Worker together with trusted engine/loader code.
export function scriptWorkerMain(){
 const send=globalThis.postMessage.bind(globalThis);let runtime=createBedrockRuntime({emit:send});
 const RealDate=globalThis.Date;globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[runtime.now()]));}static now(){return runtime.now();}};
 globalThis.setTimeout=(fn,ms=0,...args)=>runtime.server.system.runTimeout(()=>fn(...args),Math.ceil(ms/50));
 globalThis.setInterval=(fn,ms=0,...args)=>runtime.server.system.runInterval(()=>fn(...args),Math.ceil(ms/50));
 globalThis.clearTimeout=globalThis.clearInterval=id=>runtime.server.system.clearRun(id);
 let loader=null,chain=Promise.resolve();
 globalThis.console=Object.fromEntries(['log','warn','error','info','debug'].map(level=>[level,(...args)=>runtime.log(level,...args)]));
 globalThis.addEventListener('unhandledrejection',event=>{runtime.error(event.reason);event.preventDefault();});
 globalThis.addEventListener('error',event=>{runtime.error(event.error||event.message);event.preventDefault();});
 globalThis.onmessage=event=>{const message=event.data;chain=chain.then(async()=>{
  try{
   if(message.type==='start'){
    runtime=createBedrockRuntime({emit:send,seed:message.seed||{}});
    loader=createScriptLoader({Babel:globalThis.Babel,runtime,sources:message.sources,onProgress:file=>send({type:'progress',file})});
    loader.load(message.entry);
   }else if(message.type==='trigger')await runtime.trigger(message.action);
   else if(message.type==='respond')await runtime.respond(message.response);
   else if(message.type==='advance')await runtime.advance(message.ticks);
   send({type:'snapshot',operation:message.type,request:message.request,...runtime.snapshot(),loaded:loader?.loaded||[]});
  }catch(err){runtime.error(err);send({type:'failed',operation:message.type,request:message.request,...runtime.snapshot(),loaded:loader?.loaded||[]});}
 });};
 send({type:'ready'});
}
