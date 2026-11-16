import {nodes} from './core.js';
import {runtimeObject} from './bindings.js';
import {nameRules} from './name-rules.js';
import {resolveProject} from './resolver.js';
import {cached} from './cache.js';
import {isVanilla} from './resources.js';

export const nodeContains=(parent,child)=>parent.path.every((part,i)=>child.path[i]===part);
export const titleSample=form=>form.fields.find(f=>f.kind==='title')?.parts?.map(p=>p??'示例').join('')||form.title;
export function interfaceCategory(screen){
  const name=screen.namespace+' '+screen.node.name+' '+screen.file;
  if(screen.namespace==='hud'||screen.insertions?.some(i=>/hud/.test(i.root)))return 'HUD';
  if(screen.namespace==='server_form')return '表单（server_form）';
  if(/chat/.test(name))return '聊天';
  if(/chest|container|inventory/.test(name))return '容器与物品栏';
  return screen.namespace||'其他界面';
}

function evaluated(node,title){
  const chain=[];for(let n=node;n;n=n.parent)chain.unshift(n);
  let context={},visible=true,last;
  for(const n of chain){last=runtimeObject(n.obj,null,{formTitle:title},context);context=last._context;visible=visible&&last.visible!==false&&last.ignored!==true;}
  return {visible,last};
}
export const routeMatches=(route,title)=>{if(title===undefined)return false;const result=evaluated(route.node,title);return result.visible&&result.last.visible===true;};

const models=new WeakMap();
export function navigationModel(files,project){
  if(models.has(project))return models.get(project);
  const screens=[...(project.custom||[]),...project.entries],definitions=[...screens,...project.templates,...(project.unchanged||[])],groups=new Map(),routes=[];
  for(const screen of screens){
    const category=interfaceCategory(screen);if(!groups.has(category))groups.set(category,[]);groups.get(category).push(screen);
    if(screen.namespace!=='server_form')continue;
    for(const node of nodes({[screen.node.name]:screen.node.obj})){
      if(!node.parent)continue;
      // Routing belongs to this control's own visibility, never a descendant's.
      const visibleBindings=(Array.isArray(node.obj.bindings)?node.obj.bindings:[]).filter(b=>b?.target_property_name==='#visible');
      const aliases=new Map(),ancestors=[];
      for(let parent=node;parent;parent=parent.parent)ancestors.unshift(parent);
      for(const parent of ancestors)for(const binding of Array.isArray(parent.obj.bindings)?parent.obj.bindings:[]){
        if(binding?.binding_name_override&&binding.binding_name)aliases.set(binding.binding_name_override,binding.binding_name);
      }
      const canonical=expression=>typeof expression==='string'?expression.replace(/#[\w]+/g,key=>{const seen=new Set();while(aliases.has(key)&&!seen.has(key)){seen.add(key);key=aliases.get(key);}return key;}):expression;
      const own={...Object.fromEntries(Object.entries(node.obj).filter(([key])=>key.startsWith('$'))),bindings:visibleBindings.map(b=>({...b,source_property_name:canonical(b.source_property_name)})),visible:node.obj.visible};
      const rules=nameRules(own).filter(rule=>rule.fields.some(f=>/title|^#text$|^#name$/i.test(f))&&!/^%/.test(rule.name));
      const expressions=visibleBindings.map(b=>b.source_property_name||'');
      const titleBased=own.bindings.some(b=>/#(?:[\w]*title[\w]*|text|name)\b/i.test(b.source_property_name||''))||rules.length>0;
      if(!titleBased||!expressions.length)continue;
      // Skip conditions inside a branch already governed by a title rule.
      if(routes.some(r=>r.screen.id===screen.id&&nodeContains(r.node,node)))continue;
      const names=[...new Set(rules.map(r=>r.name))];
      const accepts=title=>{const result=evaluated(node,title);return result.visible&&result.last.visible===true;};
      const positive=names.find(accepts);
      const fallback=positive===undefined&&accepts('普通表单');
      const sample=positive??(fallback?'普通表单':undefined);
      const links=project.forms.filter(form=>accepts(titleSample(form)));
      const reference=node.name.split('@')[1],matches=reference?definitions.filter(d=>d.namespace+'.'+d.node.name.split('@')[0]===reference):[];
      const origin=resolveProject(files,screen.file).origins.get(node.id)?.file;
      const definition=matches.find(d=>d.file===origin)||(matches.length===1?matches[0]:undefined);
      const contains=positive!==undefined&&accepts(positive+'示例');
      const route={id:screen.file+'::'+node.id,screen,node,definition,links,sample,kind:fallback?'fallback':positive!==undefined?(contains?'contains':'equals'):'complex',expression:expressions.join('；')};
      route.label=fallback?'其余 → 普通表单':sample!==undefined?`标题${contains?'含':'为'}「${sample}」 → ${node.name.split('@')[0]}`:'标题条件 → '+node.name.split('@')[0];
      routes.push(route);
    }
  }
  groups.clear();
  for(const screen of screens){
    const category=routes.some(route=>route.definition?.id===screen.id)?'表单（server_form）':interfaceCategory(screen);
    if(!groups.has(category))groups.set(category,[]);groups.get(category).push(screen);
  }
  const priority=category=>{const index=['HUD','表单（server_form）','容器与物品栏','聊天'].indexOf(category);return index<0?99:index;};
  const ordered=new Map([...groups].sort(([a],[b])=>priority(a)-priority(b)||a.localeCompare(b)));
  const result={groups:ordered,routes,screens};models.set(project,result);return result;
}

export function routeForTitle(model,title){return model.routes.find(r=>r.kind!=='fallback'&&routeMatches(r,title))||model.routes.find(r=>routeMatches(r,title));}
export function routeForSelection(model,file,node){
  if(!node)return;
  return model.routes.filter(r=>r.screen.file===file&&nodeContains(r.node,node)).sort((a,b)=>b.node.path.length-a.node.path.length)[0];
}

export function searchControls(files,query,{includeVanilla=false,limit=100,file,runtime=new Map(),sceneNodes=[]}={}){
  const index=cached(files,'navigation-search',()=>{
    const index=[];
    for(const [file]of files){
      if(!/\.json$/i.test(file)||!/(^|\/)ui\//.test(file)&&!resolveProject(files,file).data?.namespace)continue;
      for(const node of nodes(resolveProject(files,file).data)){
        const own=Object.fromEntries(Object.entries(node.obj).filter(([key])=>key!=='controls'));
        index.push({file,node,path:[file,...node.path.filter(p=>p!=='controls'&&typeof p!=='number')].join(' › '),terms:(node.name+' '+JSON.stringify(own)).toLowerCase()});
      }
    }
    return index;
  });
  const candidates=new Map(index.map(row=>[row.file+'::'+row.node.id,row]));
  for(const node of sceneNodes){
    const value=runtime.get(node.id);if(!file||!value)continue;
    const key=file+'::'+node.id,previous=candidates.get(key);
    const terms=(previous?.terms||node.name.toLowerCase())+' '+String(value.texture||'').toLowerCase()+' '+String(value.text||'').toLowerCase();
    candidates.set(key,{...(previous||{file,node,path:[file,...node.path.filter(p=>p!=='controls'&&typeof p!=='number')].join(' › ')}),terms});
  }
  const terms=query.toLowerCase().trim().split(/\s+/),all=[...candidates.values()].filter(row=>(includeVanilla||!isVanilla(row.file))&&terms.every(term=>row.terms.includes(term)||row.file.toLowerCase().includes(term)));
  return {total:all.length,results:all.slice(0,limit)};
}
