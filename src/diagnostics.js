import {diagnose} from './core.js';
import {isVanilla,textureResource} from './resources.js';

export function groupIssues(issues) {
  const groups=new Map();
  for(const issue of issues) {
    const key=(issue.category||'')+'::'+(issue.severity||'warning')+'::'+(issue.code==='bindings'?JSON.stringify(issue.path):issue.message);
    if(groups.has(key)){const group=groups.get(key);group.count++;if(issue.path)group.paths.push(issue.path);}
    else groups.set(key,{...issue,count:1,paths:issue.path?[issue.path]:[]});
  }
  return [...groups.values()];
}

export function sceneIssues({parsed,resolved,ns,runtime,files,file,rootName,layoutIssues=[]}) {
  if(parsed.error)return [{message:parsed.error,severity:'error',count:1,paths:[]}];
  if(parsed.data!==undefined&&(!parsed.data||typeof parsed.data!=='object'||Array.isArray(parsed.data)))return [{message:'JSON UI 顶层必须为对象。',severity:'error',count:1,paths:[]}];
  const data=rootName?{[rootName]:resolved.data[rootName]}:resolved.data;
  const resources=new Map();const issues=diagnose(data,[...files.keys()],{runtime:true}).filter(i=>!i.message.includes('继承引用尚未展开')&&!i.message.includes('贴图未在导入文件中找到')).filter(i=>!i.message.startsWith('尚未支持预览控件类型')||runtime.has(JSON.stringify(i.path))&&!runtime.get(JSON.stringify(i.path))._layoutHidden);
  for(const n of ns) {
    if(rootName&&n.path[0]!==rootName)continue;
    const o=runtime.get(n.id);if(!o||o._layoutHidden)continue;
    const errors=[...new Set((o._trace||[]).filter(t=>t.error).map(t=>t.error))];
    if(errors.length)issues.push({code:'bindings',path:n.path,severity:'info',message:n.name+'：'+errors.join('；')});
    if(o.texture) {
      if(!resources.has(o.texture))resources.set(o.texture,textureResource(files,file,o.texture));
      const resource=resources.get(o.texture);
      if(['missing','ambiguous'].includes(resource.status))issues.push({path:n.path,severity:'warning',message:o.texture+'：'+resource.message});
    }
  }
  issues.push(...resolved.issues.filter(i=>(!rootName||!i.path||i.path[0]===rootName)&&(i.severity==='error'||!i.path||runtime.has(JSON.stringify(i.path))&&!runtime.get(JSON.stringify(i.path))._layoutHidden)));
  const root=runtime.get(JSON.stringify([rootName])),container=root?.$screen_content&&root?.$container_title!==undefined||[...runtime.values()].some(obj=>obj._containerIndex!==undefined);
  const byId=new Map(ns.map(n=>[n.id,n]));
  const native=path=>{
    let node=byId.get(JSON.stringify(path));
    while(node){
      const source=node.obj._definitionFile||node.obj._templateFile||resolved.origins?.get(node.id)?.file;
      if(source)return isVanilla(source);
      node=node.parent;
    }
    return false;
  };
  return groupIssues([...issues,...layoutIssues].map(issue=>container&&issue.severity==='info'&&issue.path&&native(issue.path)?{...issue,category:'container-runtime'}:issue));
}
