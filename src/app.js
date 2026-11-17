import {scriptHudScreen} from './script-output.js';
import {ScriptControls,renderRuntimeForm} from './script-controls.js';
import {sampleCatalog} from './state-samples.js';
import {StateSampleControls} from './state-sample-controls.js';
import {cached} from './cache.js';
import {previewReadiness} from './preview-readiness.js';
import {Playback} from './playback.js';
import {Comparison} from './comparison.js';
import {Presets,validateSimulation} from './presets.js';
import {renderFields,renderMatrix,buttonComparisons} from './simulation-studio.js';
import {controlBudget} from './control-budget.js';
import {appendPhysicalFiles} from './physical-files.js';
import {fieldSample} from './form-titles.js';
import {interfaceCards} from './interface-cards.js';
import {navigationModel,routeForTitle,routeForSelection,routeMatches,titleSample,searchControls} from './navigation.js';
import {interfaceTree} from './navigation-view.js';
import {editValue,sourceInput} from './source-edit.js';
import {EditSession,isEditorFile} from './edit-session.js';
import {lineChanges,decodeText} from './export-diff.js';
import {presentScene,clipInsets,pointInRect} from './scene-presentation.js';
import {PreviewFont} from './preview-font.js';
import {collectionStats} from './collection-stats.js';
import {paintGameText} from './text-layout.js';
import {SourceDrafts} from './source-drafts.js';
import {mergeImport} from './import-resources.js';
import {layoutScene} from './layout.js';
import {sceneIssues} from './diagnostics.js';
import {renderIssues} from './issue-list.js';
import {textureStyle} from './texture-style.js';
import {stripFormatting} from './text.js';
import {fontMetrics,FONT_SIZES} from './font.js';
import {installButtonStates} from './button-states.js';
import {formButtons,instantiateCollections} from './collections.js';
import {officialCache} from './official-resources.js';
import {removeShadowedVanilla,sweepOfficial} from './resource-overrides.js';
import {loadOfficial,OFFICIAL_REF} from './official-resources.js';
import {isVanilla,installVanilla,textureResource} from './resources.js';
import {desktopViewport,fitScale,sceneForForm,titleForScene} from './scene.js';
import {textRuns} from './text.js';
import {texturePath} from './runtime.js';
import {invalidate} from './cache.js';
import {resolveProject,resolveScene} from './resolver.js';
import {screens} from './project.js';
import {parse,nodes,at} from './core.js';
const sourceDrafts=new SourceDrafts();
const previewFont=new PreviewFont();
const editSession=new EditSession();
const sourceApplications=new Map();
const routePresets=new Map();
const presets=new Presets();
let sceneInfo=null,currentInstances=null,currentResolved=null,previewSceneKey='';
let sceneNodes=[],navigationOrigin=null,lastPick=null,homeVisible=false,homeModel=null;
const $=id=>document.getElementById(id);let files=new Map(),current='',selection='',history=[],future=[],urls=[],expanded=new Set(),mode='edit',activeForm=null,simulation={},runtimeNodes=new Map(),appendImport=false;
let applyingSample=false;
const stateSamples=new StateSampleControls($('stateSamples'),{onApply:(value,options)=>{applyingSample=true;try{applySimulation(value);if(options.restoreDraft!==undefined)$('simulation').value=options.restoreDraft;}finally{applyingSample=false;}},onError:toast,getDraft:()=>$('simulation').value});
let runtimeForm=null,runtimeHud=null,runtimeBase=null,runtimePending=false,runtimeDisplayKey='',runtimeTick=0,runtimeVisualKey='',runtimeSceneTick=0;
const scriptRuntime=new ScriptControls($('scriptRuntime'),{
 onOutput:receiveScriptOutput,onSource:showScript,statusBar:$('scriptRunStatus'),
 onStart:()=>{runtimeBase={simulation:structuredClone(simulation),mode,activeForm,current,selection,homeVisible,navigationOrigin,draft:$('simulation').value,animation:$('animationEnabled').checked,dual:$('dualPreview').checked};playback.pause();$('dualPreview').checked=false;runtimeTick=0;runtimeVisualKey='';runtimeSceneTick=0;runtimeDisplayKey='';},
 onStop:()=>{runtimeForm=null;runtimeHud=null;runtimeDisplayKey='';renderRuntimeForm($('scriptFormView'),null);if(runtimeBase){simulation=runtimeBase.simulation;mode=runtimeBase.mode;activeForm=runtimeBase.activeForm;if(files.has(runtimeBase.current)){current=runtimeBase.current;selection=runtimeBase.selection;homeVisible=runtimeBase.homeVisible;navigationOrigin=runtimeBase.navigationOrigin;}const draft=runtimeBase.draft;playback.releaseScript();$('animationEnabled').checked=runtimeBase.animation;$('dualPreview').checked=runtimeBase.dual;runtimeBase=null;$('mode').value=mode;document.body.dataset.mode=mode;syncSimulation();$('simulation').value=draft;render();}}
});
function receiveScriptOutput(message){
 if(message.type==='form')runtimeForm=message.form;
 if(message.type==='formClosed')runtimeForm=null;
 if(message.type==='hud')runtimeHud={title:message.title,subtitle:message.subtitle,actionbar:message.actionbar,messages:message.messages};
 if(message.type==='snapshot'){runtimeForm=message.form;runtimeHud=message.hud;runtimeTick=message.tick;}
 if(runtimePending)return;runtimePending=true;requestAnimationFrame(()=>{runtimePending=false;if(scriptRuntime.running){paintScriptOutput();if(!homeVisible)playback.followScript(runtimeTick/20);}});
}
function paintScriptOutput(){
 const key=JSON.stringify([runtimeForm,runtimeHud]);if(key===runtimeDisplayKey)return;runtimeDisplayKey=key;
 mode='preview';$('mode').value=mode;document.body.dataset.mode=mode;activeForm=null;homeVisible=false;
 const bindings={...simulation.bindings};for(const name of ['#title_text','#body_text','#form_text','#text','#hud_title_text_string','#hud_subtitle_text_string','#hud_actionbar_text_string'])delete bindings[name];
 simulation={...simulation,bindings,title:runtimeHud?.title||'',subtitle:runtimeHud?.subtitle||'',actionbar:runtimeHud?.actionbar||'',formTitle:runtimeForm?.title||'',formBody:runtimeForm?.body||'',formButtons:runtimeForm?.buttons||[],chatMessages:runtimeHud?.messages||[]};
 const route=runtimeForm?.kind==='action'&&routeForTitle(model(),runtimeForm.title);
 if(route){current=route.screen.file;selection=route.node.id;navigationOrigin=null;}
 else if(!runtimeForm){const last=runtimeHud?.messages?.at(-1)?.text||'';if(last)simulation.bindings['#text']=last;const project=screens(files),target=scriptHudScreen(files,simulation,[...project.entries,...(project.custom||[])],current+'::'+selection);if(target){current=target.file;selection=target.node.id;}}
 const visualKey=JSON.stringify([current,JSON.parse(selection||'[]')[0],runtimeForm?.id,runtimeForm?null:[runtimeHud?.title,runtimeHud?.subtitle,runtimeHud?.actionbar]]);if(visualKey!==runtimeVisualKey){runtimeVisualKey=visualKey;runtimeSceneTick=runtimeTick;}simulation.runtimeSceneTick=runtimeSceneTick;
 syncSimulation();render();
 const custom=runtimeForm?.kind==='action'&&route&&route.kind!=='fallback'&&route.sample!==undefined&&$('canvas').querySelectorAll('.control').length>1;
 renderRuntimeForm($('scriptFormView'),runtimeForm&&!custom?runtimeForm:null,response=>scriptRuntime.respond(response));
 if(runtimeForm)$('screenName').textContent=runtimeForm.title+' · 脚本运行';
}

const comparison=new Comparison($('comparison'));
const playback=new Playback((time,enabled)=>comparison.frame(time,enabled),()=>renderStageFour());

