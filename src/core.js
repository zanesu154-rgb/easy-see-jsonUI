import {parseTree} from '../vendor/jsonc-parser/main.js';
// Parse JSONC while preserving character offsets for useful diagnostics.
export function parse(text){let s=text.replace(/^\uFEFF/,' ');s=s.replace(/"(?:\\.|[^"\\])*"|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g,m=>m.startsWith('/')?m.replace(/[^\r\n]/g,' '):m);s=s.replace(/"(?:\\.|[^"\\])*"|,(\s*[}\]])/g,(m,end)=>end?' '+end:m);try{return {data:JSON.parse(s)}}catch(e){const errors=[];parseTree(text.replace(/^\uFEFF/,' '),errors,{allowTrailingComma:true});const pos=errors[0]?.offset??Number(/position (\d+)/.exec(e.message)?.[1]||0);const before=text.slice(0,pos).split('\n');return {error:`第 ${before.length} 行，第 ${before.at(-1).length+1} 列：${e.message}`}}}
export function nodes(data){const out=[];function visit(obj,path,parent,name){if(!obj||typeof obj!=='object'||Array.isArray(obj))return;const n={obj,path,parent,name,id:JSON.stringify(path)};out.push(n);if(Array.isArray(obj.controls))obj.controls.forEach((entry,i)=>{if(entry&&typeof entry==='object'&&!Array.isArray(entry))Object.entries(entry).forEach(([k,v])=>visit(v,[...path,'controls',i,k],n,k))});}if(data&&typeof data==='object')Object.entries(data).forEach(([k,v])=>{if(k!=='namespace'&&!k.startsWith('$')&&v&&typeof v==='object'&&!Array.isArray(v))visit(v,[k],null,k)});return out;}
export function at(data,path){return path.reduce((v,k)=>v?.[k],data)}
export function dimension(v,parent,fallback=0){
  if(typeof v==='number')return Number.isFinite(v)?v:fallback;
  if(typeof v==='string'){
    const m=/^(-?[\d.]+)%(?:\s*([+-])\s*([\d.]+)(?:px)?)?$/.exec(v.trim());
    if(m){const value=parent*Number(m[1])/100+(m[2]==='-'?-1:1)*Number(m[3]||0);return Number.isFinite(value)?value:fallback;}
    if(/^-?[\d.]+(?:px)?$/.test(v)){const value=parseFloat(v);return Number.isFinite(value)?value:fallback;}
  }
  return fallback;
}

export function diagnose(data,paths=[],options={}){
  const issues=[],record=v=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
  for(const n of nodes(data)){
    const o=n.obj;
    const add=(message,severity='warning',path=n.path)=>issues.push({message,severity,path});
    if(n.name.includes('@'))add('继承引用尚未展开，预览仅显示当前覆盖值。','info');
    if(o.bindings&&!options.runtime)add('动态绑定需要游戏数据，当前显示静态值。','info');
    if(o.type&&!['panel','label','image','button','screen','stack_panel','collection_panel','grid'].includes(o.type))add(`尚未支持预览控件类型 ${o.type}。`,'info');
    for(const key of ['size','offset'])if(o[key]!==undefined&&!(typeof o[key]==='string'&&(o[key].startsWith('$')||key==='offset'&&o[key].startsWith('@')))&&(!Array.isArray(o[key])||o[key].length!==2))add(`${key} 应为包含两个值的数组。`,'error');
    if(typeof o.offset==='string'&&o.offset.startsWith('@'))add('动画偏移暂按静态位置预览：'+o.offset,'info');
    if(o.controls!==undefined&&!Array.isArray(o.controls)){if(typeof o.controls==='string'&&o.controls.startsWith('$'))add('未解析控件数组变量：'+o.controls,'info');else add('controls 必须为数组。','error');}
    if(Array.isArray(o.controls))o.controls.forEach((entry,index)=>{
      const path=[...n.path,'controls',index];
      if(!record(entry))add('controls 中的每一项必须为控件对象。','error',path);
      else for(const [name,value]of Object.entries(entry))if(!record(value))add('控件定义必须为对象：'+name,'error',[...path,name]);
    });
    if(o.bindings!==undefined&&!(typeof o.bindings==='string'&&o.bindings.startsWith('$'))&&!Array.isArray(o.bindings))add('bindings 必须为数组。','error');
    if(Array.isArray(o.bindings))o.bindings.forEach((binding,index)=>{if(!record(binding))add('bindings 中的每一项必须为对象。','error',[...n.path,'bindings',index]);});
    if(o.modifications!==undefined&&!Array.isArray(o.modifications))add('modifications 必须为数组。','error');
    if(o.texture&&typeof o.texture==='string'&&!o.texture.startsWith('$')&&!paths.some(p=>p.endsWith(o.texture)||p.endsWith(o.texture+'.png')))add(`贴图未在导入文件中找到：${o.texture}，可能需要原版资源。`);
  }
  return issues;
}
