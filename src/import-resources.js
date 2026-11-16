import {parse} from './core.js';
import {isVanilla} from './resources.js';

const decode=bytes=>new TextDecoder().decode(bytes);
const uiRoot=path=>path.startsWith('ui/')?'':path.includes('/ui/')?path.slice(0,path.indexOf('/ui/')):null;
const join=(root,path)=>root?root+'/'+path:path;

// Infer locations only from a unique resource pack and exact texture references.
// Existing full pack paths and manifest-bearing dependency packs keep their paths.
export function mergeImport(project,incoming) {
  const combined=new Map([...project,...incoming]),roots=new Set(),references=new Set();
  function walk(value){
    if(typeof value==='string'&&/^textures\/[\w/.-]+$/.test(value))references.add(/\.(png|jpe?g)$/i.test(value)?value:value+'.png');
    else if(value&&typeof value==='object')for(const child of Object.values(value))walk(child);
  }
  for(const [path,bytes]of combined){
    if(isVanilla(path)||!/\.json$/i.test(path))continue;
    const doc=parse(decode(bytes)).data,root=uiRoot(path);
    if(typeof doc?.namespace!=='string')continue;
    if(root!==null)roots.add(root);
    walk(doc);
  }
  const root=roots.size===1?[...roots][0]:null;
  const hasManifest=[...incoming.keys()].some(path=>/(^|\/)manifest\.json$/i.test(path));
  const result=new Map(project),relocated=[],ambiguous=[];
  for(const [path,bytes]of incoming){
    let target=path;
    if(root!==null&&!hasManifest&&!isVanilla(path)){
      if(!path.includes('/')&&/\.json$/i.test(path)&&typeof parse(decode(bytes)).data?.namespace==='string')target=join(root,'ui/'+path);
      else if(/\.(png|jpe?g)$/i.test(path)&&!path.includes('/textures/')){
        const candidates=[...references].filter(ref=>ref===path||ref.endsWith('/'+path));
        if(candidates.length===1)target=join(root,candidates[0]);
        else if(candidates.length>1)ambiguous.push(path);
      }
    }
    if(target!==path)relocated.push({from:path,to:target});
    result.set(target,bytes);
  }
  return {files:result,relocated,ambiguous};
}
