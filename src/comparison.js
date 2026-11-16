import {resolveScene} from './resolver.js';
import {instantiateCollections} from './collections.js';
import {nodes} from './core.js';
import {layoutScene} from './layout.js';
import {presentScene,clipInsets} from './scene-presentation.js';
import {textureResource} from './resources.js';
import {textureStyle} from './texture-style.js';
import {fontMetrics} from './font.js';
import {paintGameText} from './text-layout.js';
import {compileAnimations,animateScene} from './animations.js';

export function comparisonSimulation(simulation,pocket){return {...simulation,touch:pocket,pocketEdition:pocket,pocketScreen:pocket};}
export function outside(rect,width,height){return rect.w>0&&rect.h>0&&(rect.x<-.01||rect.y<-.01||rect.x+rect.w>width+.01||rect.y+rect.h>height+.01);}
export class Comparison {
 constructor(container){this.container=container;this.views=[];this.urls=[];this.observers=[];}
 dispose(){this.observers.forEach(observer=>observer.disconnect());this.observers=[];this.urls.forEach(URL.revokeObjectURL);this.urls=[];this.views=[];this.container.replaceChildren();}
 render({files,file,rootName,simulation,form,font,stretch=false,event='',safe=5}){
  this.dispose();if(!rootName)return;
  for(const device of [{label:'电脑 1080p · GUI 3×',width:640,height:360,pocket:false},{label:'手机 1280×720 · GUI 最大 4×',width:320,height:180,pocket:true}]){
   const sim=comparisonSimulation(simulation,device.pocket),resolved=resolveScene(files,file,sim,rootName),instances=instantiateCollections(resolved.data,files,file,sim,form,{rootName,previewFactory:true}),ns=nodes(instances.data).filter(n=>n.path[0]===rootName);
   const scene=layoutScene(ns,JSON.stringify([rootName]),{width:device.width,height:device.height,simulation:sim,form,mode:'preview',measureText:font.measure}),animations=compileAnimations(files,file,ns,scene.runtime,{event});
   const card=document.createElement('section');card.className='comparison-card';card.dataset.device=device.pocket?'pocket':'desktop';
   const heading=document.createElement('strong');heading.textContent=device.label;card.append(heading);
   const status=document.createElement('small');status.className='comparison-status';card.append(status);
   const viewport=document.createElement('div');viewport.className='comparison-viewport';const stage=document.createElement('div');stage.className='comparison-stage';stage.style.cssText=`position:relative;width:${device.width}px;height:${device.height}px;transform-origin:top left;overflow:hidden;background:#252c38`;
   viewport.append(stage);card.append(viewport);this.container.append(card);
   const elements=new Map(),paths=new Map(),urls=new Map();
   const resource=texture=>{if(!paths.has(texture))paths.set(texture,textureResource(files,file,texture));return paths.get(texture);};
   const imageURL=path=>{if(!urls.has(path)){const url=URL.createObjectURL(new Blob([files.get(path)]));urls.set(path,url);this.urls.push(url);}return urls.get(path);};
   for(const n of ns){
    const o=scene.runtime.get(n.id),r=scene.rects.get(n.id);if(!r)continue;
    const el=document.createElement('div');el.className='preview-control';el.dataset.previewControl=n.name;
    const metrics=fontMetrics(o);el.style.cssText=`position:absolute;width:${r.w}px;height:${r.h}px;font-size:${metrics.fontSize}px;line-height:${metrics.lineHeight}px;pointer-events:none`;
    if(['label','button'].includes(o.type)){
     const label=document.createElement('div');label.className='control-text';paintGameText(label,o,scene.textLayouts.get(n.id),{family:font.family,bitmap:font.bitmap,stretch});el.append(label);
     Object.assign(el.style,{display:'flex',alignItems:o.type==='label'?'flex-start':'center',justifyContent:'center'});if(o.type==='label')label.style.width='100%';
    }
    if(o.type==='button'&&!o.default_control&&!o.hover_control&&!o.pressed_control){el.style.background='#4d665c';el.style.border='2px solid #8caa9a';}
    if(o.type==='image'&&o.texture){const path=resource(o.texture).path;if(path)Object.assign(el.style,textureStyle(files,path,o,r,imageURL(path)));else el.style.background='repeating-conic-gradient(#a34e9a 0% 25%,#25202b 0% 50%) 0/8px 8px';}
    if(o._containerSlot){el.classList.add('container-slot');if(o._containerTexture){const sprite=document.createElement('div');sprite.className='slot-preview';const path=resource(o._containerTexture).path;if(path)sprite.style.backgroundImage=`url("${imageURL(path)}")`;else sprite.classList.add('missing-slot-texture');if(o._containerItem?.count>1){const count=document.createElement('span');count.textContent=o._containerItem.count;sprite.append(count);}el.append(sprite);}}
    stage.append(el);elements.set(n.id,el);
   }
   const guide=document.createElement('div');guide.className='safe-area-guide';guide.style.inset=safe+'%';guide.title='安全区参考线 '+safe+'%';stage.append(guide);
   const observer=new ResizeObserver(()=>{const scale=Math.max(.1,(viewport.clientWidth-2)/device.width);stage.style.transform=`scale(${scale})`;viewport.style.height=device.height*scale+'px';});observer.observe(viewport);this.observers.push(observer);
   const view={ns,scene,animations,elements,status,device,content:resolved.data[rootName]?.$screen_content};this.views.push(view);
  }
  this.frame(0,false);
 }
 frame(time,enabled){
  for(const view of this.views){
   const scene=enabled?animateScene(view.ns,view.scene,view.animations,time):view.scene,presentation=presentScene(view.ns,scene);let count=0;const names=[];
   for(const [id,el]of view.elements){const item=presentation.get(id);if(!item)continue;el.hidden=!item.visible;const out=item.visible&&item.opacity>0&&outside(item.rect,view.device.width,view.device.height);if(out){count++;if(names.length<50)names.push(el.dataset.previewControl);}
    el.classList.toggle('outside-screen',out);Object.assign(el.style,{left:item.rect.x+'px',top:item.rect.y+'px',opacity:item.opacity,zIndex:String(item.layer),clipPath:clipInsets(item.rect,item.clip),color:item.color?`rgb(${item.color.slice(0,3).map(c=>Math.round(c*255)).join(',')})`:''});
   }
   view.status.textContent=(view.content?'内容：'+view.content+' · ':'')+'控件边界出屏 '+count+' 个（红框）';view.status.title=names.join('\n');view.status.dataset.outside=count;
  }
 }
}
