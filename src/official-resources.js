import {ResourceCache} from './resource-cache.js';
import {projectResourcePaths,resourcePath} from './resource-overrides.js';
import {VANILLA,isVanilla} from './resources.js';
import {parse} from './core.js';
import {officialIndex} from './official-index.js';

export const OFFICIAL_REF=officialIndex.ref;
export const officialCache=new ResourceCache(OFFICIAL_REF);
const ROOTS=[`https://raw.githubusercontent.com/Mojang/bedrock-samples/${OFFICIAL_REF}/resource_pack/`,`https://cdn.jsdelivr.net/gh/Mojang/bedrock-samples@${OFFICIAL_REF}/resource_pack/`];

async function download(path,fetcher,cache,stats) {
  try{const hit=await cache.get(path);if(hit){stats.cached++;return hit;}}catch{}
  let error;
  for(const root of ROOTS){
    try{
      const response=await fetcher(root+path,{signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw Error(response.status+' '+path);
      const bytes=new Uint8Array(await response.arrayBuffer());try{await cache.put(path,bytes);}catch{}stats.downloaded++;return bytes;
    }catch(e){error=e;}
  }
  throw error;
}

export async function loadOfficial(project,{fetcher=fetch,progress=()=>{},index=officialIndex,simulation={},extraTextures=[],fontPages=[],cache=officialCache}={}) {
  const available=new Set(index.paths),overridden=projectResourcePaths(project),skipped=new Set();
  const resources=new Map(),failed=[],queue=new Set(['ui/_global_variables.json','ui/ui_common.json','ui/ui_template_buttons.json','ui/server_form.json']);
  const addNamespace=ns=>{for(const path of available)if(path.startsWith('ui/')&&(path.endsWith('/'+ns+'.json')||path==='ui/ui_'+ns+'.json'))queue.add(path);};
  const addTexture=value=>{
    if(typeof value!=='string'||!/^textures\/[\w/.-]+$/.test(value))return;
    const image=/\.(png|jpe?g|json)$/i.test(value)?value:value+'.png';queue.add(image);
    if(/\.(png|jpe?g)$/i.test(image))queue.add(image.replace(/\.(png|jpe?g)$/i,'.json'));
  };
  function walk(value) {
    if(typeof value==='string') {
      for(const match of value.matchAll(/(?:@|^)([A-Za-z_][\w]*)\.[\w]+/g))addNamespace(match[1]);
      addTexture(value);
    } else if(value&&typeof value==='object')for(const [key,x]of Object.entries(value)){for(const match of key.matchAll(/@([\w]+)\./g))addNamespace(match[1]);walk(x);}
  }
  const inspect=bytes=>walk(parse(new TextDecoder().decode(bytes)).data);
  for(const [path,bytes]of project) {
    if(isVanilla(path)){if(path.endsWith('.json'))inspect(bytes);continue;}
    if(/\.json$/i.test(path)){if(resourcePath(path)?.startsWith('ui/'))queue.add(resourcePath(path));inspect(bytes);}
    else if(/\.[cm]?js$/i.test(path))for(const match of new TextDecoder().decode(bytes).matchAll(/['"`](textures\/[\w/.-]+)['"`]/g))addTexture(match[1]);
  }
  walk(simulation);extraTextures.forEach(addTexture);
  fontPages.filter(path=>/^font\/[\w.-]+\.png$/i.test(path)).forEach(path=>queue.add(path));
  const stats={cached:0,downloaded:0};
  const done=new Set();let attempted=0;
  while(true) {
    for(const path of queue)if((overridden.has(path)&&!path.startsWith('ui/'))||project.has(VANILLA+path)){done.add(path);skipped.add(path);}
    const batch=[...queue].filter(path=>!done.has(path)&&available.has(path)).slice(0,Math.min(4,160-attempted));
    if(!batch.length)break;
    attempted+=batch.length;
    await Promise.all(batch.map(async path=>{
      done.add(path);progress({done:done.size,pending:queue.size-done.size});
      try{const bytes=await download(path,fetcher,cache,stats);resources.set(VANILLA+path,bytes);if(path.endsWith('.json'))inspect(bytes);}catch(e){failed.push({path,error:e.message});}
    }));
  }
  return {...stats,resources,failed,skipped:[...skipped],ref:OFFICIAL_REF,limited:[...queue].some(path=>available.has(path)&&!done.has(path))};
}
