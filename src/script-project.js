import {parse} from './core.js';
import {stripFormatting} from './text.js';
const decode=bytes=>new TextDecoder().decode(bytes);
export function normalizeModule(path){const parts=[];for(const part of path.split('/')){if(part==='..'){if(!parts.length)throw Error('模块路径越界：'+path);parts.pop();}else if(part&&part!=='.')parts.push(part);}return parts.join('/');}
export function resolveModule(from,specifier,sources){
 if(specifier.startsWith('@minecraft/'))return specifier;
 if(!specifier.startsWith('.'))throw Error('不支持外部模块：'+specifier);
 const path=normalizeModule(from.slice(0,from.lastIndexOf('/')+1)+specifier);
 for(const candidate of [path,path+'.js',path+'/index.js'])if(Object.hasOwn(sources,candidate))return candidate;
 throw Error('未找到模块：'+specifier+'（来自 '+from+'）');
}
// Only manifest-declared entry points run. Merely browsing/importing a pack never executes it.
export function scriptProject(files){
 const packs=[],sources=Object.create(null),names=Object.create(null),packNames=new Map(),items=[];
 for(const [path,bytes] of files){
  if(/\.[cm]?js$/i.test(path))sources[path]=decode(bytes);
  if(/(?:^|\/)texts\/zh_CN\.lang$/i.test(path))for(const line of decode(bytes).split(/\r?\n/)){const index=line.indexOf('=');if(index>0){const key=line.slice(0,index).trim(),value=stripFormatting(line.slice(index+1).split('##')[0].trim()),root=path.slice(0,path.lastIndexOf('texts/'));names[key]=value;if(!packNames.has(root))packNames.set(root,Object.create(null));packNames.get(root)[key]=value;}}
 }
 for(const [path,bytes] of files){
  if(/(?:^|\/)manifest.json$/i.test(path)){const manifest=parse(decode(bytes)).data,root=path.slice(0,-'manifest.json'.length);for(const mod of manifest?.modules||[])if(mod.type==='script'&&typeof mod.entry==='string'){
   const entry=normalizeModule(root+mod.entry);packs.push({id:entry,entry,root,name:packNames.get(root)?.[manifest.header?.name]||(manifest.header?.name&&!/[.]name$/.test(manifest.header.name)?manifest.header.name:root.replace(/\/$/,''))||'行为包',missing:!Object.hasOwn(sources,entry)});
  }}
  if(/(?:^|\/)items\/.*\.json$/i.test(path)){const item=parse(decode(bytes)).data?.['minecraft:item'];if(item?.description?.identifier){const id=item.description.identifier,value=item.components?.['minecraft:display_name']?.value;items.push({id,name:names[value]||stripFormatting(value||'')||names['item.'+id+'.name']||names['item.'+id]||id});}}
 }
 return {packs,sources,items};
}
// Conservative candidates: item definitions referenced by reachable scripts. Actual events come from subscriptions.
export function actionCandidates(project,loaded,events){
 const result=[];
 for(const event of events){
  if(['itemUse','itemCompleteUse','itemReleaseUse'].includes(event.name)){
   const code=loaded.map(file=>project.sources[file]||'').filter(source=>source.includes('\"'+event.name+'\"')||source.includes("'"+event.name+"'")||source.includes('.'+event.name)).join('\n');
   const candidates=[...project.items],known=new Set(candidates.map(item=>item.id));
   for(const match of code.matchAll(/(?:typeId\s*(?:===|!==|==|!=)\s*|case\s+)(["'])([a-z0-9_.-]+:[a-z0-9_./-]+)\1/g)){if(!known.has(match[2])){known.add(match[2]);candidates.push({id:match[2],name:match[2]});}}
   for(const match of code.matchAll(/\bconst\s+(\w+)\s*=\s*(["'])([a-z0-9_.-]+:[a-z0-9_./-]+)\2/g)){if(!known.has(match[3])&&new RegExp('typeId\\s*(?:===|!==|==|!=)\\s*'+match[1]+'\\b').test(code)){known.add(match[3]);candidates.push({id:match[3],name:match[3]});}}
   for(const item of candidates)if(code.includes('"'+item.id+'"')||code.includes("'"+item.id+"'"))result.push({event:event.name,item:item.id,label:(event.name==='itemUse'?'右键 ':event.name==='itemReleaseUse'?'松开 ':'完成使用 ')+item.name,approximate:true});
  }else if(event.name==='playerDimensionChange')for(const dimension of ['overworld','nether','the_end'])result.push({event:event.name,dimension,label:'进入 '+dimension});
  else if(['playerSpawn','playerJoin','scriptEventReceive'].includes(event.name))result.push({event:event.name,phase:event.name==='scriptEventReceive'?event.phase:undefined,label:({playerSpawn:'玩家出生',playerJoin:'玩家加入',scriptEventReceive:'发送脚本事件'})[event.name]});
 }
 return result.filter((value,index,list)=>list.findIndex(other=>other.event===value.event&&other.item===value.item&&other.dimension===value.dimension&&other.phase===value.phase)===index);
}
