import {nodes} from './core.js';
export function controlBudget(data,rootName,branches=[]){
 const ns=nodes(data).filter(n=>!rootName||n.path[0]===rootName),ignored=new Set();
 const created=ns.filter(n=>{if(n.obj.ignored===true||n.parent&&ignored.has(n.parent.id)){ignored.add(n.id);return false;}return true;});
 const counts=branches.map(branch=>({id:branch.id,label:branch.label,count:created.filter(n=>branch.node.path.every((part,i)=>n.path[i]===part)).length}));
 return {total:created.length,severity:created.length>3000?'danger':created.length>1000?'warning':'normal',branches:counts};
}
