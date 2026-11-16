import {nodeContains} from './navigation.js';
export function interfaceTree(container,model,{file,selected,ns,openScreen,openRoute,selectControl}){
  for(const [category,screens]of model.groups){
    const group=document.createElement('details');group.open=true;const summary=document.createElement('summary');summary.textContent=category;group.append(summary);
    for(const screen of screens){
      const row=document.createElement('button');row.className='tree-item';row.dataset.screen=screen.id;
      row.textContent=(screen.namespace==='hud'?'hud · ':'')+screen.node.name;row.title=screen.file;row.onclick=()=>openScreen(screen);group.append(row);
      const routes=model.routes.filter(r=>r.screen.id===screen.id);
      for(const route of routes){
        const button=document.createElement('button');button.className='tree-item route';button.dataset.route=route.id;button.textContent=route.label;button.title=screen.file+'\n'+route.expression;button.onclick=()=>openRoute(route);group.append(button);
      }
      if(file===screen.file&&selected&&selected.path[0]===screen.node.path[0]){
        row.classList.add('active');const details=document.createElement('details'),heading=document.createElement('summary');heading.textContent='控件层级';details.open=selected.path.length>1;details.append(heading);
        const children=new Map();for(const node of ns){if(node.parent){const list=children.get(node.parent.id)||[];list.push(node);children.set(node.parent.id,list);}}
        const branch=(node,parent)=>{
          const kids=children.get(node.id)||[],line=document.createElement('button');line.className='tree-item'+(node.id===selected.id?' active':'');line.dataset.node=node.id;line.dataset.file=file;line.textContent=node.name;line.title=node.path.join(' › ');line.onclick=()=>selectControl(node);
          if(!kids.length){parent.append(line);return;}
          const folder=document.createElement('details'),label=document.createElement('summary');label.append(line);folder.append(label);folder.open=nodeContains(node,selected);
          let filled=false;const fill=()=>{if(filled||!folder.open)return;filled=true;kids.forEach(child=>branch(child,folder));};folder.ontoggle=fill;fill();parent.append(folder);
        };
        const root=ns.find(n=>!n.parent&&n.path[0]===selected.path[0]);if(root)branch(root,details);group.append(details);
      }
    }
    container.append(group);
  }
}
