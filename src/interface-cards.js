import {resolveProject,resolveScene} from './resolver.js';
import {nodes} from './core.js';
import {instantiateCollections} from './collections.js';
import {layoutScene} from './layout.js';
import {presentScene} from './scene-presentation.js';
import {sceneIssues} from './diagnostics.js';
import {texturePath} from './runtime.js';
import {nodeContains,screenLabel} from './navigation.js';

export function cardAnalysis(files,screen,simulation,route){
  simulation=route?.kind==='container'?{...simulation,containerTitle:route.sample}:simulation;
  const resolved=route?.kind==='container'?resolveScene(files,screen.file,simulation,screen.node.name):resolveProject(files,screen.file),instances=instantiateCollections(resolved.data,files,screen.file,simulation,undefined,{rootName:screen.node.name}),all=nodes(instances.data);
  const rootId=route?.node.id||screen.node.id;
  // Layout and counts must use this branch, including hidden descendants, rather
  // than every sibling under long_form. Keep original paths for diagnostics.
  const ns=route?all.filter(n=>nodeContains(route.node,n)).map(n=>n.id===rootId?{...n,parent:null}:n):all;
  const scene=layoutScene(ns,rootId,{width:640,height:360,simulation,mode:'preview'}),presentation=presentScene(ns,scene);
  let issues=sceneIssues({parsed:{data:resolved.data},resolved,ns,runtime:scene.runtime,files,file:screen.file,rootName:screen.node.name,layoutIssues:scene.issues});
  if(route)issues=issues.filter(issue=>!issue.path&&!issue.paths?.length||(issue.paths||[issue.path]).some(path=>path.every((part,i)=>route.node.path[i]===part)||route.node.path.every((part,i)=>path[i]===part)));
  return {scene,presentation,issues};
}

// A local layout overview, not a second editor renderer. Selection always opens
// the full fidelity canvas. No imported scripts or remote image URLs are run.
async function thumbnail(canvas,files,screen,simulation,route){
  const {scene,presentation,issues}=cardAnalysis(files,screen,simulation,route);
  const context=canvas.getContext('2d');context.fillStyle='#252c38';context.fillRect(0,0,320,180);context.scale(.5,.5);
  const visual=[...presentation].filter(([id,item])=>item.visible&&item.opacity>0&&item.rect.w>0&&item.rect.h>0&&['image','label','button'].includes(scene.runtime.get(id)?.type)).map(([,item])=>item.rect);
  if(visual.length){
    const left=Math.min(...visual.map(r=>r.x)),top=Math.min(...visual.map(r=>r.y)),width=Math.max(...visual.map(r=>r.x+r.w))-left,height=Math.max(...visual.map(r=>r.y+r.h))-top;
    const scale=Math.min(608/Math.max(width,1),328/Math.max(height,1));
    context.translate((640-width*scale)/2,(360-height*scale)/2);context.scale(scale,scale);context.translate(-left,-top);
  }
  const imageCache=new Map(),pathCache=new Map();
  const imageFor=path=>{if(!imageCache.has(path))imageCache.set(path,(async()=>{const url=URL.createObjectURL(new Blob([files.get(path)]));try{const image=new Image();image.src=url;await image.decode();return image;}finally{URL.revokeObjectURL(url);}})());return imageCache.get(path);};
  for(const [id,item]of [...presentation].sort(([,a],[,b])=>a.layer-b.layer)){
    if(!canvas.isConnected)return;
    if(!item.visible)continue;
    const obj=scene.runtime.get(id),r=item.rect;context.save();context.globalAlpha=item.opacity;
    if(item.clip){context.beginPath();context.rect(item.clip.x,item.clip.y,item.clip.w,item.clip.h);context.clip();}
    if(obj.type==='image'&&!pathCache.has(obj.texture))pathCache.set(obj.texture,texturePath(files,screen.file,obj.texture));
    const path=obj.type==='image'&&pathCache.get(obj.texture);
    if(path){
      try{const image=await imageFor(path);context.imageSmoothingEnabled=false;context.drawImage(image,r.x,r.y,r.w,r.h);}catch{}
    }else if(['panel','screen','button'].includes(obj.type)){context.strokeStyle=obj.type==='button'?'#8bbda5':'#526575';context.strokeRect(r.x,r.y,r.w,r.h);}
    if(scene.textLayouts.has(id)){
      const layout=scene.textLayouts.get(id);context.font='8px sans-serif';context.fillStyle=item.color?`rgb(${item.color.map(c=>c*255).join(',')})`:'#e3e8ef';context.textBaseline='top';
      layout.lines.forEach((line,i)=>{let x=r.x;for(const glyph of line.glyphs){context.fillText(glyph.char,x,r.y+i*layout.lineHeight);x+=glyph.width;}});
    }
    context.restore();
  }
  return {total:scene.total,issues:issues.length,visible:[...presentation.values()].filter(p=>p.visible).length};
}

const generations=new WeakMap();
export function interfaceCards(container,model,files,{simulation,presetFor,openScreen,openRoute}){
  const generation={};generations.set(container,generation);
  container.replaceChildren();const jobs=[];
  for(const [category,screens]of model.groups){
    const heading=document.createElement('h3');heading.textContent=category;container.append(heading);
    const wall=document.createElement('div');wall.className='screen-cards';container.append(wall);
    for(const screen of screens){
      // Mounted definitions are reachable from their branch card.
      if(model.routes.some(route=>route.definition?.id===screen.id))continue;
      const routes=model.routes.filter(route=>route.screen.id===screen.id),entries=routes.length?routes.map(route=>({route,label:route.label})):[{label:screenLabel(screen)}];
      for(const entry of entries){
        const card=document.createElement('button');card.className='screen-card';card.title=screen.file;card.dataset.screen=screen.id;
        if(entry.route)card.dataset.route=entry.route.id;
        const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;canvas.setAttribute('aria-label','布局缩略图');
        const name=document.createElement('strong');name.textContent=entry.label;
        const stats=document.createElement('small');stats.textContent='布局缩略图 · 正在计算…';
        card.append(canvas,name,stats);wall.append(card);card.onclick=()=>entry.route?openRoute(entry.route):openScreen(screen);
        let sample=entry.route?presetFor(entry.route):{...simulation};
        if(!entry.route)for(const trigger of screen.triggers||[]){
          if(!/^[A-Z][A-Z0-9_]*:/.test(trigger.name))continue;
          const key=trigger.fields.some(f=>/subtitle/.test(f))?'subtitle':trigger.fields.some(f=>/actionbar/.test(f))?'actionbar':trigger.fields.some(f=>/hud_title/.test(f))?'title':null;
          if(key&&!sample[key])sample={...sample,[key]:trigger.name+'示例'};
        }
        jobs.push(async()=>{try{const result=await thumbnail(canvas,files,screen,sample,entry.route);if(result){card.dataset.count=result.total;stats.textContent=`定义 ${result.total} · 问题 ${result.issues} 类`+(result.visible?'':' · 模拟数据未触发显示');}}catch{stats.textContent='布局暂不可预览，点击查看定义与诊断';}});
      }
    }
  }
  // Yield between cards, and stop when the overview was replaced by navigation.
  (async()=>{for(const job of jobs){if(!container.isConnected||container.hidden||generations.get(container)!==generation)return;await job();await new Promise(resolve=>requestAnimationFrame(resolve));}})();
}