const text=bytes=>new TextDecoder('utf-8',{ignoreBOM:true}).decode(bytes);const bytes=s=>new TextEncoder().encode(s);
function toast(s){$('toast').textContent=s;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',5000)}
function snapshot(){return {files:new Map(files),current,selection,editing:editSession.snapshot(),presets:presets.text()}}function restore(s){files=s.files;current=s.current;selection=s.selection;editSession.restore(s.editing);presets.load(s.presets);scriptRuntime.setFiles(files);render()}function record(){invalidate(files);history.push(snapshot());if(history.length>50)history.shift();future=[]}
function data(){return parse(text(files.get(current)||new Uint8Array()))}
function fileProtection(){return editSession.protected(current,files.get(current));}
function assertWritable(){if(!files.has(current)||fileProtection().locked)throw Error('当前文件只读：'+(fileProtection().reason||'文件不存在')+'。请修改生成器或取消生成文件标记。');}
function editCurrent(path,value){
  assertWritable();hideHome();const original=text(files.get(current)),next=editValue(original,path,value);
  if(next===original)return;
  record();files.set(current,bytes(next));
}
function button(label,fn,cls=''){const el=document.createElement('button');el.textContent=label;el.className=cls;el.onclick=fn;return el}
function render(){lastPick=null;urls.forEach(URL.revokeObjectURL);urls=[];$('tree').replaceChildren();$('properties').replaceChildren();$('issues').replaceChildren();$('canvas').replaceChildren();$('undo').disabled=!history.length;$('redo').disabled=!future.length;$('export').disabled=!files.size;const parsed=data();const rootName=JSON.parse(selection||'[]')[0],resolved=resolveScene(files,current,simulation,rootName);const instances=instantiateCollections(resolved.data,files,current,simulation,activeForm,{rootName,previewFactory:true});currentResolved=resolved;currentInstances=instances;const ns=nodes(instances.data);if(!ns.some(n=>n.id===selection))selection=ns[0]?.id||'';const selected=ns.find(n=>n.id===selection);const project=screens(files,$('showOriginal').checked);let activeRoot=selected;while(activeRoot?.parent)activeRoot=activeRoot.parent;
const model=navigationModel(files,project);sceneNodes=ns;
if($('browseView').value==='files'){
const projectGroups=new Map();let groupKey='',groupBody;for(const screen of project.entries){const key=screen.file+'::'+screen.namespace;if(key!==groupKey){groupKey=key;const group=document.createElement('details');group.open=screen.file===current;const heading=document.createElement('summary');heading.textContent=(screen.namespace||'界面覆盖')+' · '+screen.file;group.append(heading);groupBody=document.createElement('div');group.append(groupBody);projectGroups.set(key,{group,body:groupBody});$('tree').append(group)}const active=screen.file===current&&screen.node.id===activeRoot?.id;const open=expanded.has(screen.id);const row=button((open?'▾ ':'▸ ')+screen.node.name,()=>{activeForm=null;const title=titleForScene(screen,simulation);if(title!==undefined)simulation={...simulation,formTitle:title};current=screen.file;selection=screen.node.id;if(open)expanded.delete(screen.id);else expanded.add(screen.id);render()},'tree-item file'+(active?' active':''));row.title=screen.file;groupBody.append(row);if(open){const treeResolved=resolveProject(files,screen.file);const children=nodes(instantiateCollections(treeResolved.data,files,screen.file,simulation,activeForm,{rootName:screen.node.name}).data);for(const n of children){let root=n;while(root.parent)root=root.parent;if(root.id!==screen.node.id||!n.parent)continue;if(!$('showOriginal').checked&&isVanilla(treeResolved.origins.get(n.id)?.file||''))continue;const el=button('└ '+n.name,()=>{activeForm=null;if(current!==screen.file||JSON.parse(selection||'[]')[0]!==n.path[0]){current=screen.file;selection=n.id;render()}else selectNode(n)},'tree-item'+(screen.file===current&&selection===n.id?' active':''));el.dataset.node=n.id;el.dataset.file=screen.file;el.style.paddingLeft=(12+(n.path.length-1)/3*14)+'px';groupBody.append(el);}for(const rule of screen.triggers){const hint=document.createElement('small');hint.textContent='名称触发：'+rule.name+' · '+rule.fields.join(', ')+' · '+rule.kind;hint.title=rule.expression;groupBody.append(hint);}for(const link of screen.links){const hint=document.createElement('small');hint.textContent='可能关联脚本：'+(link.displayTitle||stripFormatting(link.title))+' · '+link.file+':'+link.line;groupBody.append(hint);}}}
if(project.custom?.length){
  const groups=new Map();
  for(const screen of project.custom){
    const key=screen.file+'::'+screen.namespace;
    if(!groups.has(key)){
      let owner=projectGroups.get(key);
      if(!owner){const group=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');summary.textContent=screen.namespace+' · '+screen.file;group.append(summary,body);$('tree').append(group);owner={group,body};projectGroups.set(key,owner);}
      owner.group.open=true;
      const group=document.createElement('details'),heading=document.createElement('summary');group.open=true;
      heading.textContent='自定义控件（'+project.custom.filter(s=>s.file===screen.file&&s.namespace===screen.namespace).length+'）';group.append(heading);owner.body.append(group);groups.set(key,group);
    }
    const row=button(screen.namespace+' · '+screen.node.name,()=>{activeForm=null;current=screen.file;selection=screen.node.id;render()},'tree-item'+(current===screen.file&&activeRoot?.id===screen.node.id?' active':''));
    row.title=screen.insertions.map(i=>'插入位置：'+i.file+' → '+i.root+' · '+i.operation).join('\n');groups.get(key).append(row);
  }
}if(project.templates.length){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='引用模板（'+project.templates.length+'，非独立界面）';details.append(summary);for(const template of project.templates){const el=button(template.namespace+' · '+template.node.name,()=>{activeForm=null;current=template.file;selection=template.node.id;render()},'tree-item');el.title=template.file;details.append(el)}$('tree').append(details)}appendPhysicalFiles($('tree'),files,project,projectGroups,{current,showOriginal:$('showOriginal').checked,open:(file,id)=>{hideHome();activeForm=null;current=file;selection=id;render();}});}else {const holder=document.createElement('div');holder.id='interfaceContents';$('tree').append(holder);interfaceTree(holder,model,{file:current,selected,ns,openScreen,openRoute,selectControl:selectNode});}
if(project.forms.length){const heading=document.createElement('div');heading.className='heading';heading.textContent='脚本表单（静态识别）';$('tree').append(heading);for(const form of project.forms){$('tree').append(button('◇ '+(form.displayTitle||stripFormatting(form.title)),()=>showForm(form),'tree-item'));}}

$('screenName').textContent=current||'界面预览';showSource();const scene=draw(ns,instances.warnings);renderSearch();const issues=sceneIssues({parsed,resolved,ns,runtime:scene.runtime,files,file:current,rootName:selected?.path[0],layoutIssues:scene.issues});$('count').textContent=`(${issues.length} 类 / ${issues.reduce((sum,i)=>sum+i.count,0)} 项)`;renderIssues($('issues'),issues,issue=>{if(issue.path)selection=JSON.stringify(issue.path);render()});updateNavigation(project,ns,selected);if(selected)properties(selected);else $('properties').textContent=parsed.error?'当前文件解析失败：'+parsed.error:files.has(current)?'当前文件没有可选控件，可在源码中检查定义。':'导入资源包，或打开示例开始编辑。';renderHome();renderStudio();renderStageFour();}
function showSource(){
  const draft=sourceDrafts.read(current,files.has(current)?text(files.get(current)):'');
  $('source').value=draft.text;
  const protection=fileProtection();
  $('source').readOnly=protection.locked||!files.has(current);
  $('generatedFile').disabled=isVanilla(current)||!files.has(current);
  $('generatedFile').checked=protection.locked&&!isVanilla(current);
  $('fileProtection').textContent=protection.locked?'只读：'+protection.reason+'。请修改生成器；工程设置单独保存，不进入资源包。':'属性编辑和拖动仅修改对应值，保留注释与格式。生成文件标记可单独导出为工程设置。';
  $('apply').disabled=$('source').readOnly;
  $('sourceStatus').textContent=draft.conflict?'源码草稿基于旧版本；应用将覆盖当前文件。':draft.dirty?'源码草稿尚未应用，不会写入导出文件。':data().error?'当前文件解析失败：'+data().error:sourceApplications.get(current)===text(files.get(current)||new Uint8Array())?'已应用':'';
}
$('source').oninput=()=>{
  if(!current||fileProtection().locked)return;
  sourceDrafts.update(current,sourceInput($('source').value,text(files.get(current)||new Uint8Array())),text(files.get(current)||new Uint8Array()));
  const draft=sourceDrafts.read(current,text(files.get(current)||new Uint8Array()));
  $('sourceStatus').textContent=draft.conflict?'源码草稿基于旧版本；应用将覆盖当前文件。':draft.dirty?'源码草稿尚未应用，不会写入导出文件。':data().error?'当前文件解析失败：'+data().error:sourceApplications.get(current)===text(files.get(current)||new Uint8Array())?'已应用':'';
};
function properties(n){const raw=fileProtection().locked||n.obj._generated?null:at(data().data,n.path);const resource=textureResource(files,current,runtimeNodes.get(n.id)?.texture??n.obj.texture);if(n.obj.texture!==undefined||runtimeNodes.get(n.id)?.texture!==undefined){const info=document.createElement('small');info.textContent=resource.path?'贴图来源：'+resource.source+' · '+resource.path:resource.message||'未设置贴图';$('properties').append(info);}const runtime=runtimeNodes.get(n.id);if(runtime?._collectionIndex!==undefined){const info=document.createElement('small');info.textContent='表单按钮序号：'+runtime._collectionIndex+'（从 0 开始）';$('properties').append(info);}if(runtime?._trace?.length){const trace=document.createElement('pre');trace.style.whiteSpace='pre-wrap';trace.textContent=runtime._trace.map(t=>t.expression+' → '+(t.error||JSON.stringify(t.value))).join('\n');$('properties').append(trace);}const origin=document.createElement('small');origin.textContent='实例文件：'+current+(n.name.includes('@')?' · 继承：'+n.name.split('@')[1]:'');$('properties').append(origin);const title=document.createElement('h3');title.textContent=n.name;$('properties').append(title);const tag=document.createElement('div');tag.className='tag';tag.textContent=n.obj.type||'未指定类型 / 继承控件';$('properties').append(tag);const note=document.createElement('small');note.textContent=raw?'显示继承和变量解析后的值；修改会写入当前实例覆盖值。保留原文件注释与格式。':(fileProtection().locked?'当前文件受保护：'+fileProtection().reason+'。请修改生成器。':'此子控件来自继承模板，当前只读。可通过下方按钮跳转定义。');if(!raw){const template=resolveProject(files,current).origins.get(n.id);if(template?.file)$('properties').append(button('打开定义文件',()=>{current=template.file;selection='';render()}));}$('properties').append(note);for(const key of ['type','size','offset','anchor_from','anchor_to','text','font_size','font_scale_factor','color','alpha','texture','visible','layer']){const label=document.createElement('label');label.textContent=key==='texture'?'贴图路径（texture）':key;const input=document.createElement('input');input.value=n.obj[key]===undefined?'':typeof n.obj[key]==='string'?n.obj[key]:JSON.stringify(n.obj[key]);input.placeholder=key==='texture'?'例如 textures/ui/my_button':key==='font_size'?'normal / small / large / 数字':'未设置';input.disabled=!raw;input.title=!raw?(fileProtection().locked?'只读：'+fileProtection().reason:'继承子控件：请在定义文件中修改'):'修改写入当前实例的覆盖值';input.onchange=()=>{let value=input.value;try{if(!value.trim()){editCurrent([...n.path,key],undefined);render();return}if(['size','offset','color'].includes(key)){value=JSON.parse(value);if(!Array.isArray(value)||value.length!==(key==='color'?3:2))throw Error('请输入正确长度的数组')}else if(key==='font_size'&&Object.hasOwn(FONT_SIZES,value)){}else if(['font_size','font_scale_factor','alpha','layer'].includes(key)){value=Number(value);if(!Number.isFinite(value))throw Error('请输入数字或有效字号名称');if(['font_size','font_scale_factor'].includes(key)&&(value<0||(key==='font_size'&&value===0)))throw Error('字号必须大于 0，缩放不能小于 0')}else if(key==='visible'){if(!['true','false'].includes(value))throw Error('请输入 true 或 false');value=value==='true'}editCurrent([...n.path,key],value);render()}catch(e){toast(e.message)}};label.append(input);$('properties').append(label)}}
function draw(ns,collectionWarnings=[]) {
  const {width:w,height:h}=desktopViewport($('resolution').value,Number($('guiScale').value));
  const zoom=canvasScale(w,h),canvas=$('canvas');
  Object.assign(canvas.style,{width:w+'px',height:h+'px',transform:`scale(${zoom})`});
  canvas.dataset.scale=zoom;$('stage').style.width=w*zoom+'px';$('stage').style.height=h*zoom+'px';
  let root=ns.find(n=>n.id===selection);while(root?.parent)root=root.parent;
  const scene=layoutScene(ns,root?.id,{width:w,height:h,form:activeForm,simulation,mode,measureText:previewFont.measure});
  runtimeNodes=scene.runtime;
  const elements=new Map(),states=new Map(),textureCache=new Map();
  const resource=value=>{if(!textureCache.has(value))textureCache.set(value,textureResource(files,current,value));return textureCache.get(value);};
  for(const [id]of scene.rects)if(runtimeNodes.get(id)?.type==='button')states.set(id,mode==='edit'?$('buttonState').value:'default');
  const updateStats=presentation=>{
    const hidden=[...elements.values()].filter(el=>el.closest('[hidden]')).length;
    $('controlStats').textContent=`定义控件 ${scene.total} · 已建 ${elements.size} · 显示 ${elements.size-hidden} · 已建但隐藏 ${hidden} · 未建隐藏 ${scene.pruned}`;
    const stats=collectionStats(scene,presentation);
    $('collectionStats').textContent=`按钮数据 ${formButtons(simulation,activeForm).length} 项 · 当前集合按钮 ${stats.total} 个（显示 ${stats.visible} · 隐藏 ${stats.hidden}）· 已建 ${stats.built} · 未建 ${stats.unbuilt}`+(stats.missing?` · ${stats.missing} 个按钮缺少对应数据`:'')+(collectionWarnings.length?' · '+collectionWarnings.join('；'):'');
  };
  const applyPresentation=(rects=scene.rects)=>{
    const presentation=presentScene(ns,{...scene,rects},states);
    for(const [id,el]of elements){
      const item=presentation.get(id);if(!item)continue;
      el.hidden=!item.visible;
      el.dataset.layer=item.layer;
      Object.assign(el.style,{left:item.rect.x+'px',top:item.rect.y+'px',zIndex:String(Math.round(item.layer)),opacity:item.opacity,clipPath:clipInsets(item.rect,item.clip)});
      el.style.color=item.color?`rgb(${item.color.slice(0,3).map(c=>Math.round(c*255)).join(',')})`:'';
    }
    updateStats(presentation);
    if($('animationEnabled').checked&&sceneInfo?.elements===elements)playback.paint();
  };
  for(const n of ns) {
    const o=runtimeNodes.get(n.id),r=scene.rects.get(n.id);if(!r)continue;
    const el=document.createElement('div'),font=fontMetrics(o);
    el.dataset.node=n.id;el.dataset.file=current;el.dataset.controlName=n.name;el.dataset.parent=n.parent?.id||'';
    if(o._missingDataPlaceholder){el.dataset.missingIndex=o._collectionIndex;el.title='按钮序号 '+o._collectionIndex+' 缺少模拟数据；当前仅为编辑占位。';}
    el.className='control'+(n.id===selection?' selected':'')+(o._collectionMissing?' missing-data':'');
    Object.assign(el.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px',opacity:typeof o.alpha==='number'?o.alpha:1,zIndex:Number(o.layer)||0,fontSize:font.fontSize+'px',lineHeight:(font.lineHeight+(Number(o.line_padding)||0))+'px'});
    if(o.clips_children===true)el.style.overflow='hidden';
    if(Array.isArray(o.color))el.style.color=`rgb(${o.color.slice(0,3).map(c=>Math.round(c*255)).join(',')})`;
    if(!o._missingDataPlaceholder&&(o.type==='label'||o.type==='button')) {
      const label=document.createElement('div');label.className='control-text';paintGameText(label,o,scene.textLayouts.get(n.id),{family:previewFont.family,bitmap:previewFont.bitmap,stretch:$('stretchGlyphs').checked});el.append(label);
      Object.assign(el.style,{display:'flex',alignItems:'center',justifyContent:'center'});
      label.style.textAlign=o.text_alignment||(o.type==='label'?'left':'center');
      if(o.type==='label'){label.style.width='100%';el.style.alignItems='flex-start';}
    }
    if(!o._missingDataPlaceholder&&o.type==='button'&&!o.default_control&&!o.hover_control&&!o.pressed_control){el.style.background='#4d665c';el.style.border='2px solid #8caa9a';}
    if(!o._missingDataPlaceholder&&o.type==='image'&&typeof o.texture==='string'&&o.texture) {
      const path=resource(o.texture).path;
      if(path){const url=URL.createObjectURL(new Blob([files.get(path)],{type:/\.jpe?g$/i.test(path)?'image/jpeg':'image/png'}));urls.push(url);Object.assign(el.style,textureStyle(files,path,o,r,url));}
      else{el.title=resource(o.texture).message||'贴图缺失';el.style.background='repeating-conic-gradient(#a34e9a 0% 25%,#25202b 0% 50%) 0/16px 16px';}
    }
    if(o._containerSlot){
      el.classList.add('container-slot');el.dataset.containerIndex=o._containerIndex;
      if(o._containerTexture){const path=resource(o._containerTexture).path;const preview=document.createElement('div');preview.className='slot-preview';
       if(path){const url=URL.createObjectURL(new Blob([files.get(path)]));urls.push(url);preview.style.backgroundImage=`url("${url}")`;}
       else preview.classList.add('missing-slot-texture');
       if(o._containerItem?.count>1){const count=document.createElement('span');count.textContent=o._containerItem.count;preview.append(count);}el.append(preview);
      }
    }
    elements.set(n.id,el);
    el.style.pointerEvents=mode==='preview'?(o.type==='button'&&o.enabled!==false&&r.w>0&&r.h>0?'auto':'none'):'auto';
    el.onpointerdown=e=>{
      const selectedElement=elements.get(selection),underPointer=document.elementsFromPoint(e.clientX,e.clientY);
      const target=mode==='edit'&&selectedElement&&underPointer.includes(selectedElement)?ns.find(item=>item.id===selection):n;
      startDrag(e,target,e.currentTarget,(dx,dy)=>{
        const rects=new Map(scene.rects);
        for(const child of ns)if(target.path.every((value,i)=>child.path[i]===value)){
          const original=scene.rects.get(child.id);if(original)rects.set(child.id,{...original,x:original.x+dx,y:original.y+dy});
        }
        applyPresentation(rects);
      });
    };
    el.onclick=e=>{
      e.stopPropagation();if(el.dataset.dragged){delete el.dataset.dragged;return;}
      if(mode==='preview'){if(o.type==='button'&&o.enabled!==false&&r.w>0&&r.h>0&&(e.detail===0||pointInRect(el.getBoundingClientRect(),e.clientX,e.clientY)))activateControl(n,ns);return;}
      const candidates=e.detail===0?[el]:document.elementsFromPoint(e.clientX,e.clientY).filter(item=>item.classList.contains('control')&&item.parentElement===canvas&&!item.hidden);
      const ids=candidates.map(item=>item.dataset.node),same=lastPick&&Math.hypot(lastPick.x-e.clientX,lastPick.y-e.clientY)<3&&JSON.stringify(lastPick.ids)===JSON.stringify(ids);
      const index=same?(lastPick.index+1)%Math.max(1,ids.length):0;
      lastPick={x:e.clientX,y:e.clientY,ids,index};
      const picked=ns.find(item=>item.id===ids[index]);if(picked)selectNode(picked);
      document.querySelector('.tree-item.active[data-node]')?.scrollIntoView({block:'nearest'});
    };
    canvas.append(el);
  }
  for(const [id,el]of elements){
    const o=runtimeNodes.get(id);
    if(o.type==='button')installButtonStates(el,o,{mode,forcedState:$('buttonState').value,onChange:state=>{
      if(!el.isConnected||states.get(id)===state)return;
      states.set(id,state);applyPresentation();
    }});
  }
  applyPresentation();
  if($('zoom').value==='focus') {
    const bounds=[...elements].filter(([id,el])=>!el.closest('[hidden]')&&['image','label','button'].includes(runtimeNodes.get(id)?.type)).map(([id])=>scene.rects.get(id));
    if(bounds.length){const left=Math.min(...bounds.map(r=>r.x)),top=Math.min(...bounds.map(r=>r.y)),width=Math.max(...bounds.map(r=>r.x+r.w))-left,height=Math.max(...bounds.map(r=>r.y+r.h))-top,scale=fitScale(Math.max(width,1),Math.max(height,1),$('viewport').clientWidth,$('viewport').clientHeight);canvas.style.transform=`scale(${scale}) translate(${-left}px,${-top}px)`;canvas.dataset.scale=scale;$('stage').style.width=width*scale+'px';$('stage').style.height=height*scale+'px';}
  }
  sceneInfo={scene,elements,states,ns};return scene;
}
async function unpack(zip,prefix,target,depth=0){if(depth>4)throw Error('嵌套包层数过多');for(const entry of Object.values(zip.files)){if(entry.dir)continue;const name=entry.name.replace(/\\/g,'/');if(name.split('/').includes('..')||name.startsWith('/'))throw Error('包内路径无效');const b=await entry.async('uint8array');if(b.length>100*1024*1024)throw Error('单个文件过大');if(/\.(mcpack|mcaddon)$/i.test(name)){await unpack(await JSZip.loadAsync(b),prefix+name+'/',target,depth+1)}else target.set(prefix+name,b);if(target.size>10000)throw Error('包内文件过多')}}
async function load(list){try{const next=appendImport?new Map(files):new Map([...files].filter(([p])=>isVanilla(p)));const incoming=new Map();for(const f of list){if(f.size>150*1024*1024)throw Error('第一版支持 150 MB 以下的文件');if(/\.json$/i.test(f.name))incoming.set(f.name,new Uint8Array(await f.arrayBuffer()));else{if(!globalThis.JSZip)throw Error('压缩包组件未加载');await unpack(await JSZip.loadAsync(f),'',incoming)}}const settingsEntries=[...incoming].filter(([path])=>isEditorFile(path)&&path.endsWith('/project.json'));
if(settingsEntries.length>1)throw Error('包中包含多份工程设置，请分别导入。');
const importedSettings=settingsEntries.length?text(settingsEntries[0][1]):null;
if(importedSettings!==null)new EditSession().loadSettings(importedSettings);
const presetEntries=[...incoming].filter(([path])=>isEditorFile(path)&&path.endsWith('/presets.json'));if(presetEntries.length>1)throw Error('包中包含多份预设文件');
const importedPresets=presetEntries.length?text(presetEntries[0][1]):null;if(importedPresets!==null)new Presets().load(importedPresets);
for(const [path]of incoming)if(isEditorFile(path))incoming.delete(path);
const merged=mergeImport(next,incoming),changedPaths=[...merged.files].filter(([path,content])=>next.get(path)!==content).map(([path])=>path);next.clear();for(const [p,b]of merged.files)next.set(p,b);const candidates=[...next.keys()].filter(p=>!isVanilla(p)&&/\.json$/i.test(p)&&(/(^|\/)ui\//.test(p)||parse(text(next.get(p))).data?.namespace));if(!candidates.length)throw Error('未找到 UI JSON，请导入包含 ui 文件夹的资源包，或独立 UI JSON。');scriptRuntime.stop();record();editSession.acceptImport(next,{replace:!appendImport,changedPaths});if(importedSettings!==null)editSession.loadSettings(importedSettings);if(!appendImport){stateSamples.clear();previewSceneKey='';presets.clear();homeVisible=true;homeModel=null;sourceDrafts.clear();sourceApplications.clear();routePresets.clear();navigationOrigin=null;}if(importedPresets!==null)presets.load(importedPresets,{merge:appendImport});activeForm=null;const swept=sweepOfficial(next);files=swept.files;if(!appendImport||!files.has(current)){current=candidates.find(p=>!p.endsWith('_ui_defs.json'))||candidates[0];selection='';const entry=screens(files).entries.find(e=>e.file===current)||screens(files).entries[0]||screens(files).custom?.[0];if(entry){current=entry.file;selection=entry.node.id;}}$('project').textContent=list[0].name;scriptRuntime.setFiles(files,{reset:!appendImport});render();$('vanillaStatus').textContent='已重新清扫：移除 '+swept.removed.length+' 个重复原版文件';toast('导入完成，共 '+files.size+' 个文件；已清扫 '+swept.removed.length+' 个重复原版文件'+(merged.relocated.length?' · 定位 '+merged.relocated.length+' 个补充文件':'')+(merged.ambiguous.length?' · '+merged.ambiguous.length+' 个贴图路径不明确，保留原路径':''));syncOfficial()}catch(e){toast('导入失败：'+e.message)}}
$('import').onclick=()=>{appendImport=false;$('files').click()};$('dependency').onclick=()=>{appendImport=true;$('files').click()};$('files').onchange=e=>load([...e.target.files]);document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>{e.preventDefault();load([...e.dataTransfer.files])});$('search').oninput=renderSearch;$('resolution').onchange=refreshScene;$('guiScale').onchange=refreshScene;$('zoom').onchange=refreshScene;$('undo').onclick=()=>{if(history.length){future.push(snapshot());restore(history.pop())}};$('redo').onclick=()=>{if(future.length){history.push(snapshot());restore(future.pop())}};$('apply').onclick=()=>{if(!current||fileProtection().locked)return;hideHome();const s=sourceInput($('source').value,text(files.get(current)));record();sourceDrafts.remove(current);files.set(current,bytes(s));sourceApplications.set(current,s);render();toast(data().error?'源码解析失败：'+data().error:'已应用源码。')};
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
let reviewedFiles=null;
function reviewExport(){
  if([...files].some(([p,b])=>!isVanilla(p)&&!isEditorFile(p)&&/\.json$/i.test(p)&&parse(text(b)).error)){toast('存在 JSON 语法错误，请修复后导出。');return;}
  reviewedFiles=new Map([...files].filter(([path])=>!isVanilla(path)&&!isEditorFile(path)));
  const changes=editSession.changes(reviewedFiles),drafts=sourceDrafts.pending(files);
  $('exportSummary').textContent=`${reviewedFiles.size} 个资源文件 · 相对导入原文有 ${changes.length} 个文件变化。原版预览资源、模拟数据和工程设置不包含在资源包中。`;
  $('exportDrafts').textContent=drafts.length?'以下源码草稿尚未应用，本次导出使用已应用版本：'+drafts.join('、'):'';
  $('exportChanges').replaceChildren();
  if(!changes.length)$('exportChanges').textContent='没有文件内容变化，将导出导入时的原始字节。';
  for(const change of changes){
    const details=document.createElement('details'),summary=document.createElement('summary');
    summary.textContent=({added:'新增',removed:'删除',modified:'修改'}[change.kind])+' · '+change.path;
    details.append(summary);let loaded=false;
    details.ontoggle=()=>{
      if(!details.open||loaded)return;loaded=true;
      const before=decodeText(change.before),after=decodeText(change.after);
      if(before===null||after===null){const note=document.createElement('p');note.textContent=`二进制文件：${change.before?.length||0} → ${change.after?.length||0} 字节`;details.append(note);return;}
      const diff=lineChanges(before,after),pre=document.createElement('pre');pre.className='export-diff';
      if(diff.fallback)pre.textContent='文件差异较大，以下显示完整原文与当前内容：\n--- 导入原文\n'+before+'\n+++ 当前内容\n'+after;
      else for(const row of diff.rows){
        const line=document.createElement('span');line.className='diff-'+row.kind;
        const content=row.text.replace(/\r/g,'␍').replace(/\uFEFF/g,'[BOM]');
        line.textContent=row.kind==='gap'?'…\n':String(row.old??'').padStart(5)+' '+String(row.new??'').padStart(5)+' '+({add:'+',remove:'-',same:' '}[row.kind])+content+(content.endsWith('\n')?'':'\n\\ No newline at end of file\n');
        pre.append(line);
      }
      details.append(pre);
    };
    $('exportChanges').append(details);
  }
  $('exportReview').showModal();
}
$('export').onclick=reviewExport;
$('cancelExport').onclick=()=>{$('exportReview').close();reviewedFiles=null;};
$('exportReview').addEventListener('close',()=>{if(!$('exportReview').open)reviewedFiles=null;});
$('confirmExport').onclick=async()=>{
  if(!reviewedFiles)return;const reviewed=reviewedFiles;$('confirmExport').disabled=true;
  try{
    if(reviewed.size===1){const [path,content]=[...reviewed][0];download(new Blob([content],{type:/\.json$/i.test(path)?'application/json':'application/octet-stream'}),path.split('/').pop());}
    else{if(!globalThis.JSZip)throw Error('压缩包组件未加载');const zip=new JSZip();for(const [p,b]of reviewed)zip.file(p,b);const blob=await zip.generateAsync({type:'blob'});if(reviewedFiles!==reviewed)return;download(blob,'easy-see-edited.zip');}
    $('exportReview').close();toast('已导出审核过的资源文件；嵌套包已展开为文件夹。');
  }catch(error){toast(error.message);}finally{$('confirmExport').disabled=false;}
};
$('generatedFile').onchange=()=>{
  if(isVanilla(current)||!files.has(current))return;
  record();editSession.protection.set(current,$('generatedFile').checked);render();
};
$('exportSettings').onclick=()=>download(new Blob([editSession.settings()],{type:'application/json'}),'easysee-project.json');
$('importSettings').onclick=()=>$('settingsFile').click();
$('settingsFile').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{const source=await file.text();new EditSession().loadSettings(source);record();editSession.loadSettings(source);render();toast('已导入工程设置，不会写入资源包。');}
  catch(error){toast('工程设置导入失败：'+error.message);}finally{event.target.value='';}
};
function model(){return navigationModel(files,screens(files,$('showOriginal').checked));}
function syncSimulation(){ $('simulation').value=JSON.stringify(simulation,null,2); }
function routePreset(route){const saved=routePresets.get(route.id);return saved&&routeMatches(route,route.kind==='container'?saved.containerTitle:saved.formTitle)?saved:undefined;}
function rememberSimulation(){homeModel=null;const navigation=model(),route=navigation.routes.find(r=>r.kind==='container'&&r.screen.file===current&&r.sample===simulation.containerTitle)||routeForTitle(navigation,simulation.formTitle);if(route)routePresets.set(route.id,structuredClone(simulation));}
function openScreen(screen){
  homeVisible=false;activeForm=null;navigationOrigin=null;current=screen.file;selection=screen.node.id;
  const title=titleForScene(screen,simulation);if(title!==undefined)simulation={...simulation,formTitle:title};
  syncSimulation();render();
}
function openRoute(route){
  homeVisible=false;
  const saved=routePreset(route),matchesCurrent=routeMatches(route,route.kind==='container'?simulation.containerTitle:simulation.formTitle);
  simulation=saved?structuredClone(saved):matchesCurrent||route.sample===undefined?simulation:route.kind==='container'?{...simulation,containerTitle:route.sample}:{...simulation,formTitle:route.sample,formBody:'',formButtons:[]};
  activeForm=null;navigationOrigin=null;current=route.screen.file;selection=route.node.id;expanded.add(route.screen.id);syncSimulation();render();
  if(route.sample===undefined&&!saved&&!matchesCurrent)toast('此标题条件无法自动推断，请在模拟数据中指定 formTitle。');
}
function renderSearch(){
  const query=$('search').value.trim(),container=$('searchResults');container.replaceChildren();container.hidden=!query;$('tree').hidden=Boolean(query);
  if(!query)return;
  const result=searchControls(files,query,{includeVanilla:$('showOriginal').checked,file:current,runtime:runtimeNodes,sceneNodes});
  const count=document.createElement('small');count.textContent=`${result.total} 个匹配`+(result.total>result.results.length?`（显示前 ${result.results.length} 个）`:'');container.append(count);
  for(const hit of result.results){const row=button(hit.path,()=>{activeForm=null;current=hit.file;selection=hit.node.id;render();},'tree-item search-result');row.title=hit.terms;container.append(row);}
}
function updateNavigation(project,ns,selected){
  const crumbs=$('breadcrumbs');crumbs.replaceChildren();
  const chain=[];for(let n=selected;n;n=n.parent)chain.unshift(n);
  for(const [i,n]of chain.entries()){if(i)crumbs.append(document.createTextNode(' › '));const crumb=button(n.name.split('@')[0],()=>selectNode(n));crumb.dataset.node=n.id;crumb.setAttribute('aria-current',n.id===selection?'true':'false');crumbs.append(crumb);}
  const links=$('screenLinks');links.replaceChildren();
  const navigation=navigationModel(files,project);let route=selected&&navigation.routes.find(r=>r.kind==='container'&&r.screen.file===current&&r.node.path[0]===selected?.path[0]&&r.sample===(simulation.containerTitle??'普通箱子'))||routeForSelection(navigation,current,selected)||selected&&navigation.routes.find(r=>r.definition?.file===current&&r.definition.node.path[0]===selected.path[0])||navigationOrigin&&navigation.routes.find(r=>r.screen.file===navigationOrigin.file&&r.node.id===navigationOrigin.id);
  if(route){
    if(route.kind==='container'){const content=runtimeNodes.get(route.node.id)?.$screen_content;const definition=[...project.entries,...project.templates,...project.custom].find(d=>d.namespace+'.'+d.node.name.split('@')[0]===content);if(definition)route={...route,definition};}
    const note=document.createElement('small');note.textContent=route.label+' · 挂载：'+route.screen.file;links.append(note);
    if(route.definition&&(route.definition.file!==current||route.definition.node.path[0]!==selected?.path[0]))links.append(button('打开定义 · '+route.definition.file,()=>{navigationOrigin={file:current,id:route.node.id};current=route.definition.file;selection=route.definition.node.id;activeForm=null;render();}));
  }
  if(route&&route.screen.file!==current&&!navigationOrigin)links.append(button('打开挂载界面',()=>openRoute(route)));
  if(navigationOrigin)links.append(button('返回挂载界面',()=>{current=navigationOrigin.file;selection=navigationOrigin.id;navigationOrigin=null;render();}));
  const forms=route?.links||project.entries.find(s=>s.file===current&&s.node.path[0]===selected?.path[0])?.links||[];
  if(forms.length){const caption=document.createElement('small');caption.textContent=`关联脚本 ${forms.length} 项：`;links.append(caption);}
  for(const form of forms){
    links.append(button('◇ '+(form.displayTitle||stripFormatting(form.title)),()=>showForm(form)));
    links.append(button('查看脚本 · '+form.file+':'+form.line,()=>showScript(form)));
  }
  if(route&&!forms.length){const note=document.createElement('small');note.textContent='未静态识别到打开此分支的脚本。';links.append(note);}
}
function showScript(form){
  $('scriptTitle').textContent=form.file+':'+form.line;
  const source=text(files.get(form.file)||new Uint8Array()),lines=source.split('\n'),pre=$('scriptSource');pre.replaceChildren();
  lines.forEach((line,i)=>{const row=document.createElement('span');row.textContent=String(i+1).padStart(5)+' '+line+'\n';if(i+1===form.line){row.className='script-target';row.id='scriptTarget';}pre.append(row);});
  $('scriptDialog').showModal();requestAnimationFrame(()=>document.getElementById('scriptTarget')?.scrollIntoView({block:'center'}));
}
$('closeScript').onclick=()=>$('scriptDialog').close();
$('browseView').onchange=render;
function hideHome(){homeVisible=false;$('home').hidden=true;$('viewport').hidden=$('dualPreview').checked;$('comparison').hidden=!$('dualPreview').checked;$('breadcrumbs').hidden=false;$('screenLinks').hidden=false;}
$('tree').addEventListener('click',event=>{if(event.target.closest('button'))hideHome();},true);
$('searchResults').addEventListener('click',hideHome,true);
$('homeButton').onclick=()=>{homeVisible=!homeVisible;if(homeVisible){playback.pause();comparison.dispose();homeModel=null;renderHome();}else render();};
function routeSimulation(route){const preset=routePreset(route);return preset?structuredClone(preset):routeMatches(route,route.kind==='container'?simulation.containerTitle:simulation.formTitle)?simulation:route.kind==='container'?{...simulation,containerTitle:route.sample}:{...simulation,formTitle:route.sample,formButtons:[]};}
function renderHome(){
  const home=$('home');home.hidden=!homeVisible;if(homeVisible){$('previewStatus').hidden=true;$('stateSamples').hidden=true;}$('viewport').hidden=homeVisible||$('dualPreview').checked;$('comparison').hidden=homeVisible||!$('dualPreview').checked;$('breadcrumbs').hidden=homeVisible;$('screenLinks').hidden=homeVisible;
  if(!homeVisible)return;
  $('properties').replaceChildren();$('properties').textContent='选择一个界面查看属性。';
  $('screenName').textContent='界面总览 · 布局缩略图';
  const navigation=model();if(homeModel===navigation)return;homeModel=navigation;
  interfaceCards(home,navigation,files,{simulation,presetFor:routeSimulation,openScreen,openRoute});
}

function presetScene(value=simulation,inferFromData=false){
 const navigation=model(),node=sceneNodes.find(n=>n.id===selection),root=node?.path[0]??JSON.parse(selection||'[]')[0];
 const container=navigation.routes.find(r=>r.kind==='container'&&r.screen.file===current&&r.node.path[0]===root&&r.sample===value.containerTitle);
 const form=routeForTitle(navigation,value.formTitle);
 if(container)return container.id;
 if(form&&(inferFromData||form.screen.file===current&&form.node.path[0]===root))return form.id;
 if(inferFromData){const target=navigation.routes.find(r=>r.kind==='container'&&r.sample===value.containerTitle);if(target)return target.id;}
 return current+'::'+JSON.stringify(root?[root]:[]);
}
function applySimulation(value){validateSimulation(value);$('simulation').value=JSON.stringify(value,null,2);$('simulate').click();}
function renderStudio(){
 const selected=sceneNodes.find(n=>n.id===selection);let root=selected;while(root?.parent)root=root.parent;
 const container=model().routes.some(r=>r.kind==='container'&&r.screen.file===current&&r.node.path[0]===root?.path[0]);$('containerControls').hidden=!container;
 $('containerTitle').value=simulation.containerTitle??'普通箱子';$('containerDevice').value=(simulation.pocketScreen??simulation.touch)?'pocket':'desktop';
 $('containerResolved').textContent=container?'实际内容：'+(runtimeNodes.get(root.id)?.$screen_content||'未解析')+' · 显示标题：'+(runtimeNodes.get(root.id)?.$container_title||''):'';
 const factorySample=root?.obj.factory?.control_ids&&currentInstances?.data?.[root.path[0]];
 const analysisObject=factorySample||(root?currentResolved?.data?.[root.path[0]]||root.obj:{});
 const schemas=renderFields($('channelStudio'),analysisObject,files,simulation,{index:runtimeNodes.get(selection)?._collectionIndex,onApply:applySimulation,onError:toast});
 renderStateSamples(root,selected,analysisObject);
 renderPreviewStatus(root,schemas);
 if(factorySample){const note=document.createElement('small');note.id='factoryPreviewNote';note.textContent=scriptRuntime.running&&Array.isArray(simulation.chatMessages)?'沿工厂模板显示脚本聊天事件（最近 32 项），动画跟随虚拟 tick。':'沿工厂模板识别通道；画布为只读事件样本，不模拟触发频率或同时实例数。';$('channelStudio').append(note);}
 const select=$('savedPresets'),previous=select.value;select.replaceChildren();
 for(const entry of presets.entries){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name+' · '+entry.scene.split('::')[0];select.append(option);}
 if([...select.options].some(option=>option.value===previous))select.value=previous;
 $('loadSavedPreset').disabled=!select.options.length;$('deleteSavedPreset').disabled=!select.options.length;
 const branches=model().routes.filter(r=>r.kind!=='container'&&r.screen.file===current&&r.node.path[0]===root?.path[0]);
 const budget=controlBudget(currentInstances?.data||{},root?.path[0],branches,{origins:currentResolved?.origins,file:current});$('controlBudget').className='budget '+budget.severity;$('controlBudget').textContent=`创建预算：本包 ${budget.custom} · 原版 ${budget.vanilla} · 合计 ${budget.total}（含隐藏分支；本包 >1000 黄、>3000 红）`;
 if(currentResolved?.issues.some(issue=>issue.message.includes('未找到'))) $('controlBudget').textContent+=' · 有继承未解析，数量为下限';
 $('budgetBranches').replaceChildren();for(const branch of budget.branches){const row=document.createElement('small');row.textContent=branch.label+'：本包 '+branch.custom+' · 原版 '+branch.vanilla+' · 合计 '+branch.total;$('budgetBranches').append(row);}
 const refreshMatrix=()=>{
  if(!$('matrixDetails').open)return;
  renderMatrix($('textureMatrix'),analysisObject,files,current);
  const chooser=$('stateButton'),old=chooser.value;chooser.replaceChildren();
  const buttons=sceneNodes.filter(n=>runtimeNodes.get(n.id)?.type==='button'&&sceneInfo?.scene.rects.has(n.id));
  for(const node of buttons.slice(0,200)){const option=document.createElement('option');option.value=node.id;option.textContent=node.name+' · '+(runtimeNodes.get(node.id)?._collectionIndex??'');chooser.append(option);}
  let button=selected;while(button&&runtimeNodes.get(button.id)?.type!=='button')button=button.parent;
  if(button&&buttons.some(n=>n.id===button.id))chooser.value=button.id;else if(buttons.some(n=>n.id===old))chooser.value=old;
  const draw=()=>{if(sceneInfo)buttonComparisons($('stateComparison'),sceneNodes,sceneInfo.scene,chooser.value,sceneInfo.elements);};chooser.onchange=draw;draw();
 };
 $('matrixDetails').ontoggle=refreshMatrix;refreshMatrix();
}
$('applyContainer').onclick=()=>{try{const pocket=$('containerDevice').value==='pocket';applySimulation({...simulation,containerTitle:$('containerTitle').value,touch:pocket,pocketEdition:pocket,pocketScreen:pocket});hideHome();render();}catch(error){toast(error.message);}};
$('containerDevice').onchange=()=>$('applyContainer').click();
$('savePreset').onclick=()=>{try{record();presets.save(presetScene(),$('presetName').value||'预设 '+(presets.entries.length+1),simulation);renderStudio();toast('已保存预设；请导出编辑器工程或预设 JSON 以便下次恢复。');}catch(error){toast(error.message);}};
$('loadSavedPreset').onclick=()=>{
 const entry=presets.entries.find(entry=>entry.id===$('savedPresets').value);if(!entry)return;
 const route=model().routes.find(r=>r.id===entry.scene),separator=entry.scene.indexOf('::'),file=entry.scene.slice(0,separator);
 if(!route&&!files.has(file)){toast('预设对应文件尚未导入：'+file);return;}
 simulation=structuredClone(entry.data);rememberSimulation();syncSimulation();hideHome();
 if(route)openRoute(route);else{current=file;selection=entry.scene.slice(separator+2);activeForm=null;render();}
};
$('deleteSavedPreset').onclick=()=>{record();presets.remove($('savedPresets').value);renderStudio();};
$('exportPresets').onclick=()=>download(new Blob([presets.text()],{type:'application/json'}),'easysee-presets.json');
$('exportWorkspace').onclick=async()=>{try{if(!globalThis.JSZip)throw Error('压缩包组件未加载');const zip=new JSZip();for(const [path,bytes]of files)if(!isVanilla(path)&&!isEditorFile(path))zip.file(path,bytes);zip.file('.easysee/project.json',editSession.settings());zip.file('.easysee/presets.json',presets.text());download(await zip.generateAsync({type:'blob'}),'easy-see-project.zip');}catch(error){toast(error.message);}};
$('demo').onclick=()=>{scriptRuntime.stop();activeForm=null;record();presets.clear();sourceDrafts.clear();files=new Map([['Example_RP/ui/demo.json',bytes(JSON.stringify({namespace:'easy_see',main:{type:'panel',size:[440,260],controls:[{title:{type:'label',text:'你的界面，从这里开始',size:[320,36],offset:[0,-70],font_size:22,color:[.65,.92,.77]}},{subtitle:{type:'label',text:'选择左侧控件，在右侧修改参数',size:[320,24],offset:[0,-20],color:[.65,.7,.8]}},{start:{type:'button',text:'开始冒险',size:[180,40],offset:[0,55]}}]}} ,null,2))]]);editSession.acceptImport(files,{replace:true});current='Example_RP/ui/demo.json';selection='';$('project').textContent='示例项目';scriptRuntime.setFiles(files,{reset:true});render()};$('demo').click();

function showForm(form,preserve=false){homeVisible=false;const navigation=navigationModel(files,screens(files)),route=routeForTitle(navigation,titleSample(form)),saved=route&&routePreset(route);if(!preserve&&saved)simulation=structuredClone(saved);activeForm=form;const project=screens(files),matches=project.entries.filter(s=>s.links.some(f=>f.id===form.id));const target=sceneForForm(project.entries,form);if(!preserve&&!saved){const titleField=form.fields.find(f=>f.kind==='title'),prefix=titleField?.parts?.slice(0,titleField.parts.indexOf(null)).join('');const keep=form.titlePattern&&prefix&&simulation.formTitle?.startsWith(prefix);simulation={...simulation,formTitle:keep?simulation.formTitle:titleSample(form),formBody:keep?simulation.formBody||'':fieldSample(form.fields.find(f=>f.kind==='body')),formButtons:keep?formButtons(simulation,form):formButtons({},form)}};syncSimulation();if(target){current=target.file;selection=route?.screen.id===target.id?route.node.id:target.node.id;expanded.add(target.id);render();$('screenName').textContent=(form.displayTitle||stripFormatting(form.title))+' · 自定义表单';if($('canvas').querySelectorAll('.control').length>1)return;toast('该布局缺少可渲染的模板，暂显示标准表单。');}render();$('canvas').replaceChildren();$('screenName').textContent=form.title+' · '+(matches.length>1?'多个布局候选，暂用标准表单':'标准表单模拟');const box=document.createElement('div');box.className='form-simulation';const title=document.createElement('h2');paintText(title,simulation.formTitle??form.title);box.append(title);const previewFields=[{kind:'body',text:simulation.formBody||''},...formButtons(simulation,form).map(v=>({...v,kind:'button'}))];for(const field of previewFields){if(field.kind==='title')continue;const el=field.kind==='button'?button('',()=>{if(mode==='preview'){ $('clickResult').textContent='点击：button.form_button_click · 序号：'+field.index;followButton(form,field.index)}else inspectScript(form,field)}):document.createElement('p');if(field.texture){const path=texturePath(files,form.file,field.texture);if(path){const img=document.createElement('img'),url=URL.createObjectURL(new Blob([files.get(path)],{type:'image/png'}));urls.push(url);img.src=url;img.alt='';el.append(img)}}const label=document.createElement('span');paintText(label,field.dynamic?'[动态内容]':field.text);el.append(label);box.append(el)}$('canvas').append(box);const buttons=box.querySelectorAll('button').length;$('collectionStats').textContent=`按钮数据 ${formButtons(simulation,form).length} 项 · 标准表单按钮 ${buttons} 个`;$('controlStats').textContent='标准表单模拟（未使用 JSON UI 集合布局）';inspectScript(form);}
function inspectScript(form,field){$('properties').replaceChildren();const h=document.createElement('h3');h.textContent=stripFormatting(field?field.text:form.title);const note=document.createElement('small');note.textContent='脚本：'+form.file+':'+form.line+'。'+(form.items.length?'候选触发物品：'+form.items.join('、'):'未识别到确定的物品触发入口。')+' 标准脚本表单字段暂只读；动态逻辑不执行。';$('properties').append(h,note);}
function followButton(form,index){const jump=form.jumps.find(j=>j.index===index),target=jump&&screens(files).forms.find(f=>f.id===jump.target);if(target)showForm(target);else toast('该按钮的跳转无法静态确定，未执行游戏脚本。');}
function activateControl(n,ns){let b=n;while(b&&b.obj.type!=='button')b=b.parent;if(!b)return;const item=runtimeNodes.get(b.id);if(item?._containerIndex!==undefined){$('clickResult').textContent='容器格子序号：'+item._containerIndex+' · '+(item._containerItem?.name||'空格');return;}if(scriptRuntime.running&&runtimeForm&&[b.obj.$pressed_button_name,...(b.obj.button_mappings||[]).map(m=>m.to_button_id)].some(id=>['button.menu_exit','button.menu_cancel','button.close'].includes(id))){scriptRuntime.respond({canceled:true});return;}const index=item?._collectionIndex;const buttonId=b.obj.button_mappings?.find(m=>m.from_button_id==='button.menu_select')?.to_button_id||'button.form_button_click';$('clickResult').textContent='点击：'+buttonId+' · 序号：'+(index??'未绑定集合');if(index===undefined){toast('该按钮没有可确定的集合序号。');return}if(scriptRuntime.running&&runtimeForm&&simulation.formTitle===runtimeForm.title){scriptRuntime.respond({selection:index});return;}if(activeForm)followButton(activeForm,index);else toast('已记录按钮序号；当前没有关联脚本跳转。');}
function startDrag(e,n,el,previewMove){
  if($('animationEnabled').checked||n.obj._generated||fileProtection().locked||mode!=='edit'||e.button!==0||!at(data().data,n.path))return;
  e.stopPropagation();
  const x=e.clientX,y=e.clientY,zoom=Number($('canvas').dataset.scale)||1,old=n.obj.offset||[0,0];
  let dx=0,dy=0,dragging=false;
  const clear=()=>{el.onpointermove=null;el.onpointerup=null;el.onpointercancel=null;};
  el.setPointerCapture(e.pointerId);
  el.onpointermove=event=>{
    dx=(event.clientX-x)/zoom;dy=(event.clientY-y)/zoom;
    if(dragging||Math.abs(dx)+Math.abs(dy)>3){dragging=true;el.dataset.dragged='true';previewMove(dx,dy);}
  };
  el.onpointercancel=()=>{clear();if(dragging&&el.isConnected)render();};
  el.onpointerup=()=>{
    clear();if(!el.isConnected||!dragging)return;
    if(Math.abs(dx)+Math.abs(dy)<=3){render();return;}
    if(!Array.isArray(old)||old.some(value=>typeof value!=='number')){toast('百分比、变量或动画偏移请在属性或源码中修改');render();return;}
    try{editCurrent([...n.path,'offset'],[Math.round((old[0]||0)+dx),Math.round((old[1]||0)+dy)]);selection=n.id;}catch(error){toast(error.message);}render();
  };
}
function selectNode(n){selection=n.id;updateNavigation(screens(files),sceneNodes,n);const holder=$('interfaceContents');if(holder){holder.replaceChildren();interfaceTree(holder,model(),{file:current,selected:n,ns:sceneNodes,openScreen,openRoute,selectControl:selectNode});}document.querySelectorAll('[data-node]').forEach(el=>{const active=el.dataset.node===selection&&el.dataset.file===current;el.classList.toggle(el.classList.contains('control')?'selected':'active',active)});$('properties').replaceChildren();properties(n);renderStudio();if($('dualPreview').checked)renderStageFour();}

$('buttonState').onchange=refreshScene;
$('mode').onchange=e=>{hideHome();mode=e.target.value;$('buttonState').disabled=mode!=='edit';document.body.dataset.mode=mode;if(activeForm)showForm(activeForm,true);else render()};

function paintText(el,value){for(const run of textRuns(value)){const span=document.createElement('span');span.textContent=run.text;Object.assign(span.style,run.style);el.append(span)}}

$('simulate').onclick=()=>{try{const value=JSON.parse($('simulation').value);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('需要 JSON 对象');validateSimulation(value);if(scriptRuntime.running)scriptRuntime.stop();if(!applyingSample)stateSamples.manual();simulation=value;rememberSimulation();if(activeForm)showForm(activeForm,true);else render();toast('已应用模拟数据')}catch(e){toast('模拟数据无效：'+e.message)}};
$('preset').onchange=e=>{if(e.target.value==='quest'){const route=model().routes.find(item=>item.kind!=='container'&&item.sample?.startsWith('MSQB:'));if(route){openRoute(route);if(stateSamples.groups.length){stateSamples.first();return;}}}const presets={martial:{formTitle:'武道天书',formBody:''},star:{formTitle:'北斗星空图',formBody:''},quest:{formTitle:'MSQB:小页|任务',formBody:'',bindings:{'#form_button_text':'QRA0任务说明','#form_button_texture':'textures/ui/questbook/icon_unknown'}},hud:{title:'MSHUD:境界：炼体\n气血：100 / 100',subtitle:'',actionbar:''}};$('simulation').value=JSON.stringify(presets[e.target.value]||{},null,2);const project=screens(files);const target=e.target.value==='hud'?[...project.entries,...(project.custom||[])].find(s=>s.node.name==='ms_status_panel'):project.entries.find(s=>s.namespace==='server_form'&&s.node.name==='long_form');if(target){activeForm=null;current=target.file;selection=target.node.id;expanded.add(target.id)}$('simulate').click()};

function canvasScale(w,h){return ['fit','focus'].includes($('zoom').value)?fitScale(w,h,$('viewport').clientWidth,$('viewport').clientHeight):Number($('zoom').value)}
function refreshScene(){if(activeForm)showForm(activeForm,true);else render()}
new ResizeObserver(()=>{const canvas=$('canvas'),w=parseFloat(canvas.style.width),h=parseFloat(canvas.style.height);if(!w||!h||$('zoom').value!=='fit')return;const scale=canvasScale(w,h);canvas.style.transform='scale('+scale+')';canvas.dataset.scale=scale;$('stage').style.width=w*scale+'px';$('stage').style.height=h*scale+'px'}).observe($('viewport'));

$('vanilla').onclick=()=>syncOfficial();$('showOriginal').onchange=render;$('vanillaFolder').onclick=()=>$('vanillaDirectory').click();
async function loadVanilla(list){try{const archive=new Map();for(const f of list){if(f.webkitRelativePath){archive.set(f.webkitRelativePath,new Uint8Array(await f.arrayBuffer()))}else{if(!globalThis.JSZip)throw Error('压缩包组件未加载');await unpack(await JSZip.loadAsync(f),'',archive)}}const installed=installVanilla(files,archive);record();files=removeShadowedVanilla(installed.files);refreshScene();$('vanillaStatus').textContent='原版资源：'+installed.count+' 个文件（'+list[0].name+'）';toast('原版资源已加载，仅用于预览，不包含在导出中。')}catch(e){toast('原版资源导入失败：'+e.message)}}
$('vanillaFiles').onchange=e=>{if(e.target.files.length)loadVanilla([...e.target.files]);e.target.value=''};$('vanillaDirectory').onchange=e=>loadVanilla([...e.target.files]);

let officialBusy=false,officialAgain=false;
async function syncOfficial(){if(officialBusy){officialAgain=true;return}officialBusy=true;$('vanilla').disabled=true;$('vanillaStatus').textContent='正在获取官方预览资源…';const project=files;try{const result=await loadOfficial(project,{simulation,extraTextures:[...runtimeNodes.values()].flatMap(o=>[o.texture,o._containerTexture]),progress:p=>{if(files===project)$('vanillaStatus').textContent='官方资源加载中：'+p.done+' 项'}});if(files!==project)return;const swept=sweepOfficial(files,result.resources);invalidate(files);files=swept.files;const available=screens(files).entries;if(!(files.has(current)&&Object.hasOwn(resolveProject(files,current).data||{},JSON.parse(selection||'[]')[0]))&&available.length){current=available[0].file;selection=available[0].node.id}refreshScene();$('vanillaStatus').textContent='官方预览资源：'+result.resources.size+' 项 · 缓存命中 '+result.cached+' · 新下载 '+result.downloaded+' · 跳过已有 '+result.skipped.length+' 项 · '+OFFICIAL_REF.slice(0,7)+(result.failed.length?' · '+result.failed.length+' 项失败':'')+(result.limited?' · 达到本次下载上限，可再次补齐':'');refreshCacheStatus();toast('已补齐可获取的官方资源；完整游戏渲染仍取决于版本和功能支持。')}catch(e){if(files===project){$('vanillaStatus').textContent='官方资源加载失败，可重试或手动导入';toast(e.message)}}finally{officialBusy=false;$('vanilla').disabled=false;if(officialAgain){officialAgain=false;queueMicrotask(()=>syncOfficial())}}}

$('importSimulation').onclick=()=>$('simulationFile').click();
$('simulationFile').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
    const value=JSON.parse(await file.text());
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('需要 JSON 对象');
    if(value.version===1&&Array.isArray(value.presets)){new Presets().load(JSON.stringify(value));record();presets.load(JSON.stringify(value),{merge:true});renderStudio();toast('已导入工程预设');return;}
    validateSimulation(value);
    $('simulation').value=JSON.stringify(value,null,2);
    $('simulate').click();record();presets.save(presetScene(value,true),file.name.replace(/\.json$/i,''),value);renderStudio();
  }catch(error){toast('模拟数据导入失败：'+error.message);}
  finally{event.target.value='';}
};


$('importFont').onclick=()=>$('fontFile').click();
$('resetFont').onclick=()=>{previewFont.reset();$('fontStatus').textContent='预览字体：游戏字宽近似';refreshScene();};
$('fontFile').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{$('fontStatus').textContent=await previewFont.load(file);refreshScene();toast('已加载本地预览字体，不会写入资源包。');}
  catch(error){toast('字体导入失败：'+error.message);}
  finally{event.target.value='';}
};

function renderStageFour(){
 if(!sceneInfo)return;
 if(homeVisible)playback.pause();
 const root=sceneInfo.ns.find(n=>n.id===selection)?.path[0]||JSON.parse(selection||'[]')[0];
 playback.setScene(files,current,sceneInfo,current+'::'+root);
 if($('dualPreview').checked&&!homeVisible){
  comparison.render({files,file:current,rootName:root,simulation,form:activeForm,font:previewFont,stretch:$('stretchGlyphs').checked,event:$('animationEvent').value,safe:Number($('safeArea').value)});
  comparison.frame(playback.time,$('animationEnabled').checked);
 }else comparison.dispose();
 $('comparison').hidden=homeVisible||!$('dualPreview').checked;$('viewport').hidden=homeVisible||$('dualPreview').checked;
}
$('dualPreview').onchange=()=>{hideHome();renderStageFour();};$('safeArea').oninput=renderStageFour;
$('stretchGlyphs').onchange=refreshScene;
$('pixelFont').onclick=async()=>{try{$('fontStatus').textContent=await previewFont.builtin();refreshScene();}catch(error){toast(error.message);}};
$('packFont').onclick=async()=>{try{$('fontStatus').textContent=await previewFont.fromProject(files,current);refreshScene();}catch(error){toast(error.message);}};
async function refreshCacheStatus(){const stats=await officialCache.inspect();$('cacheStatus').textContent=stats.available?`本版本原版缓存：${stats.count} 个文件 · ${(stats.bytes/1024/1024).toFixed(2)} MB`:'浏览器未提供持久缓存，将直接下载资源。';}
$('refreshCache').onclick=refreshCacheStatus;
$('clearCache').onclick=async()=>{await officialCache.clear();await refreshCacheStatus();toast('已清除本版本下载缓存，当前工程中的预览资源仍可使用。');};
refreshCacheStatus();

function openSimulationFields(fill=false){
 $('simulationDetails').open=true;
 if(fill)$('channelDetails').open=true;
 const target=(fill?$('channelDetails'):$('simulationDetails')).querySelector('summary');
 target.scrollIntoView({block:'start'});
}
function renderPreviewStatus(root,schemas=[]){
 const status=$('previewStatus');status.replaceChildren();
 const readiness=previewReadiness(sceneInfo?.scene||{runtime:new Map(),rects:new Map()},sceneNodes,root?.path[0],{error:data().error,buttonCount:formButtons(simulation,activeForm).length,schemas,mode});
 const key=current+'::'+root?.path[0],changed=!homeVisible&&key!==previewSceneKey;
 if(!homeVisible)previewSceneKey=key;
 if(changed)document.querySelector('.bottom').scrollTop=0;
 status.hidden=homeVisible||!readiness.message;if(status.hidden)return;
 status.dataset.kind=readiness.kind;
 if(stateSamples.exampleHidden&&readiness.kind!=='parse-error'){readiness.message='当前为隐藏状态示例，选择其他包内状态即可恢复预览。';readiness.canFill=false;}
 const message=document.createElement('span');message.textContent=readiness.message;status.append(message);
 if(readiness.kind==='parse-error')status.append(button('查看源码',()=>{$('sourceDetails').open=true;$('sourceDetails').scrollIntoView({block:'nearest'});}));
 else{
  status.append(button(readiness.canFill?'打开通道填表':'打开模拟数据',()=>openSimulationFields(readiness.canFill)));
  if(stateSamples.groups.length)status.append(button('一键预览包内示例',()=>stateSamples.first()));
  if(readiness.kind==='missing-buttons')status.append(button('导入按钮模拟 JSON',()=>$('importSimulation').click()));
 }
 if(changed){
  if(readiness.kind!=='parse-error'){$('simulationDetails').open=true;if(readiness.canFill)$('channelDetails').open=true;}
 }
}

function renderStateSamples(root,selected,analysisObject){
 const navigation=model();let route=selected&&routeForSelection(navigation,current,selected);
 if(!route&&root)route=navigation.routes.find(item=>item.kind!=='container'&&item.definition?.file===current&&item.definition.node.path[0]===root.path[0]);
 if(!route&&root){const match=routeForTitle(navigation,simulation.formTitle);if(match?.screen.file===current&&match.node.path[0]===root.path[0])route=match;}
 const containers=navigation.routes.filter(item=>item.kind==='container'&&item.screen.file===current&&item.node.path[0]===root?.path[0]);
 const target=route&&route.screen.file===current?at(currentResolved?.data,route.node.path)||analysisObject:analysisObject;
 const key=route?.id||current+'::'+root?.path[0],cacheKey='state-samples:'+current+'::'+key+'::'+(currentResolved?.data?.[root?.path[0]]?.$screen_content||'');
 const groups=cached(files,cacheKey,()=>sampleCatalog(target,files,current,{formTitle:route?.sample,titleMatches:title=>routeMatches(route,title),containers}));
 stateSamples.render(key,groups,simulation,{hidden:homeVisible||scriptRuntime.running});
}
