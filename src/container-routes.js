import {parse,nodes} from './core.js';
import {variableRules} from './conditional-variables.js';
import {resolveScene} from './resolver.js';
import {isVanilla} from './resources.js';
export function containerRoutes(files){
 const roots=[];
 for(const [file,bytes]of files){
  if(isVanilla(file)||!/\.json$/i.test(file)||file.includes('/textures/'))continue;
  const data=parse(new TextDecoder().decode(bytes)).data;
  for(const node of nodes(data).filter(n=>!n.parent)){
   const rules=variableRules(node.obj);if(!rules.some(rule=>rule?.$screen_content))continue;
   const screen={file,node,namespace:data.namespace||'',id:file+'::'+node.id,triggers:[],links:[],insertions:[]};
   const titles=[...new Set(rules.flatMap(rule=>[...String(rule.requires||'').matchAll(/=\s*(['"])([^'"]*)\1/g)].map(match=>match[2])))];
   const samples=[{title:'普通箱子',label:'普通箱子'},...titles.map(title=>({title,label:'标题 = '+title}))];
   const branches=samples.map(({title,label})=>{
    const resolved=resolveScene(files,file,{containerTitle:title},node.name),obj=resolved.data[node.name],content=obj?.$screen_content;
    return {id:screen.id+'::container:'+title,kind:'container',screen,node,sample:title,label:label+(content?' → '+content:''),content,links:[],expression:rules.map(rule=>rule.requires).filter(Boolean).join('；')};
   });
   roots.push({screen,branches});
  }
 }
 return roots;
}
