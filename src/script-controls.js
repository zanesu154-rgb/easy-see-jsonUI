import {scriptProject,actionCandidates} from './script-project.js';
import {ScriptSandbox} from './script-sandbox.js';
import {stripFormatting} from './text.js';
const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
export function scriptLocation(record){const match=/easysee-pack:\/\/\/([^\s)]+?):(\d+):(\d+)/.exec(record.stack||'');const file=match?decodeURI(match[1]):record.file;return file?{file,line:match?Math.max(1,Number(match[2])-2):record.line||1}:null;}
export class ScriptControls{
 constructor(container,{onOutput,onStop,onStart,onSource,statusBar}){
  this.container=container;this.statusBar=statusBar;this.onOutput=onOutput;this.onStop=onStop;this.onStart=onStart;this.onSource=onSource;this.project=null;this.busy=false;this.running=false;this.initialized=false;this.playing=false;this.snapshot=null;this.lastAction=null;
  this.sandbox=new ScriptSandbox(message=>this.receive(message));this.build();
 }
 build(){
  const details=el('details');details.open=true;details.append(el('summary','脚本动作'));this.container.append(details);this.body=el('div');details.append(this.body);
  this.body.append(el('small','主动启动后，脚本在本机隔离环境中运行。世界逻辑近似。停止后恢复此前预览；脚本状态暂不保存。'));
  this.pack=el('select');this.pack.id='scriptPack';this.pack.setAttribute('aria-label','行为包脚本入口');this.body.append(this.pack);
  const controls=el('div');this.start=el('button','启动脚本');this.start.id='startScripts';this.start.onclick=()=>this.boot();this.stopButton=el('button','停止');this.stopButton.id='stopScripts';this.stopButton.onclick=()=>this.stop();controls.append(this.start,this.stopButton);this.body.append(controls);
  this.status=el('small','尚未启动');this.status.id='scriptStatus';this.status.setAttribute('role','status');this.body.append(this.status);
  this.actions=el('select');this.actions.id='scriptAction';this.actions.setAttribute('aria-label','脚本动作');this.body.append(this.actions);
  this.scriptId=el('input');this.scriptId.id='scriptEventId';this.scriptId.placeholder='脚本事件 ID，例如 easysee:test';this.scriptId.setAttribute('aria-label','脚本事件 ID');this.body.append(this.scriptId);
  this.scriptMessage=el('input');this.scriptMessage.id='scriptEventMessage';this.scriptMessage.placeholder='脚本事件内容';this.scriptMessage.setAttribute('aria-label','脚本事件内容');this.body.append(this.scriptMessage);
  this.actions.onchange=()=>this.syncEventFields();
  this.triggerButton=el('button','触发动作');this.triggerButton.id='triggerScriptAction';this.triggerButton.onclick=()=>this.trigger();this.body.append(this.triggerButton);
  this.body.append(el('small','物品动作是从脚本引用中提取的候选项；分支是否响应由脚本决定。'));
  const clock=el('div');clock.className='script-clock';this.play=el('button','播放');this.play.id='playScriptTicks';this.play.onclick=()=>{this.playing=!this.playing;this.update();};this.step=el('button','前进 1 tick');this.step.id='stepScriptTick';this.step.onclick=()=>this.send({type:'advance',ticks:1});this.forward=el('button','快进 1 秒');this.forward.id='forwardScriptTicks';this.forward.onclick=()=>this.send({type:'advance',ticks:20});this.speed=el('select');this.speed.id='scriptSpeed';this.speed.setAttribute('aria-label','脚本时间速度');for(const n of [1,2,4,10]){const option=el('option',n+'×');option.value=n;this.speed.append(option);}this.clock=el('output','0 tick · 0.00 秒');this.clock.id='scriptClock';clock.append(this.play,this.step,this.forward,this.speed,this.clock);this.body.append(clock);
  this.close=el('button','关闭当前表单');this.close.id='closeScriptForm';this.close.onclick=()=>this.respond({canceled:true});this.body.append(this.close);
  const issues=el('details');issues.append(el('summary','未模拟 API / 运行信息'));this.issueList=el('div');this.issueList.id='scriptDiagnostics';issues.append(this.issueList);this.body.append(issues);
  const output=el('details');output.append(el('summary','HUD / 聊天输出'));this.outputText=el('pre');this.outputText.id='scriptOutputs';output.append(this.outputText);this.body.append(output);
  this.errorBar=el('div');this.errorBar.id='scriptErrors';this.body.append(this.errorBar);
  this.timer=setInterval(()=>{if(this.running&&this.playing&&!this.busy)this.send({type:'advance',ticks:Number(this.speed.value)});},50);this.update();
 }
 setFiles(files,{reset=false}={}){
  const project=scriptProject(files);
  // Map identity alone changes during vanilla downloads; compare source text to avoid stopping unnecessarily.
  const changed=reset||!this.project||JSON.stringify(this.project.sources)!==JSON.stringify(project.sources)||JSON.stringify(this.project.packs)!==JSON.stringify(project.packs);
  if(changed){this.stop();const previous=this.pack.value;this.project=project;this.pack.replaceChildren();for(const p of project.packs){const option=el('option',p.name+' · '+p.entry+(p.missing?'（入口缺失）':''));option.value=p.entry;option.disabled=p.missing;this.pack.append(option);}if(project.packs.some(p=>p.entry===previous&&!p.missing))this.pack.value=previous;else this.pack.value=project.packs.find(p=>!p.missing)?.entry||'';this.status.textContent='尚未启动';this.snapshot=null;this.lastError=null;this.scriptId.value='';this.scriptMessage.value='';this.outputText.textContent='';this.actions.replaceChildren();this.candidates=null;this.errorBar.replaceChildren();this.issueList.replaceChildren();}
  this.container.hidden=!project.packs.length;this.update();
 }
 async boot(){
  if(!this.project||!this.pack.value)return;this.stop();this.onStart?.();this.running=true;this.initialized=false;this.busy=true;this.snapshot=null;this.actions.replaceChildren();this.candidates=null;this.status.textContent='正在加载脚本模块…';this.lastError=null;this.errorBar.replaceChildren();this.issueList.replaceChildren();this.update();
  try{await this.sandbox.start(this.project,this.pack.value);}catch(error){if(this.running)this.receive({type:'fatal',message:error.message});}
 }
 stop(){const wasRunning=this.running;this.playing=false;this.running=false;this.busy=false;this.sandbox.stop();if(wasRunning){this.status.textContent='已停止';this.onStop?.();}this.update();}
 send(message){if(!this.running||this.busy)return;this.busy=true;this.update();this.sandbox.request(message);}
 trigger(){const action=this.candidates?.[Number(this.actions.value)];if(!action)return;this.lastAction={...action,scriptId:this.scriptId.value,message:this.scriptMessage.value};this.send({type:'trigger',action:this.lastAction});}
 respond(response){if(!this.snapshot?.form||this.busy)return;this.send({type:'respond',response:{id:this.snapshot.form.id,...response}});}
 receive(message){
  if(message.type==='progress'){this.status.textContent='加载：'+message.file;return;}
  if(message.type==='fatal'){this.lastError=message;this.stop();this.status.textContent=message.message;this.update();return;}
  if(message.type==='error'){this.lastError=message;this.update();this.errorBar.replaceChildren();const button=el('button',message.message);button.onclick=()=>this.openError(message);this.errorBar.append(button);return;}
  if(['form','formClosed','hud'].includes(message.type)){if(message.type==='form'&&this.snapshot){this.snapshot.form=message.form;this.update();}if(message.type==='formClosed'&&this.snapshot?.form?.id===message.id){this.snapshot.form=null;this.update();}if(message.type==='hud')this.renderOutput(message);this.onOutput?.(message);return;}
  if(!['snapshot','failed'].includes(message.type))return;
  this.busy=false;if(message.operation==='start')this.initialized=message.type==='snapshot';this.snapshot=message;this.renderOutput(message.hud);
  if(message.type==='failed'){this.playing=false;this.status.textContent=message.operation==='start'?'脚本入口加载失败；点击错误定位，修复后重启':'脚本操作失败；查看运行信息，可停止后重启';}else this.status.textContent='已加载 '+message.loaded.length+' 个模块 · '+message.unsupported.length+' 种未模拟 API';
  const previous=this.actions.selectedOptions[0]?.textContent,candidates=actionCandidates(this.project,message.loaded,message.events),changed=JSON.stringify(candidates)!==JSON.stringify(this.candidates);this.candidates=candidates;if(changed){this.actions.replaceChildren();for(const [index,action]of this.candidates.entries()){const option=el('option',action.label+(action.phase==='before'?'（使用前）':''));option.value=index;this.actions.append(option);if(option.textContent===previous)this.actions.value=String(index);}}
  this.syncEventFields();this.issueList.replaceChildren();
  for(const issue of message.unsupported.slice(0,100)){const button=el('button',issue.count+' 次 · '+issue.api);button.onclick=()=>this.openError(issue);this.issueList.append(button);}
  for(const row of message.logs.filter(row=>row.level==='warn'||row.level==='error').slice(-15)){const button=el('button',stripFormatting(row.text));button.onclick=()=>this.openError({stack:row.text});this.issueList.append(button);}
  this.update();if(this.initialized)this.onOutput?.({...message,type:'snapshot'});
 }
 renderOutput(hud){if(!hud)return;const text=['标题：'+stripFormatting(hud.title||''),'副标题：'+stripFormatting(hud.subtitle||''),'动作栏：'+stripFormatting(hud.actionbar||''),...(hud.messages||[]).map(row=>'['+row.tick+'] '+stripFormatting(row.text))].join('\n');if(this.outputText.textContent!==text)this.outputText.textContent=text;}
 syncEventFields(){const scriptEvent=this.candidates?.[Number(this.actions.value)]?.event==='scriptEventReceive';this.scriptId.hidden=!scriptEvent;this.scriptMessage.hidden=!scriptEvent;}
 openError(record){const location=scriptLocation(record);if(location)this.onSource?.(location);}
 update(){
  this.start.disabled=this.busy||!this.pack.value;this.start.textContent=this.running?'重置并重启':'启动脚本';this.stopButton.disabled=!this.running;this.triggerButton.disabled=!this.running||!this.initialized||this.busy||!this.actions.options.length;
  for(const button of [this.play,this.step,this.forward])button.disabled=!this.running||!this.initialized||this.busy;
  this.play.textContent=this.playing?'暂停':'播放';this.close.disabled=!this.running||this.busy||!this.snapshot?.form;
  if(this.statusBar){this.statusBar.hidden=!this.running&&!this.lastError;this.statusBar.replaceChildren(el('span',this.running?'脚本 '+(this.playing?'播放':'暂停')+' · '+(this.snapshot?.tick||0)+' tick · '+(this.snapshot?.unsupported?.length||0)+' 种未模拟 API':''));if(this.lastError){const location=scriptLocation(this.lastError),node=el(location?'button':'span',(location?location.file.split('/').at(-1)+':'+location.line+' · ':'')+this.lastError.message);node.title=(location?location.file+':'+location.line+' · ':'')+this.lastError.message;if(location)node.onclick=()=>this.openError(this.lastError);this.statusBar.append(node);}}
  this.onState?.();
  this.clock.textContent=(this.snapshot?.tick||0)+' tick · '+((this.snapshot?.tick||0)/20).toFixed(2)+' 秒';
 }
}
export function renderRuntimeForm(container,form,respond){
 if(form&&container.dataset.formId===String(form.id)){container.hidden=false;return;}container.dataset.formId=String(form?.id||'');container.replaceChildren();container.hidden=!form;if(!form)return;
 const card=el('div');card.className='runtime-form-card';card.append(el('small',form.kind==='modal'?'输入表单 · 标准控件近似':'脚本表单 · 标准布局'));card.append(el('h2',stripFormatting(form.title)),el('p',stripFormatting(form.body)));
 if(form.kind==='modal'){
  const inputs=form.fields.map(field=>{const label=el('label',stripFormatting(field.label));let input;
   if(field.kind==='dropdown'){input=el('select');field.options.forEach((value,index)=>{const option=el('option',stripFormatting(value));option.value=index;input.append(option);});input.value=field.defaultValue;}
   else{input=el('input');input.type=field.kind==='toggle'?'checkbox':field.kind==='slider'?'range':'text';if(field.kind==='toggle')input.checked=field.defaultValue;else input.value=field.defaultValue;if(field.kind==='slider'){input.min=field.min;input.max=field.max;input.step=field.step;const value=el('output',String(input.value));input.oninput=()=>value.textContent=input.value;label.append(value);}if(field.kind==='text')input.placeholder=field.placeholder;}
   label.append(input);card.append(label);return {field,input};
  });const submit=el('button',form.submit||'提交');submit.onclick=()=>respond({values:inputs.map(({field,input})=>field.kind==='toggle'?input.checked:['slider','dropdown'].includes(field.kind)?Number(input.value):input.value)});card.append(submit);
 }else (form.elements?.length?form.elements:form.buttons).forEach((item,index)=>{if(item.kind&&item.kind!=='button'){card.append(el(item.kind==='divider'?'hr':'p',stripFormatting(item.text)));return;}const button=el('button',stripFormatting(item.text));button.dataset.runtimeIndex=item.index??index;button.onclick=()=>respond({selection:item.index??index});card.append(button);});
 const close=el('button','关闭');close.onclick=()=>respond({canceled:true});card.append(close);container.append(card);
}
