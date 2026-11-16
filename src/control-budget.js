import {nodes} from './core.js';
import {isVanilla} from './resources.js';
export function controlBudget(data,rootName,branches=[],{origins=new Map(),file=''}={}){
 const ns=nodes(data).filter(n=>!rootName||n.path[0]===rootName),ignored=new Set(),sources=new Map();
 const created=ns.filter(n=>{
  sources.set(n.id,n.obj._definitionFile||n.obj._templateFile||origins.get(n.id)?.file||sources.get(n.parent?.id)||file);
  if(n.obj.ignored===true||n.parent&&ignored.has(n.parent.id)){ignored.add(n.id);return false;}return true;
 });
 const count=list=>{const vanilla=list.filter(n=>isVanilla(sources.get(n.id)||'')).length;return {total:list.length,custom:list.length-vanilla,vanilla};};
 const total=count(created),counts=branches.map(branch=>{const part=count(created.filter(n=>branch.node.path.every((value,i)=>n.path[i]===value)));return {id:branch.id,label:branch.label,...part,count:part.total};});
 return {...total,severity:total.custom>3000?'danger':total.custom>1000?'warning':'normal',branches:counts};
}
