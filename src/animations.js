import {resolveTemplate} from './resolver.js';
import {dimension} from './core.js';
import {expression} from './expression.js';

const supported=new Set(['offset','alpha','wait']);
export function easing(name,t){
 t=Math.max(0,Math.min(1,t));
 const curves={linear:t=>t,in_sine:t=>1-Math.cos(t*Math.PI/2),out_sine:t=>Math.sin(t*Math.PI/2),in_out_sine:t=>(1-Math.cos(t*Math.PI))/2,in_quad:t=>t*t,out_quad:t=>1-(1-t)**2,in_out_quad:t=>t<.5?2*t*t:1-(-2*t+2)**2/2,in_cubic:t=>t**3,out_cubic:t=>1-(1-t)**3,in_out_cubic:t=>t<.5?4*t**3:1-(-2*t+2)**3/2,in_quart:t=>t**4,out_quart:t=>1-(1-t)**4,in_expo:t=>t===0?0:2**(10*t-10),out_expo:t=>t===1?1:1-2**(-10*t)};
 return (curves[name]||curves.linear)(t);
}
const interpolate=(a,b,t)=>Array.isArray(a)&&Array.isArray(b)?a.map((value,i)=>interpolate(value,b[i],t)):typeof a==='number'&&typeof b==='number'?a+(b-a)*t:t<1?a:b;
function value(v,context){
 if(Array.isArray(v))return v.map(item=>value(item,context));
 if(typeof v==='string'){
  const evaluated=expression(v,context);if(!evaluated.error)return evaluated.value;
 }
 return v;
}
export function compileAnimations(files,file,ns,runtime,{event=''}={}){
 const tracks=[],warnings=new Set(),events=new Set(),templates=new Map();
 const find=ref=>{if(!templates.has(ref))templates.set(ref,resolveTemplate(files,file,ref)?.obj);return templates.get(ref);};
 for(const n of ns){
  const obj=runtime.get(n.id);if(!obj||obj._layoutHidden)continue;
  const refs=[...['offset','alpha'].filter(key=>typeof obj[key]==='string'&&obj[key].startsWith('@')).map(key=>obj[key]),...(Array.isArray(obj.anims)?obj.anims:[])];
  for(const ref of new Set(refs)){
   if(typeof ref!=='string'||!ref.startsWith('@'))continue;
   const first=find(ref);if(!first){warnings.add('找不到动画 '+ref);continue;}
   if(first.play_event){events.add(first.play_event);if(first.play_event!==event)continue;}
   const chain=[],seen=new Map();let next=ref,total=0,cycle=null;
   while(next&&chain.length<128){
    if(seen.has(next)){cycle=seen.get(next);break;}
    const animation=find(next);if(!animation){warnings.add('找不到动画 '+next);break;}
    if(!supported.has(animation.anim_type)){warnings.add('暂未播放 '+animation.anim_type+' 动画：'+next);break;}
    const context=obj._context||{},duration=Number(value(animation.duration??0,context));
    if(!Number.isFinite(duration)||duration<0){warnings.add('动画时长无效：'+next);break;}
    seen.set(next,total);
    chain.push({...animation,start:total,duration,from:value(animation.from,context),to:value(animation.to,context),ref:next});total+=duration;next=animation.next;
   }
   if(chain.length>=128)warnings.add('动画链超过 128 段：'+ref);
   if(cycle!==null&&total<=cycle){warnings.add('动画循环总时长为 0：'+ref);cycle=null;}
   if(chain.length)tracks.push({id:n.id,startTick:obj._context?._eventTick,ref,chain,duration:total,cycle});
  }
 }
 return {tracks,warnings:[...warnings],events:[...events].sort(),duration:Math.min(600,tracks.length?Math.max(.01,...tracks.map(track=>track.cycle!==null?Math.max(10,track.duration):track.duration)):10)};
}
export function sampleTrack(track,time){
 time=Math.max(0,Number(time)||0);
 if(track.cycle!==null&&time>=track.duration&&track.duration>track.cycle)time=track.cycle+(time-track.cycle)%(track.duration-track.cycle);
 const result={};
 for(const segment of track.chain){
  if(time<segment.start)break;
  const progress=segment.duration?Math.min(1,(time-segment.start)/segment.duration):1;
  if(segment.anim_type!=='wait')result[segment.anim_type]=interpolate(segment.from,segment.to,easing(segment.easing,progress));
  if(progress<1)break;
  if(segment.destroy_at_end&&time>=segment.start+segment.duration){result.destroy=segment.destroy_at_end;break;}
 }
 return result;
}
// Offset changes carry descendants. Layout and bindings remain the base frame;
// playback never edits source or reconstructs thousands of DOM elements.
export function animateScene(ns,base,compiled,time){
 const values=new Map(),hidden=new Set();
 for(const track of compiled.tracks){
  const sampled=sampleTrack(track,track.startTick===undefined?time:Math.max(0,time-track.startTick/20));values.set(track.id,{...values.get(track.id),...sampled});
  if(sampled.destroy){let node=ns.find(n=>n.id===track.id),target=node;while(node){if(node.name.split('@')[0]===sampled.destroy){target=node;break;}node=node.parent;}if(target)hidden.add(target.id);}
 }
 const runtime=new Map(base.runtime),rects=new Map(),shifts=new Map();
 for(const n of ns){
  const rect=base.rects.get(n.id),obj=base.runtime.get(n.id);if(!rect||!obj)continue;
  const sampled=values.get(n.id),parent=n.parent&&base.rects.get(n.parent.id),inherited=shifts.get(n.parent?.id)||[0,0];let [x,y]=inherited;
  if(Array.isArray(sampled?.offset)){
   x+=dimension(sampled.offset[0],parent?.w||rect.w)-dimension(obj.offset?.[0],parent?.w||rect.w);
   y+=dimension(sampled.offset[1],parent?.h||rect.h)-dimension(obj.offset?.[1],parent?.h||rect.h);
  }
  shifts.set(n.id,[x,y]);rects.set(n.id,{...rect,x:rect.x+x,y:rect.y+y});
  if(sampled||hidden.has(n.id))runtime.set(n.id,{...obj,...(typeof sampled?.alpha==='number'?{alpha:sampled.alpha}:{}),_animationHidden:hidden.has(n.id)});
 }
 return {...base,runtime,rects};
}
