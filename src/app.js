import {presentScene,clipInsets,pointInRect} from './scene-presentation.js';
import {PreviewFont} from './preview-font.js';
import {paintGameText} from './text-layout.js';
import {SourceDrafts} from './source-drafts.js';
import {mergeImport} from './import-resources.js';
import {layoutScene} from './layout.js';
import {sceneIssues} from './diagnostics.js';
import {textureStyle} from './texture-style.js';
import {stripFormatting} from './text.js';
import {fontMetrics,FONT_SIZES} from './font.js';
import {installButtonStates} from './button-states.js';
import {formButtons,instantiateCollections} from './collections.js';
import {removeShadowedVanilla,sweepOfficial} from './resource-overrides.js';
import {loadOfficial,OFFICIAL_REF} from './official-resources.js';
import {isVanilla,installVanilla,textureResource} from './resources.js';
import {desktopViewport,fitScale,sceneForForm,titleForScene} from './scene.js';
import {textRuns} from './text.js';
import {texturePath} from './runtime.js';
import {invalidate} from './cache.js';
import {resolveProject} from './resolver.js';
import {screens} from './project.js';
import {parse,nodes,at} from './core.js';
const sourceDrafts=new SourceDrafts();
const previewFont=new PreviewFont();
const $=id=>document.getElementById(id);let files=new Map(),current='',selection='',history=[],future=[],urls=[],expanded=new Set(),mode='edit',activeForm=null,simulation={},runtimeNodes=new Map(),appendImport=false;
const text=bytes=>new TextDecoder().decode(bytes);const bytes=s=>new TextEncoder().encode(s);
function toast(s){$('toast').textContent=s;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',5000)}
function snapshot(){return {files:new Map(files),current,selection}}function restore(s){files=s.files;current=s.current;selection=s.selection;render()}function record(){invalidate(files);history.push(snapshot());if(history.length>50)history.shift();future=[]}
function data(){return parse(text(files.get(current)||new Uint8Array()))}function save(d){files.set(current,bytes(JSON.stringify(d,null,2)+'\n'))}
function button(label,fn,cls=''){const el=document.createElement('button');el.textContent=label;el.className=cls;el.onclick=fn;return el}
function render(){urls.forEach(URL.revokeObjectURL);urls=[];$('tree').replaceChildren();$('properties').replaceChildren();$('issues').replaceChildren();$('canvas').replaceChildren();$('undo').disabled=!history.length;$('redo').disabled=!future.length;$('export').disabled=!files.size;const parsed=data();const resolved=resolveProject(files,current);const instances=instantiateCollections(resolved.data,files,current,simulation,activeForm);const ns=nodes(instances.data);$('collectionStats').textContent='按钮数据 '+formButtons(simulation,activeForm).length+' 项 · 生成实例 '+instances.created+' 个'+(instances.warnings.length?' · '+instances.warnings.join('；'):'');if(!ns.some(n=>n.id===selection))selection=ns[0]?.id||'';const selected=ns.find(n=>n.id===selection);const filter=$('search').value.toLowerCase();const project=screens(files,$('showOriginal').checked);let activeRoot=selected;while(activeRoot?.parent)activeRoot=activeRoot.parent;
const projectGroups=new Map();let groupKey='',groupBody;for(const screen of project.entries){const key=screen.file+'::'+screen.namespace;if(key!==groupKey){groupKey=key;const group=document.createElement('details');group.open=screen.file===current;const heading=document.createElement('summary');heading.textContent=(screen.namespace||'界面覆盖')+' · '+screen.file;group.append(heading);groupBody=document.createElement('div');group.append(groupBody);projectGroups.set(key,{group,body:groupBody});$('tree').append(group)}const active=screen.file===current&&screen.node.id===activeRoot?.id;const open=expanded.has(screen.id);const row=button((open?'▾ ':'▸ ')+screen.node.name,()=>{activeForm=null;const title=titleForScene(screen,simulation);if(title!==undefined)simulation={...simulation,formTitle:title};current=screen.file;selection=screen.node.id;if(open)expanded.delete(screen.id);else expanded.add(screen.id);render()},'tree-item file'+(active?' active':''));row.title=screen.file;groupBody.append(row);if(open){const treeResolved=resolveProject(files,screen.file);const children=nodes(instantiateCollections(treeResolved.data,files,screen.file,simulation,activeForm).data);for(const n of children){let root=n;while(root.parent)root=root.parent;if(root.id!==screen.node.id||!n.parent)continue;if(!$('showOriginal').checked&&isVanilla(treeResolved.origins.get(n.id)?.file||''))continue;if(filter&&!n.name.toLowerCase().includes(filter))continue;const el=button('└ '+n.name,()=>{activeForm=null;if(current!==screen.file||JSON.parse(selection||'[]')[0]!==n.path[0]){current=screen.file;selection=n.id;render()}else selectNode(n)},'tree-item'+(screen.file===current&&selection===n.id?' active':''));el.dataset.node=n.id;el.dataset.file=screen.file;el.style.paddingLeft=(12+(n.path.length-1)/3*14)+'px';groupBody.append(el);}for(const rule of screen.triggers){const hint=document.createElement('small');hint.textContent='名称触发：'+rule.name+' · '+rule.fields.join(', ')+' · '+rule.kind;hint.title=rule.expression;groupBody.append(hint);}for(const link of screen.links){const hint=document.createElement('small');hint.textContent='可能关联脚本：'+(link.displayTitle||stripFormatting(link.title))+' · '+link.file+':'+link.line;groupBody.append(hint);}}}
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
}if(project.templates.length){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='引用模板（'+project.templates.length+'，非独立界面）';details.append(summary);for(const template of project.templates){const el=button(template.namespace+' · '+template.node.name,()=>{activeForm=null;current=template.file;selection=template.node.id;render()},'tree-item');el.title=template.file;details.append(el)}$('tree').append(details)}if(project.forms.length){const heading=document.createElement('div');heading.className='heading';heading.textContent='脚本表单（静态识别）';$('tree').append(heading);for(const form of project.forms){$('tree').append(button('◇ '+(form.displayTitle||stripFormatting(form.title)),()=>showForm(form),'tree-item'));}}
$('screenName').textContent=current||'界面预览';showSource();const scene=draw(ns);const issues=sceneIssues({parsed,resolved,ns,runtime:scene.runtime,files,file:current,rootName:selected?.path[0],layoutIssues:scene.issues});$('count').textContent=`(${issues.length} 类 / ${issues.reduce((sum,i)=>sum+i.count,0)} 项)`;if(!issues.length)$('issues').textContent='✓ 未发现已知问题；实际游戏效果仍需在基岩版验证。';for(const issue of issues){const label=(issue.severity==='error'?'● ':'○ ')+issue.message+(issue.count>1?'（'+issue.count+' 处）':'');const el=button(label,()=>{if(issue.path)selection=JSON.stringify(issue.path);render()},'issue '+issue.severity);el.title=issue.paths?.map(p=>p.join('/')).join('\n')||'';$('issues').append(el);}if(selected)properties(selected);else $('properties').textContent='导入资源包，或打开示例开始编辑。';}
function showSource(){
  const draft=sourceDrafts.read(current,files.has(current)?text(files.get(current)):'');
  $('source').value=draft.text;
  $('source').readOnly=isVanilla(current)||!files.has(current);
  $('apply').disabled=$('source').readOnly;
  $('sourceStatus').textContent=draft.conflict?'源码草稿基于旧版本；应用将覆盖当前文件。':draft.dirty?'源码草稿尚未应用，不会写入导出文件。':'';
}
$('source').oninput=()=>{
  if(!current||isVanilla(current))return;
  sourceDrafts.update(current,$('source').value,text(files.get(current)||new Uint8Array()));
  const draft=sourceDrafts.read(current,text(files.get(current)||new Uint8Array()));
  $('sourceStatus').textContent=draft.conflict?'源码草稿基于旧版本；应用将覆盖当前文件。':draft.dirty?'源码草稿尚未应用，不会写入导出文件。':'';
};
function properties(n){const raw=isVanilla(current)||n.obj._generated?null:at(data().data,n.path);const resource=textureResource(files,current,runtimeNodes.get(n.id)?.texture??n.obj.texture);if(n.obj.texture!==undefined||runtimeNodes.get(n.id)?.texture!==undefined){const info=document.createElement('small');info.textContent=resource.path?'贴图来源：'+resource.source+' · '+resource.path:resource.message||'未设置贴图';$('properties').append(info);}const runtime=runtimeNodes.get(n.id);if(runtime?._collectionIndex!==undefined){const info=document.createElement('small');info.textContent='表单按钮序号：'+runtime._collectionIndex+'（从 0 开始）';$('properties').append(info);}if(runtime?._trace?.length){const trace=document.createElement('pre');trace.style.whiteSpace='pre-wrap';trace.textContent=runtime._trace.map(t=>t.expression+' → '+(t.error||JSON.stringify(t.value))).join('\n');$('properties').append(trace);}const origin=document.createElement('small');origin.textContent='实例文件：'+current+(n.name.includes('@')?' · 继承：'+n.name.split('@')[1]:'');$('properties').append(origin);const title=document.createElement('h3');title.textContent=n.name;$('properties').append(title);const tag=document.createElement('div');tag.className='tag';tag.textContent=n.obj.type||'未指定类型 / 继承控件';$('properties').append(tag);const note=document.createElement('small');note.textContent=raw?'显示继承和变量解析后的值；修改会写入当前实例覆盖值。修改会移除当前文件注释。':'此子控件来自继承模板，当前只读。可通过下方按钮跳转定义。';if(!raw){const template=resolveProject(files,current).origins.get(n.id);if(template?.file)$('properties').append(button('打开定义文件',()=>{current=template.file;selection='';render()}));}$('properties').append(note);for(const key of ['type','size','offset','anchor_from','anchor_to','text','font_size','font_scale_factor','color','alpha','texture','visible','layer']){const label=document.createElement('label');label.textContent=key==='texture'?'贴图路径（texture）':key;const input=document.createElement('input');input.value=n.obj[key]===undefined?'':typeof n.obj[key]==='string'?n.obj[key]:JSON.stringify(n.obj[key]);input.placeholder=key==='texture'?'例如 textures/ui/my_button':key==='font_size'?'normal / small / large / 数字':'未设置';input.disabled=!raw;input.title=!raw?'继承子控件：请在定义文件中修改':'修改写入当前实例的覆盖值';input.onchange=()=>{let value=input.value;try{if(!value.trim()){record();const d=data().data;delete at(d,n.path)[key];save(d);render();return}if(['size','offset','color'].includes(key)){value=JSON.parse(value);if(!Array.isArray(value)||value.length!==(key==='color'?3:2))throw Error('请输入正确长度的数组')}else if(key==='font_size'&&Object.hasOwn(FONT_SIZES,value)){}else if(['font_size','font_scale_factor','alpha','layer'].includes(key)){value=Number(value);if(!Number.isFinite(value))throw Error('请输入数字或有效字号名称');if(['font_size','font_scale_factor'].includes(key)&&(value<0||(key==='font_size'&&value===0)))throw Error('字号必须大于 0，缩放不能小于 0')}else if(key==='visible'){if(!['true','false'].includes(value))throw Error('请输入 true 或 false');value=value==='true'}record();const d=data().data;at(d,n.path)[key]=value;save(d);render()}catch(e){toast(e.message)}};label.append(input);$('properties').append(label)}}
function draw(ns) {
  const {width:w,height:h}=desktopViewport($('resolution').value,Number($('guiScale').value));
  const zoom=canvasScale(w,h),canvas=$('canvas');
  Object.assign(canvas.style,{width:w+'px',height:h+'px',transform:`scale(${zoom})`});
  canvas.dataset.scale=zoom;$('stage').style.width=w*zoom+'px';$('stage').style.height=h*zoom+'px';
  let root=ns.find(n=>n.id===selection);while(root?.parent)root=root.parent;
  const scene=layoutScene(ns,root?.id,{width:w,height:h,form:activeForm,simulation,mode,measureText:previewFont.measure});
  runtimeNodes=scene.runtime;
  const elements=new Map(),states=new Map();
  for(const [id]of scene.rects)if(runtimeNodes.get(id)?.type==='button')states.set(id,mode==='edit'?$('buttonState').value:'default');
  const updateStats=()=>{
    const hidden=[...elements.values()].filter(el=>el.closest('[hidden]')).length;
    $('controlStats').textContent=`定义控件 ${scene.total} · 已建 ${elements.size} · 显示 ${elements.size-hidden} · 已建但隐藏 ${hidden} · 未建隐藏 ${scene.pruned}`;
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
    updateStats();
  };
  for(const n of ns) {
    const o=runtimeNodes.get(n.id),r=scene.rects.get(n.id);if(!r)continue;
    const el=document.createElement('div'),font=fontMetrics(o);
    el.dataset.node=n.id;el.dataset.file=current;el.dataset.controlName=n.name;el.dataset.parent=n.parent?.id||'';
    el.className='control'+(n.id===selection?' selected':'')+(o._collectionMissing?' missing-data':'');
    Object.assign(el.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px',opacity:typeof o.alpha==='number'?o.alpha:1,zIndex:Number(o.layer)||0,fontSize:font.fontSize+'px',lineHeight:(font.lineHeight+(Number(o.line_padding)||0))+'px'});
    if(o.clips_children===true)el.style.overflow='hidden';
    if(Array.isArray(o.color))el.style.color=`rgb(${o.color.slice(0,3).map(c=>Math.round(c*255)).join(',')})`;
    if(o.type==='label'||o.type==='button') {
      const label=document.createElement('div');label.className='control-text';paintGameText(label,o,scene.textLayouts.get(n.id),{family:previewFont.family,bitmap:previewFont.bitmap});el.append(label);
      Object.assign(el.style,{display:'flex',alignItems:'center',justifyContent:'center'});
      label.style.textAlign=o.text_alignment||(o.type==='label'?'left':'center');
      if(o.type==='label'){label.style.width='100%';el.style.alignItems='flex-start';}
    }
    if(o.type==='button'&&!o.default_control&&!o.hover_control&&!o.pressed_control){el.style.background='#4d665c';el.style.border='2px solid #8caa9a';}
    if(o.type==='image'&&typeof o.texture==='string'&&o.texture) {
      const path=texturePath(files,current,o.texture);
      if(path){const url=URL.createObjectURL(new Blob([files.get(path)],{type:/\.jpe?g$/i.test(path)?'image/jpeg':'image/png'}));urls.push(url);Object.assign(el.style,textureStyle(files,path,o,r,url));}
      else{el.title=textureResource(files,current,o.texture).message||'贴图缺失';el.style.background='repeating-conic-gradient(#a34e9a 0% 25%,#25202b 0% 50%) 0/16px 16px';}
    }
    elements.set(n.id,el);
    el.style.pointerEvents=mode==='preview'?(o.type==='button'&&o.enabled!==false&&r.w>0&&r.h>0?'auto':'none'):'auto';
    el.onpointerdown=e=>startDrag(e,n,el,(dx,dy)=>{
      const rects=new Map(scene.rects);
      for(const child of ns)if(n.path.every((value,i)=>child.path[i]===value)){
        const original=scene.rects.get(child.id);if(original)rects.set(child.id,{...original,x:original.x+dx,y:original.y+dy});
      }
      applyPresentation(rects);
    });
    el.onclick=e=>{
      e.stopPropagation();if(el.dataset.dragged){delete el.dataset.dragged;return;}
      if(mode==='preview'){if(o.type==='button'&&o.enabled!==false&&r.w>0&&r.h>0&&(e.detail===0||pointInRect(el.getBoundingClientRect(),e.clientX,e.clientY)))activateControl(n,ns);return;}
      let top=n;while(top.parent)top=top.parent;
      const key=current+'::'+top.id;
      if(!expanded.has(key)){expanded.add(key);selection=n.id;render();}else selectNode(n);
      document.querySelector('.tree-item.active:not(.file)')?.scrollIntoView({block:'nearest'});
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
  const missing=[...runtimeNodes.values()].filter(o=>o._collectionMissing).length;
  if(missing)$('collectionStats').textContent+=' · '+missing+' 个集合控件缺少对应数据'+(mode==='edit'?'（虚线显示）':'（预览隐藏）');
  if($('zoom').value==='focus') {
    const bounds=[...elements].filter(([id,el])=>!el.closest('[hidden]')&&['image','label','button'].includes(runtimeNodes.get(id)?.type)).map(([id])=>scene.rects.get(id));
    if(bounds.length){const left=Math.min(...bounds.map(r=>r.x)),top=Math.min(...bounds.map(r=>r.y)),width=Math.max(...bounds.map(r=>r.x+r.w))-left,height=Math.max(...bounds.map(r=>r.y+r.h))-top,scale=fitScale(Math.max(width,1),Math.max(height,1),$('viewport').clientWidth,$('viewport').clientHeight);canvas.style.transform=`scale(${scale}) translate(${-left}px,${-top}px)`;canvas.dataset.scale=scale;$('stage').style.width=width*scale+'px';$('stage').style.height=height*scale+'px';}
  }
  return scene;
}
async function unpack(zip,prefix,target,depth=0){if(depth>4)throw Error('嵌套包层数过多');for(const entry of Object.values(zip.files)){if(entry.dir)continue;const name=entry.name.replace(/\\/g,'/');if(name.split('/').includes('..')||name.startsWith('/'))throw Error('包内路径无效');const b=await entry.async('uint8array');if(b.length>100*1024*1024)throw Error('单个文件过大');if(/\.(mcpack|mcaddon)$/i.test(name)){await unpack(await JSZip.loadAsync(b),prefix+name+'/',target,depth+1)}else target.set(prefix+name,b);if(target.size>10000)throw Error('包内文件过多')}}
async function load(list){try{const next=appendImport?new Map(files):new Map([...files].filter(([p])=>isVanilla(p)));const incoming=new Map();for(const f of list){if(f.size>150*1024*1024)throw Error('第一版支持 150 MB 以下的文件');if(/\.json$/i.test(f.name))incoming.set(f.name,new Uint8Array(await f.arrayBuffer()));else{if(!globalThis.JSZip)throw Error('压缩包组件未加载');await unpack(await JSZip.loadAsync(f),'',incoming)}}const merged=mergeImport(next,incoming);next.clear();for(const [p,b]of merged.files)next.set(p,b);const candidates=[...next.keys()].filter(p=>!isVanilla(p)&&/\.json$/i.test(p)&&(/(^|\/)ui\//.test(p)||parse(text(next.get(p))).data?.namespace));if(!candidates.length)throw Error('未找到 UI JSON，请导入包含 ui 文件夹的资源包，或独立 UI JSON。');record();if(!appendImport)sourceDrafts.clear();activeForm=null;const swept=sweepOfficial(next);files=swept.files;if(!appendImport||!files.has(current)){current=candidates.find(p=>!p.endsWith('_ui_defs.json'))||candidates[0];selection='';const entry=screens(files).entries.find(e=>e.file===current)||screens(files).entries[0]||screens(files).custom?.[0];if(entry){current=entry.file;selection=entry.node.id;}}$('project').textContent=list[0].name;render();$('vanillaStatus').textContent='已重新清扫：移除 '+swept.removed.length+' 个重复原版文件';toast('导入完成，共 '+files.size+' 个文件；已清扫 '+swept.removed.length+' 个重复原版文件'+(merged.relocated.length?' · 定位 '+merged.relocated.length+' 个补充文件':'')+(merged.ambiguous.length?' · '+merged.ambiguous.length+' 个贴图路径不明确，保留原路径':''));syncOfficial()}catch(e){toast('导入失败：'+e.message)}}
$('import').onclick=()=>{appendImport=false;$('files').click()};$('dependency').onclick=()=>{appendImport=true;$('files').click()};$('files').onchange=e=>load([...e.target.files]);document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>{e.preventDefault();load([...e.dataTransfer.files])});$('search').oninput=render;$('resolution').onchange=refreshScene;$('guiScale').onchange=refreshScene;$('zoom').onchange=refreshScene;$('undo').onclick=()=>{if(history.length){future.push(snapshot());restore(history.pop())}};$('redo').onclick=()=>{if(future.length){history.push(snapshot());restore(future.pop())}};$('apply').onclick=()=>{if(!current||isVanilla(current))return;const s=$('source').value;record();sourceDrafts.remove(current);files.set(current,bytes(s));render();toast('已应用源码；请查看问题检查。')};
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
$('export').onclick=async()=>{try{if([...files].some(([p,b])=>!isVanilla(p)&&/\.json$/i.test(p)&&parse(text(b)).error)){toast('存在 JSON 语法错误，请修复后导出。');return}const projectFiles=[...files].filter(([path])=>!isVanilla(path));if(projectFiles.length===1){const [path,content]=projectFiles[0];download(new Blob([content],{type:'application/json'}),path.split('/').pop());return}if(!globalThis.JSZip)throw Error('压缩包组件未加载');const zip=new JSZip();for(const [p,b]of files)if(!isVanilla(p))zip.file(p,b);download(await zip.generateAsync({type:'blob'}),'easy-see-edited.zip');toast('已导出 ZIP；嵌套包已展开为文件夹。')}catch(e){toast(e.message)}};
$('demo').onclick=()=>{activeForm=null;record();sourceDrafts.clear();files=new Map([['Example_RP/ui/demo.json',bytes(JSON.stringify({namespace:'easy_see',main:{type:'panel',size:[440,260],controls:[{title:{type:'label',text:'你的界面，从这里开始',size:[320,36],offset:[0,-70],font_size:22,color:[.65,.92,.77]}},{subtitle:{type:'label',text:'选择左侧控件，在右侧修改参数',size:[320,24],offset:[0,-20],color:[.65,.7,.8]}},{start:{type:'button',text:'开始冒险',size:[180,40],offset:[0,55]}}]}} ,null,2))]]);current='Example_RP/ui/demo.json';selection='';$('project').textContent='示例项目';render()};$('demo').click();

function showForm(form,preserve=false){activeForm=form;const project=screens(files),matches=project.entries.filter(s=>s.links.some(f=>f.id===form.id));const target=sceneForForm(project.entries,form);if(!preserve){const titleField=form.fields.find(f=>f.kind==='title'),prefix=titleField?.parts?.slice(0,titleField.parts.indexOf(null)).join('');const keep=form.titlePattern&&prefix&&simulation.formTitle?.startsWith(prefix);simulation={...simulation,formTitle:keep?simulation.formTitle:form.title,formBody:keep?simulation.formBody||'':form.fields.find(f=>f.kind==='body')?.text||'',formButtons:keep?formButtons(simulation,form):formButtons({},form)}};if(target){current=target.file;selection=target.node.id;expanded.add(target.id);render();$('screenName').textContent=form.title+' · 自定义表单';if($('canvas').querySelectorAll('.control').length>1)return;toast('该布局缺少可渲染的模板，暂显示标准表单。');}render();$('canvas').replaceChildren();$('screenName').textContent=form.title+' · '+(matches.length>1?'多个布局候选，暂用标准表单':'标准表单模拟');const box=document.createElement('div');box.className='form-simulation';const title=document.createElement('h2');paintText(title,simulation.formTitle??form.title);box.append(title);const previewFields=[{kind:'body',text:simulation.formBody||''},...formButtons(simulation,form).map(v=>({...v,kind:'button'}))];for(const field of previewFields){if(field.kind==='title')continue;const el=field.kind==='button'?button('',()=>{if(mode==='preview'){ $('clickResult').textContent='点击：button.form_button_click · 序号：'+field.index;followButton(form,field.index)}else inspectScript(form,field)}):document.createElement('p');if(field.texture){const path=texturePath(files,form.file,field.texture);if(path){const img=document.createElement('img'),url=URL.createObjectURL(new Blob([files.get(path)],{type:'image/png'}));urls.push(url);img.src=url;img.alt='';el.append(img)}}const label=document.createElement('span');paintText(label,field.dynamic?'[动态内容]':field.text);el.append(label);box.append(el)}$('canvas').append(box);inspectScript(form);}
function inspectScript(form,field){$('properties').replaceChildren();const h=document.createElement('h3');h.textContent=stripFormatting(field?field.text:form.title);const note=document.createElement('small');note.textContent='脚本：'+form.file+':'+form.line+'。'+(form.items.length?'候选触发物品：'+form.items.join('、'):'未识别到确定的物品触发入口。')+' 标准脚本表单字段暂只读；动态逻辑不执行。';$('properties').append(h,note);}
function followButton(form,index){const jump=form.jumps.find(j=>j.index===index),target=jump&&screens(files).forms.find(f=>f.id===jump.target);if(target)showForm(target);else toast('该按钮的跳转无法静态确定，未执行游戏脚本。');}
function activateControl(n,ns){let b=n;while(b&&b.obj.type!=='button')b=b.parent;if(!b)return;const index=runtimeNodes.get(b.id)?._collectionIndex;const buttonId=b.obj.button_mappings?.find(m=>m.from_button_id==='button.menu_select')?.to_button_id||'button.form_button_click';$('clickResult').textContent='点击：'+buttonId+' · 序号：'+(index??'未绑定集合');if(index===undefined){toast('该按钮没有可确定的集合序号。');return}if(activeForm)followButton(activeForm,index);else toast('已记录按钮序号；当前没有关联脚本跳转。');}
function startDrag(e,n,el,previewMove){
  if(n.obj._generated||isVanilla(current)||mode!=='edit'||e.button!==0||!at(data().data,n.path))return;
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
    record();const d=data().data;at(d,n.path).offset=[Math.round((old[0]||0)+dx),Math.round((old[1]||0)+dy)];save(d);selection=n.id;render();
  };
}
function selectNode(n){selection=n.id;document.querySelectorAll('[data-node]').forEach(el=>{const active=el.dataset.node===selection&&el.dataset.file===current;el.classList.toggle(el.classList.contains('control')?'selected':'active',active)});$('properties').replaceChildren();properties(n);}

$('buttonState').onchange=refreshScene;
$('mode').onchange=e=>{mode=e.target.value;$('buttonState').disabled=mode!=='edit';document.body.dataset.mode=mode;if(activeForm)showForm(activeForm,true);else render()};

function paintText(el,value){for(const run of textRuns(value)){const span=document.createElement('span');span.textContent=run.text;Object.assign(span.style,run.style);el.append(span)}}

$('simulate').onclick=()=>{try{const value=JSON.parse($('simulation').value);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('需要 JSON 对象');formButtons(value,activeForm);simulation=value;if(activeForm)showForm(activeForm,true);else render();toast('已应用模拟数据')}catch(e){toast('模拟数据无效：'+e.message)}};
$('preset').onchange=e=>{const presets={martial:{formTitle:'武道天书',formBody:''},star:{formTitle:'北斗星空图',formBody:''},quest:{formTitle:'MSQB:小页|任务',formBody:'',bindings:{'#form_button_text':'QRA0任务说明','#form_button_texture':'textures/ui/questbook/icon_unknown'}},hud:{title:'MSHUD:境界：炼体\n气血：100 / 100',subtitle:'',actionbar:''}};$('simulation').value=JSON.stringify(presets[e.target.value]||{},null,2);const project=screens(files);const target=e.target.value==='hud'?[...project.entries,...(project.custom||[])].find(s=>s.node.name==='ms_status_panel'):project.entries.find(s=>s.namespace==='server_form'&&s.node.name==='long_form');if(target){activeForm=null;current=target.file;selection=target.node.id;expanded.add(target.id)}$('simulate').click()};

function canvasScale(w,h){return ['fit','focus'].includes($('zoom').value)?fitScale(w,h,$('viewport').clientWidth,$('viewport').clientHeight):Number($('zoom').value)}
function refreshScene(){if(activeForm)showForm(activeForm,true);else render()}
new ResizeObserver(()=>{const canvas=$('canvas'),w=parseFloat(canvas.style.width),h=parseFloat(canvas.style.height);if(!w||!h||$('zoom').value!=='fit')return;const scale=canvasScale(w,h);canvas.style.transform='scale('+scale+')';canvas.dataset.scale=scale;$('stage').style.width=w*scale+'px';$('stage').style.height=h*scale+'px'}).observe($('viewport'));

$('vanilla').onclick=()=>syncOfficial();$('showOriginal').onchange=render;$('vanillaFolder').onclick=()=>$('vanillaDirectory').click();
async function loadVanilla(list){try{const archive=new Map();for(const f of list){if(f.webkitRelativePath){archive.set(f.webkitRelativePath,new Uint8Array(await f.arrayBuffer()))}else{if(!globalThis.JSZip)throw Error('压缩包组件未加载');await unpack(await JSZip.loadAsync(f),'',archive)}}const installed=installVanilla(files,archive);record();files=removeShadowedVanilla(installed.files);refreshScene();$('vanillaStatus').textContent='原版资源：'+installed.count+' 个文件（'+list[0].name+'）';toast('原版资源已加载，仅用于预览，不包含在导出中。')}catch(e){toast('原版资源导入失败：'+e.message)}}
$('vanillaFiles').onchange=e=>{if(e.target.files.length)loadVanilla([...e.target.files]);e.target.value=''};$('vanillaDirectory').onchange=e=>loadVanilla([...e.target.files]);

let officialBusy=false,officialAgain=false;
async function syncOfficial(){if(officialBusy){officialAgain=true;return}officialBusy=true;$('vanilla').disabled=true;$('vanillaStatus').textContent='正在获取官方预览资源…';const project=files;try{const result=await loadOfficial(project,{simulation,extraTextures:[...runtimeNodes.values()].map(o=>o.texture),progress:p=>{if(files===project)$('vanillaStatus').textContent='官方资源加载中：'+p.done+' 项'}});if(files!==project)return;const swept=sweepOfficial(files,result.resources);invalidate(files);files=swept.files;const available=screens(files).entries;if(!(files.has(current)&&Object.hasOwn(resolveProject(files,current).data||{},JSON.parse(selection||'[]')[0]))&&available.length){current=available[0].file;selection=available[0].node.id}refreshScene();$('vanillaStatus').textContent='官方预览资源：'+result.resources.size+' 项 · 跳过已有 '+result.skipped.length+' 项 · '+OFFICIAL_REF.slice(0,7)+(result.failed.length?' · '+result.failed.length+' 项失败':'')+(result.limited?' · 达到本次下载上限，可再次补齐':'');toast('已补齐可获取的官方资源；完整游戏渲染仍取决于版本和功能支持。')}catch(e){if(files===project){$('vanillaStatus').textContent='官方资源加载失败，可重试或手动导入';toast(e.message)}}finally{officialBusy=false;$('vanilla').disabled=false;if(officialAgain){officialAgain=false;queueMicrotask(()=>syncOfficial())}}}

$('importSimulation').onclick=()=>$('simulationFile').click();
$('simulationFile').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
    const value=JSON.parse(await file.text());
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('需要 JSON 对象');
    formButtons(value,activeForm);
    $('simulation').value=JSON.stringify(value,null,2);
    $('simulate').click();
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
