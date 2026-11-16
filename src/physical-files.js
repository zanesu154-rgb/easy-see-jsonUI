import {parse,nodes} from './core.js';
import {cached} from './cache.js';
import {isVanilla} from './resources.js';
export function physicalFiles(files){return cached(files,'physical-ui-files',()=>[...files].flatMap(([file,bytes])=>{
 if(isVanilla(file)||!/\.json$/i.test(file)||file.includes('/textures/'))return [];
 const parsed=parse(new TextDecoder().decode(bytes));if(!/(^|\/)ui\//.test(file)&&!parsed.data?.namespace)return [];
 return [{file,namespace:parsed.data?.namespace||'',nodes:nodes(parsed.data).filter(n=>!n.parent),error:parsed.error}];
}));}
export function appendPhysicalFiles(container,files,project,groups,{current,showOriginal,open}){
 const shown=new Set([...project.entries,...project.custom||[]].map(s=>s.id)),unchanged=new Set(project.unchanged.map(s=>s.id));
 for(const record of physicalFiles(files)){
  const key=record.file+'::'+record.namespace;let body=groups.get(key)?.body;
  if(!body){const details=document.createElement('details'),summary=document.createElement('summary');details.open=record.file===current;summary.textContent=(record.namespace||'UI')+' · '+record.file;details.append(summary);body=document.createElement('div');details.append(body);container.append(details);}
  for(const node of record.nodes){const id=record.file+'::'+node.id;if(shown.has(id)||!showOriginal&&unchanged.has(id))continue;const button=document.createElement('button');button.className='tree-item';button.textContent='定义 · '+node.name;button.title=record.file;button.onclick=()=>open(record.file,node.id);body.append(button);}
  if(!record.nodes.length){const button=document.createElement('button');button.className='tree-item';button.textContent=record.error?'打开源码（解析失败）':'打开源码';button.onclick=()=>open(record.file,'');body.append(button);}
 }
}
