import {dimension} from './core.js';
import {runtimeObject} from './bindings.js';
import {layoutText,glyphAdvance} from './text-layout.js';

const anchors = {top_left:[0,0],top_middle:[.5,0],top_right:[1,0],left_middle:[0,.5],center:[.5,.5],right_middle:[1,.5],bottom_left:[0,1],bottom_middle:[.5,1],bottom_right:[1,1]};
const contentPattern = /^(-?[\d.]+)%(cm|c)(?:\s*([+-])\s*([\d.]+)(?:px)?)?$/;
export const contentDimension = value => typeof value === 'string' ? contentPattern.exec(value.trim()) : null;

export function textExtent(obj,maxWidth=Infinity,measure=glyphAdvance){const {w,h}=layoutText(obj,maxWidth,measure);return {w,h};}

// Measure children before content-sized parents; layout percentages afterward.
export function layoutScene(ns, rootId, {width,height,form,simulation = {},mode = 'edit',measureText} = {}) {
  const root = ns.find(n=>n.id===rootId);
  const relevant = root ? ns.filter(n=>n.path[0]===root.path[0]) : [];
  const runtime = new Map(), children = new Map(), sizes = new Map(), rects = new Map();
  for (const n of relevant) {
    if (n.parent && (!runtime.has(n.parent.id) || runtime.get(n.parent.id)._layoutHidden)) continue;
    const o = runtimeObject(n.obj,form,simulation,n.parent?runtime.get(n.parent.id)._context:{});
    o._layoutHidden = o.ignored === true || o.visible === false && !(mode==='edit' && o._collectionMissing);
    runtime.set(n.id,o);
    if(n.parent) { const list=children.get(n.parent.id)||[];list.push(n);children.set(n.parent.id,list); }
  }
  const issues=[],extentCache=new Map();
  const labelExtent=(n,o,limit)=>{
    const key=n.id+'::'+limit;
    if(!extentCache.has(key))extentCache.set(key,textExtent(o,limit,measureText));
    return extentCache.get(key);
  };
  const constrain=(o,axis,value,parent)=>{
    const minimum=dimension(o.min_size?.[axis],parent,0),maximum=dimension(o.max_size?.[axis],parent,Infinity);
    return Math.max(0,Math.min(Math.max(minimum,value),maximum));
  };
  function measure(n,pw,ph,previous,fill) {
    const o=runtime.get(n.id);
    if(!o||o._layoutHidden)return {w:0,h:0};
    const defaults=o.type==='label'?['default','default']:['panel','screen','collection_panel','input_panel','scroll_view'].includes(o.type)||!n.parent?['100%','100%']:[100,30];
    const dims=(Array.isArray(o.size)?o.size:defaults).map(v=>v==='default'&&o.type==='stack_panel'?'100%c':v);
    const content=dims.map(contentDimension),prior=previous.get(n.id)||{w:0,h:0};
    let w=content[0]?prior.w:dims[0]==='fill'?(fill?.axis===0?fill.value:pw):dimension(dims[0],pw,o.type==='label'?0:100);
    let h=content[1]?prior.h:dims[1]==='fill'?(fill?.axis===1?fill.value:ph):dimension(dims[1],ph,o.type==='label'?0:30);
    const autoW=o.type==='label'&&(dims[0]==='default'||dims[0]===undefined);
    const autoH=o.type==='label'&&(dims[1]==='default'||dims[1]===undefined);
    if(autoW)w=labelExtent(n,o,dimension(o.max_size?.[0],pw,Infinity)).w;
    w=constrain(o,0,w,pw);
    if(autoH)h=labelExtent(n,o,w).h;
    h=constrain(o,1,h,ph);
    const kids=(children.get(n.id)||[]).filter(c=>!runtime.get(c.id)._layoutHidden);
    let extents;
    if(o.type==='stack_panel'){
      const axis=o.orientation==='horizontal'?0:1,flex=kids.filter(c=>runtime.get(c.id).size?.[axis]==='fill');
      const fixed=new Map(kids.filter(c=>!flex.includes(c)).map(c=>[c.id,measure(c,w,h,previous)]));
      const occupied=[...fixed.values()].reduce((sum,s)=>sum+(axis?s.h:s.w),0),remaining=Math.max(0,(axis?h:w)-occupied)/Math.max(1,flex.length);
      extents=kids.map(c=>fixed.get(c.id)||measure(c,w,h,previous,{axis,value:remaining}));
    }else extents=kids.map(c=>measure(c,w,h,previous));
    for(let axis=0;axis<2;axis++){
      const match=content[axis];if(!match)continue;
      const spans=extents.map(size=>axis?size.h:size.w);
      const stack=o.type==='stack_panel'&&(o.orientation==='horizontal'?axis===0:axis===1)&&match[2]!=='cm';
      const extent=spans.reduce((total,value)=>stack?total+value:Math.max(total,value),0);
      const value=extent*Number(match[1])/100+(match[3]==='-'?-1:1)*Number(match[4]||0);
      if(axis)h=constrain(o,axis,value,ph);else w=constrain(o,axis,value,pw);
    }
    if(autoH)h=constrain(o,1,labelExtent(n,o,w).h,ph);
    const size={w,h};sizes.set(n.id,size);return size;
  }
  let changed=[];
  if(root&&runtime.has(root.id))for(let pass=0;pass<24;pass++){
    const previous=new Map(sizes);
    measure(root,width,height,previous);
    changed=[...sizes].filter(([id,size])=>{const prior=previous.get(id);return !prior||Math.abs(prior.w-size.w)>.01||Math.abs(prior.h-size.h)>.01;});
    if(!changed.length)break;
  }
  if(changed.length){
    const affected=new Set(changed.map(([id])=>id));
    for(const n of relevant)if(affected.has(n.id)&&Array.isArray(runtime.get(n.id)?.size)&&runtime.get(n.id).size.some(contentDimension))issues.push({path:n.path,severity:'warning',message:'尺寸依赖在 24 轮内未收敛：'+n.name+'，请检查父子百分比尺寸是否循环依赖。'});
  }
  // Every size is already constrained. Place stack children before their descendants.
  function place(n,p,stack) {
    const o=runtime.get(n.id),size=sizes.get(n.id);if(!o||o._layoutHidden||!size)return;
    const {w,h}=size,a=anchors[o.anchor_from]||anchors.center,b=anchors[o.anchor_to]||anchors.center;
    const r={x:p.x+p.w*a[0]-w*b[0]+dimension(o.offset?.[0],p.w),y:p.y+p.h*a[1]-h*b[1]+dimension(o.offset?.[1],p.h),w,h,visible:true};
    if(stack)r[stack.horizontal?'x':'y']=(stack.horizontal?p.x:p.y)+stack.used+dimension(o.offset?.[stack.horizontal?0:1],stack.horizontal?p.w:p.h);
    rects.set(n.id,r);
    let used=0;
    for(const child of children.get(n.id)||[]){
      if(runtime.get(child.id)._layoutHidden)continue;
      place(child,r,o.type==='stack_panel'?{horizontal:o.orientation==='horizontal',used}:null);
      const cr=rects.get(child.id);if(cr)used+=o.orientation==='horizontal'?cr.w:cr.h;
    }
  }
  if(root)place(root,{x:0,y:0,w:width,h:height});
  const textLayouts=new Map();for(const n of relevant){const o=runtime.get(n.id),r=rects.get(n.id);if(r&&['label','button'].includes(o.type))textLayouts.set(n.id,layoutText(o,r.w,measureText||glyphAdvance));}
  return {runtime,rects,textLayouts,total:relevant.length,pruned:relevant.length-rects.size,issues};
}
