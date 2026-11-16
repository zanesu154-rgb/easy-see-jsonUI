import {sameDefinition} from './baseline.js';
import {isVanilla} from './resources.js';
import {cached} from './cache.js';
import {parse} from './core.js';
import {applyVariables,variableRules,simulationVariables} from './conditional-variables.js';
const decode=bytes=>new TextDecoder().decode(bytes);
const pack=path=>path.includes('/ui/')?path.slice(0,path.indexOf('/ui/')):'';
const unique=list=>list.filter((v,i)=>list.findIndex(x=>sameDefinition(x.obj,v.obj))===i);
function dereference(value,vars,seen=new Set(),deep=true){
 if(typeof value==='string'&&value.startsWith('$')&&Object.hasOwn(vars,value)){
  if(seen.has(value))throw Error('变量循环：'+value);
  return dereference(vars[value],vars,new Set([...seen,value]),deep);
 }
 if(deep&&Array.isArray(value))return value.map(v=>dereference(v,vars,seen));
 if(deep&&value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,dereference(v,vars,seen)]));
 return value;
}
function documents(files){return cached(files,'index',()=>{
 const docs=new Map(),index=new Map();
 for(const [file,bytes]of files){
  if(!/\.json$/i.test(file)||file.includes('/textures/'))continue;
  const data=parse(decode(bytes)).data;if(!data?.namespace)continue;docs.set(file,data);
  for(const [name,obj]of Object.entries(data))if(obj&&typeof obj==='object'&&!Array.isArray(obj)&&!name.startsWith('$')){
   const key=data.namespace+'.'+name.split('@')[0],list=index.get(key)||[];list.push({file,name,obj,namespace:data.namespace});index.set(key,list);
  }
 }
 return {docs,index};
});}
export function resolveProject(files,file,options){
 if(options?.conditional){const cache=cached(files,'context-templates',()=>new Map()),key=JSON.stringify([file,options.rootName,options.context]);if(!cache.has(key)){if(cache.size>=24)cache.delete(cache.keys().next().value);cache.set(key,build(files,file,options));}return cache.get(key);}
 if(options?.rootName)return cached(files,'resolved-root:'+file+'::'+options.rootName,()=>build(files,file,options));
 return cached(files,'resolved:'+file,()=>build(files,file));
}
export function resolveScene(files,file,simulation={},rootName){
 const raw=documents(files).docs.get(file),root=raw?.[rootName];
 if(!root||!variableRules(root).some(rule=>Object.hasOwn(rule,'$screen_content')))return resolveProject(files,file);
 const context=simulationVariables(simulation),signature=JSON.stringify([file,rootName,context]);
 const cache=cached(files,'conditional-scenes',()=>new Map());
 if(!cache.has(signature)){
  if(cache.size>=12)cache.delete(cache.keys().next().value);
  cache.set(signature,build(files,file,{rootName,context,conditional:true}));
 }
 return cache.get(signature);
}
function build(files,file,{rootName,context={},conditional=false}={}){
 const {docs,index}=documents(files),source=docs.get(file)||parse(decode(files.get(file)||new Uint8Array())).data;
 const issues=[],origins=new Map(),variableTrace=[];let expanded=0;
 function merge(base,obj){
  if(!conditional)return {...base,...obj};
  return {...base,...obj,variables:variableRules({...obj,variables:[...(Array.isArray(base.variables)?base.variables:[]),...(Array.isArray(obj.variables)?obj.variables:obj.variables?[obj.variables]:[])]})};
 }
 function flatten(name,obj,ns,scope,chain,path,originFile){
  const vars=applyVariables(scope,obj);let base={raw:{},namespace:ns,file:originFile},ref=name.split('@')[1];
  if(conditional&&!ref&&path.length===1&&originFile===file&&!isVanilla(file)){
   const original=unique((index.get(ns+'.'+name)||[]).filter(v=>isVanilla(v.file)));
   if(original.length===1){const target=original[0];base=flatten(target.name,target.obj,target.namespace,vars,[ns+'.'+name],path,target.file);}
   else if(variableRules(obj).some(rule=>rule.$screen_content))base.raw={type:'screen',size:['100%','100%'],'$screen_content|default':ns+'.small_chest_panel',controls:[{'screen_content@$screen_content':{}}]};
  }
  if(ref){
   try{ref=ref.replace(/\$[\w]+/g,key=>dereference(key,vars));}catch(error){issues.push({message:error.message,severity:'error',path});ref='';}
   if(ref.includes('$'))issues.push({message:'继承变量未赋值：'+ref,severity:'info',path});
   else if(ref){
    const key=ref.includes('.')?ref:ns+'.'+ref,variants=index.get(key)||[],local=unique(variants.filter(v=>pack(v.file)===pack(originFile))),custom=unique(variants.filter(v=>!isVanilla(v.file))),vanilla=unique(variants.filter(v=>isVanilla(v.file)));
    const target=local.length===1?local[0]:custom.length===1?custom[0]:custom.length===0&&vanilla.length===1?vanilla[0]:undefined;
    if(chain.includes(key))issues.push({message:'循环继承：'+[...chain,key].join(' → '),severity:'error',path});
    else if(!target)issues.push({message:variants.length?'引用存在多个不同来源：'+key:'未找到继承定义：'+key+'（可能需要导入原版资源）',severity:'warning',path});
    else base=flatten(target.name,target.obj,target.namespace,vars,[...chain,key],path,target.file);
   }
  }
  return {raw:merge(base.raw,obj),namespace:Object.hasOwn(obj,'controls')?ns:base.namespace,file:Object.hasOwn(obj,'controls')?originFile:base.file};
 }
 function expand(name,obj,ns,scope,path,originFile,depth=0){
  if(!obj||typeof obj!=='object'||Array.isArray(obj))return obj;
  if(depth>64||++expanded>30000){issues.push({message:depth>64?'控件嵌套超过 64 层':'预览展开达到 30000 个控件上限',severity:'error',path});return {};}
  const flat=flatten(name,obj,ns,scope,[],path,originFile),vars=applyVariables(scope,flat.raw,{conditional,trace:variableTrace,path}),result={};
  const value=v=>{try{return dereference(v,vars);}catch(error){issues.push({message:error.message,severity:'error',path});return v;}};
  for(const [key,v]of Object.entries(flat.raw))if(key!=='controls')result[key]=value(v);
  if(conditional)for(const [key,v]of Object.entries(vars))if(key.startsWith('$'))result[key]=value(v);
  let controls=flat.raw.controls;
  try{controls=dereference(controls,vars,new Set(),false);}catch(error){issues.push({message:error.message,severity:'error',path});}
  if(conditional&&result.ignored===true)controls=[];
  if(Array.isArray(controls))result.controls=controls.map((entry,i)=>entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.fromEntries(Object.entries(entry).map(([key,v])=>[key,expand(key,v,flat.namespace,vars,[...path,'controls',i,key],flat.file,depth+1)])):entry);
  else if(Object.hasOwn(flat.raw,'controls'))result.controls=controls;
  origins.set(JSON.stringify(path),{file:originFile,template:name.split('@')[1]});return result;
 }
 const data=rootName?{namespace:source?.namespace}:{...source};
 for(const [name,obj]of Object.entries(source||{}))if((!rootName||name===rootName)&&obj&&typeof obj==='object'&&!Array.isArray(obj)&&!name.startsWith('$'))data[name]=expand(name,obj,source.namespace||'',applyVariables(context,source),[name],file);
 return {data,issues,origins,variableTrace};
}
