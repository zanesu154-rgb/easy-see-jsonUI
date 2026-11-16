import {validateSimulation} from './presets.js';
export class StateSampleControls {
 sessions=new Map();key='';groups=[];simulation={};
 constructor(container,{onApply,onError,getDraft=()=>undefined}){this.container=container;this.onApply=onApply;this.onError=onError;this.getDraft=getDraft;}
 clear(){this.sessions.clear();}
 manual(){this.sessions.delete(this.key);}
 apply(recipe){
  try{
   const value=validateSimulation(recipe.make(this.simulation,this.sessions.get(this.key)?.original));
   if(!this.sessions.has(this.key)){this.sessions.set(this.key,{original:structuredClone(this.simulation),draft:this.getDraft()});}
   const session=this.sessions.get(this.key);session.label=recipe.label;session.recipe=recipe.id;session.applied=JSON.stringify(value);
   this.onApply(value,{sample:true});
  }catch(error){this.onError(error.message);}
 }
 first(){const recipe=this.groups[0]?.recipes[0];if(recipe)this.apply(recipe);}
 restore(){
  const session=this.sessions.get(this.key);if(!session)return;this.sessions.delete(this.key);
  this.onApply(structuredClone(session.original),{sample:true,restoreDraft:session.draft});
 }
 render(key,groups,simulation,{hidden=false}={}){
  const same=this.key===key,oldGroup=same?this.container.querySelector('#sampleGroup')?.value:'',oldRecipe=same?this.container.querySelector('#sampleState')?.value:'';
  this.key=key;this.groups=groups;this.simulation=simulation;this.exampleHidden=false;this.container.replaceChildren();this.container.hidden=hidden||!groups.length;if(this.container.hidden)return;
  const row=document.createElement('div');row.className='sample-controls';this.container.append(row);
  const heading=document.createElement('strong');heading.textContent='包内状态示例';row.append(heading);
  const group=document.createElement('select');group.id='sampleGroup';group.setAttribute('aria-label','示例状态类别');
  for(const item of groups){const option=document.createElement('option');option.value=item.id;option.textContent=item.label;group.append(option);}if(groups.some(item=>item.id===oldGroup))group.value=oldGroup;row.append(group);
  const select=document.createElement('select');select.id='sampleState';select.setAttribute('aria-label','包内示例状态');row.append(select);
  const apply=document.createElement('button');apply.id='applyStateSample';apply.textContent='一键预览示例';row.append(apply);
  const restore=document.createElement('button');restore.id='restoreStateSample';restore.textContent='恢复此前数据';restore.disabled=!this.sessions.has(key);restore.onclick=()=>this.restore();row.append(restore);
  const quick=document.createElement('div');quick.id='sampleQuick';this.container.append(quick);
  const state=document.createElement('small');state.id='sampleMode';const session=this.sessions.get(key);const active=session?.applied===JSON.stringify(simulation);state.textContent=active?'示例模式：'+session.label+' · 不代表游戏存档状态，可恢复此前数据。':session?'当前模拟数据已变化，可重新预览示例或恢复此前数据。':'依据包内绑定与已有贴图生成示例，不执行游戏脚本，不改动命名预设。';state.dataset.active=String(active);this.exampleHidden=Boolean(active&&session.recipe.endsWith(':hidden'));this.container.append(state);
  const source=document.createElement('small');source.id='sampleSource';this.container.append(source);
  const current=()=>groups.find(item=>item.id===group.value)?.recipes.find(recipe=>recipe.id===select.value);
  const populate=()=>{
   const recipes=groups.find(item=>item.id===group.value).recipes;select.replaceChildren();
   for(const recipe of recipes){const option=document.createElement('option');option.value=recipe.id;option.textContent=recipe.label;select.append(option);}
   const preferred=session?.recipe||oldRecipe;if(recipes.some(recipe=>recipe.id===preferred))select.value=preferred;
   quick.replaceChildren();if(recipes.length>1)for(const recipe of recipes.slice(0,5)){const button=document.createElement('button');button.textContent=recipe.label;button.onclick=()=>{select.value=recipe.id;this.apply(recipe);};quick.append(button);}
   source.textContent=current()?.source?'来源：'+current().source:'';
  };
  group.onchange=populate;select.onchange=()=>{const recipe=current();if(recipe)this.apply(recipe);};apply.onclick=()=>{const recipe=current();if(recipe)this.apply(recipe);};populate();
 }
}
