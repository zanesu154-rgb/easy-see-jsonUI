import {expression} from './expression.js';
export const ruleList=value=>Array.isArray(value)?value:value&&typeof value==='object'?[value]:[];
export function variableRules(obj){
 let rules=[...ruleList(obj.variables)];
 for(const mod of Array.isArray(obj.modifications)?obj.modifications:[]){
  if(mod?.array_name!=='variables')continue;
  const added=ruleList(mod.value);
  if(mod.operation==='insert_front')rules=[...added,...rules];
  else if(mod.operation==='insert_back')rules.push(...added);
 }
 return rules;
}
export function simulationVariables(sim={}){
 const pocket=sim.pocketScreen??sim.touch??false;
 return {'$container_title':sim.containerTitle??'普通箱子','$pocket_edition':sim.pocketEdition??pocket,'$pocket_screen':pocket,'$desktop_screen':!pocket,'$touch':sim.touch??pocket,'#title_text':sim.formTitle??'','#text':sim.formTitle??'',...sim.variables,...sim.bindings};
}
export function applyVariables(scope,obj,{conditional=false,trace=[],path=[]}={}){
 const result={...scope};
 const assign=(key,value)=>{if(conditional&&typeof value==='string'&&value.startsWith('$')&&Object.hasOwn(result,value))value=result[value];result[key]=value;};
 for(const [key,value]of Object.entries(obj||{}))if(key.startsWith('$')&&key.endsWith('|default')&&!Object.hasOwn(result,key.slice(0,-8)))assign(key.slice(0,-8),value);
 for(const [key,value]of Object.entries(obj||{}))if(key.startsWith('$')&&!key.endsWith('|default'))assign(key,value);
 if(conditional)for(const [index,rule]of ruleList(obj.variables).entries()){
  if(!rule||typeof rule!=='object')continue;
  const evaluated=rule.requires===undefined?{value:true}:typeof rule.requires==='boolean'?{value:rule.requires}:expression(String(rule.requires),result);
  trace.push({path:[...path,'variables',index],requires:rule.requires,...evaluated});
  if(evaluated.value&&!evaluated.error)for(const [key,value]of Object.entries(rule))if(key.startsWith('$'))assign(key.replace(/\|default$/,''),value);
 }
 return result;
}
