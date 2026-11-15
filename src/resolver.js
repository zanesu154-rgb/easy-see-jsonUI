import {cached} from './cache.js';
import {parse} from './core.js';
export function resolveProject(files,file){return cached(files,'resolved:'+file,()=>build(files,file))}
function build(files,file){
 const {docs,index,issues:baseIssues}=cached(files,'index',()=>{const docs=new Map(),index=new Map(),issues=[];
 for(const [p,b] of files){if(!/\.json$/i.test(p))continue;const d=parse(new TextDecoder().decode(b)).data;if(!d||typeof d!=='object'||!d.namespace)continue;docs.set(p,d);for(const [name,obj] of Object.entries(d))if(obj&&typeof obj==='object'&&!Array.isArray(obj)&&!name.startsWith('$')){const key=d.namespace+'.'+name.split('@')[0];if(index.has(key))issues.push({message:'重复控件定义：'+key,severity:'warning'});index.set(key,{file:p,name,obj,namespace:d.namespace});}}
 return {docs,index,issues};});const issues=[...baseIssues];
 const source=docs.get(file)||parse(new TextDecoder().decode(files.get(file)||new Uint8Array())).data;const origins=new Map();
 function expand(name,obj,namespace,scope,chain,path,originFile){
  let base={},baseOrigin;const ref=name.split('@')[1];
  if(ref){const key=ref.includes('.')?ref:namespace+'.'+ref;const target=index.get(key);if(chain.includes(key))issues.push({message:'循环继承：'+[...chain,key].join(' → '),severity:'error',path});else if(!target)issues.push({message:'未找到继承定义：'+key+'（可能需要导入原版资源）',severity:'warning',path});else{base=expand(target.name,target.obj,target.namespace,scope,[...chain,key],path,target.file);baseOrigin=target;}}
  const merged={...base,...obj};const vars={...scope};for(const [k,v] of Object.entries(merged))if(k.startsWith('$'))vars[k.replace(/\|default$/,'')]=v;
  function value(v,seen=[]){if(typeof v==='string'&&v.startsWith('$')&&Object.hasOwn(vars,v)){if(seen.includes(v)){issues.push({message:'变量循环：'+v,severity:'warning',path});return v}return value(vars[v],[...seen,v])}if(Array.isArray(v))return v.map(x=>value(x,seen));return v;}
  const result={};for(const [k,v] of Object.entries(merged))if(k!=='controls')result[k]=value(v);
  const controls=Object.hasOwn(obj,'controls')?obj.controls:base.controls;
  if(Array.isArray(controls))result.controls=controls.map((entry,i)=>Object.fromEntries(Object.entries(entry).map(([k,v])=>[k,expand(k,v,namespace,vars,chain,[...path,'controls',i,k],Object.hasOwn(obj,'controls')?originFile:baseOrigin?.file||originFile)])));
  if(!origins.has(JSON.stringify(path))||originFile===file)origins.set(JSON.stringify(path),{file:originFile,template:baseOrigin?.name});return result;
 }
 const data={...source};if(source)for(const [name,obj]of Object.entries(source))if(obj&&typeof obj==='object'&&!Array.isArray(obj)&&name!=='namespace'&&!name.startsWith('$'))data[name]=expand(name,obj,source.namespace||'',{},[],[name],file);
 return {data,issues,origins};
}
