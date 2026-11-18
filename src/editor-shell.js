const $=id=>document.getElementById(id);
const element=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const action=(text,handler,id)=>{const button=element('button',text);if(id)button.id=id;button.onclick=handler;return button;};
export function canvasTabShortcut(event,{dialogOpen=false}={}){
 if(event.key!=='Tab'||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey||event.defaultPrevented)return false;
 const target=event.target;
 return !dialogOpen&&!target?.closest?.('input,textarea,select,button,a,summary,dialog,[contenteditable="true"],[role="textbox"]');
}
// Layout changes move existing DOM nodes. They do not reload resources, restart
// scripts, replace input elements, or apply source/simulation drafts.
export class EditorShell{
 constructor({onMode,onInspect,onPlayer}){this.mode='view';this.zooms={view:'fit',edit:'fit'};this.scrolls={view:0,edit:0};this.onMode=onMode;this.onInspect=onInspect;this.onPlayer=onPlayer;this.right='properties';this.bottom=null;this.playerOpen=false;this.buildHeader();this.buildFooter();this.buildPanels();this.wire();this.layout();document.body.dataset.shellReady='true';}
 buildHeader(){
  const header=document.querySelector('header'),brand=header.querySelector('.brand'),project=$('project'),importButton=$('import'),exportButton=$('export');
  const old=Object.fromEntries([...header.querySelectorAll('button,label.file-button')].map(node=>[node.id||'vanillaZip',node]));
  brand.querySelector('span').textContent='JSON UI';const info=element('div',undefined,'project-heading');info.append(brand,project);
  this.modeButtons=element('div',undefined,'workspace-switch');this.modeButtons.setAttribute('role','group');this.modeButtons.setAttribute('aria-label','看或改');
  this.viewButton=action('看',()=>this.setMode('view'),'viewMode');this.editButton=action('改',()=>this.setMode('edit'),'editMode');this.viewButton.title=this.editButton.title='在画面上按 Tab 切换；输入框和菜单内保留焦点导航';this.modeButtons.append(this.viewButton,this.editButton);
  const actions=element('div',undefined,'project-actions');importButton.textContent='导入';exportButton.textContent='导出';this.playerButton=action('玩家状态',()=>this.togglePlayer(),'togglePlayer');this.playerButton.hidden=true;this.playerButton.setAttribute('aria-controls','playerPanel');
  this.menu=element('details');this.menu.id='projectMenu';const summary=element('summary','…');summary.setAttribute('aria-label','更多工具');const menuBody=element('div',undefined,'project-menu-body');this.menu.append(summary,menuBody);
  const group=(label,nodes)=>{menuBody.append(element('small',label));for(const node of nodes)if(node)menuBody.append(node);};
  group('工程',[old.dependency,old.demo,old.exportWorkspace,old.importSettings,old.exportSettings]);
  group('预览与高级',[action('原版资源、字体与缓存…',()=>this.resourceDialog.showModal(),'openResources'),action('高级 › 手写模拟数据',()=>this.openInspector('data',{manual:true}),'openManualSimulation')]);
  group('编辑',[old.undo,old.redo]);
  actions.append(this.playerButton,importButton,exportButton,this.menu);header.replaceChildren(info,this.modeButtons,actions);
  const resourceDialog=element('dialog');resourceDialog.id='resourceDialog';resourceDialog.setAttribute('aria-labelledby','resourceTitle');const title=element('h2','原版资源、字体与缓存');title.id='resourceTitle';resourceDialog.append(title,$('vanillaStatus'));
  const resources=element('div',undefined,'resource-actions');for(const id of ['vanilla','vanillaZip','vanillaFolder'])resources.append(old[id]);resourceDialog.append(resources);
  const fonts=element('div');fonts.id='fontTools';for(const id of ['importFont','resetFont','fontStatus'])fonts.append($(id));resourceDialog.append(fonts);
  const cache=[...document.querySelectorAll('.bottom>details')].find(node=>node.querySelector('summary')?.textContent==='字体与原版缓存');if(cache){cache.open=true;resourceDialog.append(cache);}
  resourceDialog.append(element('small','文件在本机处理 · 第五阶段看 / 改视图'),action('关闭',()=>resourceDialog.close(),'closeResources'));document.body.append(resourceDialog);this.resourceDialog=resourceDialog;resourceDialog.addEventListener('close',()=>this.menu.querySelector('summary').focus());
  document.querySelector('.sub').hidden=true;
 }
 buildPanels(){
  const browser=document.querySelector('.browser');this.editNavigation=element('div');this.editNavigation.id='editNavigation';this.editNavigation.append(browser.querySelector('.browser-tools'),$('searchResults'),$('tree'));
  this.viewNavigation=element('div');this.viewNavigation.id='viewNavigation';const top=element('div',undefined,'view-navigation-top');top.append(element('strong','界面'));this.overview=action('总览',()=>$('homeButton').click(),'viewOverview');top.append(this.overview);this.viewNavigation.append(top);
  this.viewScreens=element('div');this.viewScreens.id='viewScreens';this.viewScreens.setAttribute('aria-label','界面缩略图导航');this.viewNavigation.append(this.viewScreens);
  this.viewExamples=element('details');this.viewExamples.id='viewExamples';this.viewExamples.append(element('summary','预览数据'),$('stateSamples'));
  this.runtime=$('scriptRuntime');browser.replaceChildren(this.runtime,this.viewExamples,this.viewNavigation,this.editNavigation);
  const inspector=document.querySelector('.inspector');this.playerPanel=element('section');this.playerPanel.id='playerPanel';this.playerPanel.append(element('h3','玩家状态'));this.playerSummary=element('div');this.playerSummary.id='playerSummary';const summaryDetails=element('details');summaryDetails.append(element('summary','摘要'),this.playerSummary);this.playerPanel.append(summaryDetails);this.playerPanel.append(action('收起',()=>this.togglePlayer(false),'closePlayer'));
  this.editInspector=element('section');this.editInspector.id='editInspector';const tabs=element('div',undefined,'inspector-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','编辑工具');this.rightButtons=new Map();this.rightPanes=new Map();
  for(const [id,label]of [['properties','属性'],['source','源码'],['data','数据'],['matrix','矩阵']]){const button=action(label,()=>this.openInspector(id),'inspect'+id[0].toUpperCase()+id.slice(1));button.setAttribute('role','tab');button.setAttribute('aria-controls','pane-'+id);tabs.append(button);this.rightButtons.set(id,button);const pane=element('div');pane.id='pane-'+id;pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',button.id);this.rightPanes.set(id,pane);}
  this.editInspector.append(tabs,...this.rightPanes.values());this.rightPanes.get('properties').append($('properties'));const source=$('sourceDetails');source.open=true;this.rightPanes.get('source').append(source);
  const sim=$('simulationDetails');sim.querySelector('summary').textContent='预览数据与预设';this.manual=element('details');this.manual.id='manualSimulation';this.manual.append(element('summary','高级 › 手写模拟数据'));
  for(const id of ['simulation','simulate','importSimulation'])this.manual.append($(id));const help=[...sim.querySelectorAll(':scope>small')].find(node=>node.textContent.includes('formButtons'));if(help)this.manual.append(help);sim.append(this.manual);sim.open=true;
  this.rightPanes.get('data').append(sim);this.rightPanes.get('matrix').append($('matrixDetails'));inspector.replaceChildren(this.playerPanel,this.editInspector);
  this.toolbar=document.querySelector('.toolbar');const tools=this.toolbar.querySelector('div');$('mode').value='preview';$('mode').hidden=true;$('mode').setAttribute('aria-hidden','true');tools.className='editor-toolbar-tools';const display=element('details');display.id='displayMenu';display.append(element('summary','画面'));const displayBody=element('div',undefined,'display-menu-body');for(const id of ['resolution','guiScale','zoom'])displayBody.append($(id));display.append(displayBody);this.toolbar.append(display);
  const bottom=document.querySelector('.bottom');bottom.id='bottomTools';this.bottomButtons=new Map();this.bottomPanes=new Map();const bottomTabs=element('div',undefined,'bottom-tabs');bottomTabs.setAttribute('role','tablist');bottomTabs.setAttribute('aria-label','检查和时间轴');
  for(const [id,label]of [['issues','问题检查'],['budget','控件预算'],['playback','动画 / 双屏']]){const button=action(label,()=>this.openBottom(id));button.setAttribute('role','tab');button.setAttribute('aria-controls','bottom-'+id);this.bottomButtons.set(id,button);bottomTabs.append(button);const pane=element('div');pane.id='bottom-'+id;pane.setAttribute('role','tabpanel');this.bottomPanes.set(id,pane);}
  bottomTabs.append(action('收起',()=>this.openBottom(null),'closeBottom'));
  const issuePane=this.bottomPanes.get('issues');issuePane.append($('count'),$('issues'));const budgetPane=this.bottomPanes.get('budget');for(const id of ['controlBudget','budgetBranches','controlStats','collectionStats','clickResult'])budgetPane.append($(id));const playback=$('playbackDetails');playback.open=true;this.bottomPanes.get('playback').append(playback);bottom.replaceChildren(bottomTabs,...this.bottomPanes.values());
 }
 buildFooter(){
  const footer=element('footer');footer.id='workspaceStatus';footer.setAttribute('aria-label','预览状态');this.previewLabel=element('span','默认模拟');this.previewLabel.id='previewPresetLabel';this.runtimeClock=element('div');this.runtimeClock.id='runtimeClockDock';
  this.issueButton=action('问题 0',()=>this.openBottom(this.bottom==='issues'?null:'issues'),'issueBadge');this.budgetButton=action('本包 0 · 原版 0',()=>this.openBottom(this.bottom==='budget'?null:'budget'),'budgetBadge');const animation=action('动画 / 双屏',()=>this.openBottom(this.bottom==='playback'?null:'playback'),'openPlayback');animation.className='edit-only';
  const status=$('scriptRunStatus');footer.append(this.previewLabel,status,this.runtimeClock,this.issueButton,this.budgetButton,animation);document.querySelector('main').after(footer);
 }
 wire(){
  const arrowTabs=(buttons,activate)=>buttons.forEach((button,index)=>button.addEventListener('keydown',event=>{const keys={ArrowRight:(index+1)%buttons.length,ArrowLeft:(index+buttons.length-1)%buttons.length,Home:0,End:buttons.length-1};if(Object.hasOwn(keys,event.key)){event.preventDefault();activate(keys[event.key]);buttons[keys[event.key]].focus();}}));
  arrowTabs([...this.rightButtons.values()],index=>this.openInspector([...this.rightButtons.keys()][index]));arrowTabs([...this.bottomButtons.values()],index=>this.openBottom([...this.bottomButtons.keys()][index]));
  document.addEventListener('keydown',event=>{if(canvasTabShortcut(event,{dialogOpen:Boolean(document.querySelector('dialog[open]'))})){event.preventDefault();this.setMode(this.mode==='view'?'edit':'view');}else if(event.key==='Escape'&&this.menu.open){this.menu.open=false;this.menu.querySelector('summary').focus();}});
  document.addEventListener('pointerdown',event=>{for(const menu of [this.menu,$('displayMenu')])if(menu.open&&!menu.contains(event.target))menu.open=false;});
  this.menu.addEventListener('click',event=>{if(event.target.closest('button'))this.menu.open=false;});
  $('viewport').setAttribute('role','region');$('viewport').tabIndex=0;$('viewport').setAttribute('aria-label','游戏画面，Tab 切换看与改');
 }
 setMode(mode){if(!['view','edit'].includes(mode)||this.mode===mode)return;this.zooms[this.mode]=$('zoom').value;this.scrolls[this.mode]=document.querySelector('.browser').scrollTop;this.mode=mode;$('zoom').value=this.zooms[mode];this.layout();this.onMode(mode);document.querySelector('.browser').scrollTop=this.scrolls[mode];}
 layout(){
  const edit=this.mode==='edit';this.playerButton.hidden=!this.playerAvailable||edit;document.body.dataset.workspace=this.mode;document.body.dataset.playerOpen=String(!edit&&this.playerOpen);this.viewButton.setAttribute('aria-pressed',String(!edit));this.editButton.setAttribute('aria-pressed',String(edit));
  this.viewNavigation.hidden=edit;this.viewScreens.hidden=edit;this.editNavigation.hidden=!edit;this.editInspector.hidden=!edit;this.playerPanel.hidden=edit||!this.playerOpen;
  this.rightPanes.get('data').prepend(...(edit?[$('stateSamples')]:[]));if(!edit)this.viewExamples.append($('stateSamples'));this.viewExamples.hidden=edit||$('stateSamples').hidden;
  for(const [id,pane]of this.rightPanes){pane.hidden=id!==this.right;this.rightButtons.get(id).setAttribute('aria-selected',String(id===this.right));}
  $('bottomTools').hidden=!this.bottom;for(const [id,pane]of this.bottomPanes){pane.hidden=id!==this.bottom;this.bottomButtons.get(id).setAttribute('aria-selected',String(id===this.bottom));}
 }
 openInspector(id,{manual=false}={}){this.right=id;this.menu.open=false;this.setMode('edit');this.layout();if(id==='matrix')$('matrixDetails').open=true;if(id==='source')$('sourceDetails').open=true;if(id==='data')$('simulationDetails').open=true;if(manual){this.manual.open=true;$('simulation').focus();}else this.rightButtons.get(id)?.focus();this.onInspect?.(id);}
 openBottom(id){const previous=this.bottom;this.bottom=id;this.layout();if(id==='playback')$('playbackDetails').open=true;if(!id&&previous)$(previous==='issues'?'issueBadge':previous==='budget'?'budgetBadge':'openPlayback').focus();}
 togglePlayer(value=!this.playerOpen){if(value)this.onPlayer?.();this.playerOpen=value;this.layout();this.playerButton.setAttribute('aria-expanded',String(this.playerOpen));if(!value&&!this.playerButton.hidden)this.playerButton.focus();}
 attachRuntime(controller){this.runtimeClock.append(this.runtime.querySelector('.script-clock'));const body=this.runtime.querySelector('details>div'),setup=element('details');this.loading=element('small','正在启动脚本…');this.loading.id='scriptLoading';this.loading.setAttribute('role','status');body.prepend(this.loading);setup.id='scriptSetup';setup.append(element('summary','行为包与运行详情'));const pack=body.querySelector('select'),status=$('scriptStatus'),notes=[...body.children].filter(node=>node.tagName==='SMALL'&&node!==this.loading),extras=[...body.children].filter(node=>node.tagName==='DETAILS');setup.append(...notes,pack,status,...extras);body.append(setup);controller.onState=()=>this.runtimeState(controller);this.runtimeState(controller);}
 runtimeState(controller){
  const snapshot=controller.snapshot,active=controller.running;this.runtimeActive=active;this.playerAvailable=Boolean(controller.project?.packs.length);document.body.dataset.scriptRunning=String(active);this.loading.hidden=!active||controller.initialized;this.loading.textContent=snapshot?.type==='failed'?'脚本未能启动，请查看底部错误':'正在启动脚本…';controller.close.hidden=!snapshot?.form;this.runtimeClock.hidden=!active;this.playerButton.hidden=!this.playerAvailable||this.mode==='edit';
  if(!this.playerAvailable&&this.playerOpen)this.togglePlayer(false);
  const state=snapshot?.state||controller.getWorking?.(controller.entry||controller.pack.value)?.state;this.playerSummary.replaceChildren();if(!state){this.playerSummary.append(element('p',active?'正在加载模拟玩家…':'启动脚本后查看当前模拟玩家。'));return;}
  const facts=[['身份','模拟玩家 · OP'],['维度',state.dimension||'overworld'],['背包',(state.inventory||[]).filter(Boolean).length+' / 36 格'],['玩家动态属性',Object.keys(state.player||{}).length+' 项'],['世界动态属性',Object.keys(state.world||{}).length+' 项'],['标签',(state.tags||[]).length+' 项'],['计分项',Object.keys(state.scores||{}).length+' 项']];
  const list=element('dl');for(const [key,value]of facts)list.append(element('dt',key),element('dd',value));this.playerSummary.append(list);
 }
 refresh({issues=[],budget,previewLabel}={}){
  const custom=issues.filter(issue=>!['vanilla-runtime','container-runtime'].includes(issue.category));this.issueButton.textContent='问题 '+custom.length;this.issueButton.title='本包 '+custom.length+' 类；折叠的原版提示 '+(issues.length-custom.length)+' 类';
  if(budget){this.budgetButton.textContent='本包 '+budget.custom+' · 原版 '+budget.vanilla;this.budgetButton.className=budget.severity;this.budgetButton.title='已创建 '+budget.total+' 个控件（含隐藏）；点击查看口径和分支';}
  if(previewLabel){this.previewLabel.textContent=previewLabel;this.previewLabel.title=previewLabel;}
  this.viewExamples.hidden=this.mode==='edit'||$('stateSamples').hidden;
 }
 highlight(screenId,routeId){for(const card of this.viewScreens.querySelectorAll('.side-screen')){const selected=routeId?card.dataset.route===routeId:card.dataset.screen===screenId;card.classList.toggle('active',selected);if(selected)card.setAttribute('aria-current','page');else card.removeAttribute('aria-current');}}
}
