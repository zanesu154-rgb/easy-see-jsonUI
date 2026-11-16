// Keep native runtime limitations inspectable without drowning actionable issues.
export function renderIssues(container,issues,onSelect){
 container.replaceChildren();
 if(!issues.length){container.textContent='✓ 未发现已知问题；实际游戏效果仍需在基岩版验证。';return;}
 const native=issues.filter(issue=>issue.category==='container-runtime');
 const append=(holder,issue)=>{
  const el=document.createElement('button');
  el.textContent=(issue.severity==='error'?'● ':'○ ')+issue.message+(issue.count>1?'（'+issue.count+' 处）':'');
  el.className='issue '+issue.severity;el.title=issue.paths?.map(path=>path.join('/')).join('\n')||'';
  el.onclick=()=>onSelect(issue);holder.append(el);
 };
 for(const issue of issues)if(issue.category!=='container-runtime')append(container,issue);
 if(native.length){
  const details=document.createElement('details');details.id='containerRuntimeIssues';
  const summary=document.createElement('summary');summary.textContent=`原版容器运行时提示（${native.length} 类 / ${native.reduce((sum,issue)=>sum+issue.count,0)} 项，点击展开）`;
  details.append(summary);for(const issue of native)append(details,issue);container.append(details);
 }
}
