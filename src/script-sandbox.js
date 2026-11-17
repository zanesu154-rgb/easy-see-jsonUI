// Browser origin boundary: imported code runs in a Worker owned by an opaque sandbox iframe.
// CSP blocks connections and external scripts, including fetch/importScripts/WebSocket/beacons.
const frameSource=`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; child-src blob:; connect-src 'none'"><script>
let worker;addEventListener('message',event=>{if(event.source!==parent)return;const message=event.data;if(message.type==='boot'){worker=new Worker(URL.createObjectURL(new Blob([message.code],{type:'text/javascript'})));worker.onmessage=event=>parent.postMessage(event.data,'*');worker.onerror=event=>parent.postMessage({type:'fatal',message:event.message},'*');}else worker?.postMessage(message);});parent.postMessage({type:'frameReady'},'*');<\/script>`;
let trustedCode;
async function workerCode(){
 if(!trustedCode)trustedCode=Promise.all(['../vendor/babel/babel.min.cjs','./script-engine.js','./script-loader.js','./script-worker.js'].map(path=>fetch(new URL(path,import.meta.url)).then(response=>{if(!response.ok)throw Error('无法加载脚本运行组件');return response.text();}))).then(parts=>parts.map((source,i)=>i?source.replace(/^export /gm,''):source).join('\n')+'\nscriptWorkerMain();').catch(error=>{trustedCode=null;throw error;});
 return trustedCode;
}
export class ScriptSandbox{
 constructor(onMessage){this.onMessage=onMessage;this.sequence=0;this.frame=null;this.requests=new Map();this.generation=0;}
 async start(project,entry,seed={}){this.stop();const generation=this.generation;const code=await workerCode();if(generation!==this.generation)return;this.frame=document.createElement('iframe');this.frame.hidden=true;this.frame.setAttribute('sandbox','allow-scripts');this.frame.setAttribute('aria-hidden','true');this.listener=event=>{
  if(event.source!==this.frame?.contentWindow)return;
  const message=event.data;if(!message||typeof message!=='object')return;
  if(message.type==='frameReady')this.frame.contentWindow.postMessage({type:'boot',code},'*');
  else if(message.type==='ready')this.request({type:'start',entry,sources:project.sources,seed});
  else{this.onMessage(message);if(['snapshot','failed'].includes(message.type)){clearTimeout(this.startTimer);const timer=this.requests.get(message.request);clearTimeout(timer);this.requests.delete(message.request);}if(message.type==='progress')this.arm(message);}
 };window.addEventListener('message',this.listener);this.frame.srcdoc=frameSource;document.body.append(this.frame);this.startTimer=setTimeout(()=>this.timeout(),30000);}
 arm(message){clearTimeout(this.startTimer);this.startTimer=setTimeout(()=>this.timeout(),15000);}
 timeout(){this.stop();this.onMessage({type:'fatal',message:'脚本长时间未响应，已停止。可重启运行；此前导入的文件仍保留。'});}
 request(message){if(!this.frame)return;clearTimeout(this.startTimer);const request=++this.sequence;this.requests.set(request,setTimeout(()=>this.timeout(),15000));this.frame.contentWindow.postMessage({...message,request},'*');}
 stop(){this.generation++;clearTimeout(this.startTimer);for(const timer of this.requests.values())clearTimeout(timer);this.requests.clear();if(this.listener)window.removeEventListener('message',this.listener);this.frame?.remove();this.frame=null;}
}
