import {buttonControlVisible} from './button-states.js';

export function intersectRect(a,b){
  if(!a)return b;if(!b)return a;
  const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y);
  return {x,y,w:Math.max(0,Math.min(a.x+a.w,b.x+b.w)-x),h:Math.max(0,Math.min(a.y+a.h,b.y+b.h)-y)};
}

// Keep the logical hierarchy while painting all controls in one CSS stacking context.
export function presentScene(ns,scene,states=new Map()){
  const output=new Map();
  for(const n of ns){
    const rect=scene.rects.get(n.id),obj=scene.runtime.get(n.id);if(!rect||!obj)continue;
    const parent=n.parent&&output.get(n.parent.id),parentObj=n.parent&&scene.runtime.get(n.parent.id);
    let visible=parent?.visible??true;
    if(parentObj?.type==='button')visible=visible&&buttonControlVisible(parentObj,n.name,states.get(n.parent.id)||'default');
    const ownLayer=Number(obj.layer),ownAlpha=typeof obj.alpha==='number'&&Number.isFinite(obj.alpha)?Math.max(0,Math.min(1,obj.alpha)):1;
    const clip=intersectRect(parent?.clip,parentObj?.clips_children===true?scene.rects.get(n.parent.id):null);
    output.set(n.id,{
      rect,visible,clip,
      layer:(parent?.layer||0)+(Number.isFinite(ownLayer)?ownLayer:0),
      opacity:(parent?.opacity??1)*ownAlpha,
      color:Array.isArray(obj.color)?obj.color:parent?.color
    });
  }
  return output;
}

export function clipInsets(rect,clip){
  if(!clip)return 'none';
  if(clip.w<=0||clip.h<=0)return 'inset(100%)';
  return `inset(${clip.y-rect.y}px ${rect.x+rect.w-clip.x-clip.w}px ${rect.y+rect.h-clip.y-clip.h}px ${clip.x-rect.x}px)`;
}

export function pointInRect(rect,x,y){
  return rect.width>0&&rect.height>0&&x>=rect.left&&x<rect.right&&y>=rect.top&&y<rect.bottom;
}
