import {stripFormatting} from './text.js';
import {normalizePlayerState,patchPlayerState,playerStateSignature} from './player-saves.js';
import {playerFields,fieldKind} from './player-fields.js';
const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
const button=(text,fn,id)=>{const element=node('button',text);element.onclick=fn;if(id)element.id=id;return element;};
export class PlayerStatePanel{
 constructor(container,footer,{controller,saves,onEdit,onLoad,onSave,onDelete,onNew,onSource,onExport,onImport}){
  Object.assign(this,{container,controller,saves,onEdit,onLoad,onSave,onDelete,onNew,onSource});this.rows=new Map();this.showAll=false;this.dirtyRaw=false;this.lastRaw='';this.lastFields='';
  this.message=node('small');this.message.id='playerStateStatus';this.message.setAttribute('role','status');container.append(this.message);
  const toolbar=node('div');toolbar.className='player-state-toolbar';this.scope=node('select');this.scope.id='stateScope';this.scope.setAttribute('aria-label','状态显示范围');for(const [value,text]of [['action','本次动作及后续表单用到的状态'],['all','全部已知存储项']]){const option=node('option',text);option.value=value;this.scope.append(option);}this.scope.onchange=()=>{this.showAll=this.scope.value==='all';this.renderFields(true);};toolbar.append(this.scope);container.append(toolbar);
  this.fields=node('div');this.fields.id='playerStateFields';container.append(this.fields);
  const saveTools=node('details');saveTools.id='playerSaveTools';saveTools.append(node('summary','玩家存档'));this.name=node('input');this.name.id='playerSaveName';this.name.placeholder='例如 新手 / 开阳圆满';this.name.setAttribute('aria-label','玩家存档名称');this.save=button('保存当前状态为新存档',()=>this.try(()=>onSave(this.name.value)),'savePlayerState');this.remove=button('删除所选存档',()=>this.try(()=>onDelete(this.select.value)),'deletePlayerState');saveTools.append(this.name,this.save,this.remove,button('导出玩家存档',()=>this.try(onExport),'exportPlayerSaves'),button('导入玩家存档',onImport,'importPlayerSaves'),button('新建空白玩家',()=>this.try(onNew),'newPlayerState'));container.append(saveTools);
  this.select=node('select');this.select.id='playerSaveSelect';this.select.setAttribute('aria-label','当前玩家存档');this.select.onchange=()=>{if(this.select.value)this.try(()=>onLoad(this.select.value));};footer.append(this.select);
  const raw=node('details');raw.id='rawPlayerState';raw.append(node('summary','高级 › 全部原始状态'));this.raw=node('textarea');this.raw.id='rawPlayerStateJson';this.raw.spellcheck=false;this.raw.setAttribute('aria-label','玩家状态 JSON');this.raw.oninput=()=>{this.dirtyRaw=true;};this.applyRaw=button('应用原始状态并重新预览',()=>this.try(()=>{const state=normalizePlayerState(JSON.parse(this.raw.value));onEdit(state);this.dirtyRaw=false;}),'applyRawPlayerState');raw.append(this.raw,this.applyRaw,button('从当前状态重新填入',()=>{this.dirtyRaw=false;this.updateRaw(true);},'resetRawPlayerState'));container.append(raw);
 }
 entry(){return this.controller.entry||this.controller.pack.value;}
 current(){return this.controller.running&&this.controller.snapshot?.state?this.controller.snapshot:{state:this.saves.current(this.entry())?.state||normalizePlayerState(),reads:(this.saves.current(this.entry())?.sourceHash===this.controller.sourceHash?this.saves.current(this.entry())?.observations||[]:[]),action:{kind:'stored'},actionReads:[]};}
 try(fn){this.message.dataset.error='false';try{const result=fn();if(result?.catch)result.catch(error=>{this.message.textContent=error.message;this.message.dataset.error='true';});return result;}catch(error){this.message.textContent=error.message;this.message.dataset.error='true';}}
 update(){
  const controller=this.controller,entry=this.entry(),work=this.saves.current(entry),active=this.saves.active.get(entry),snapshot=this.current();this.snapshot=snapshot;
  this.container.hidden=!entry;this.select.hidden=!entry;const old=this.select.value,list=this.saves.entries.filter(value=>value.entry===entry),key=JSON.stringify(list.map(value=>[value.id,value.name]));
  if(key!==this.saveKey){this.saveKey=key;this.select.replaceChildren();const empty=node('option','临时玩家状态');empty.value='';this.select.append(empty);for(const save of list){const option=node('option',save.name);option.value=save.id;this.select.append(option);}}
  this.select.value=active||'';this.select.disabled=controller.busy;this.save.disabled=!entry||controller.busy;this.remove.disabled=!active||controller.busy;this.applyRaw.disabled=controller.busy;
  const status=controller.stateMessage||(!controller.running?'修改在本机保留，启动脚本后预览。':snapshot.action?.kind==='startup'?'触发动作后，这里会累计显示该动作与后续表单用到的状态。':snapshot.action?.label?'当前操作：'+snapshot.action.label:'');if(this.message.dataset.error!=='true')this.message.textContent=status;
  this.renderFields();this.updateRaw();
 }
 updateRaw(force=false){const text=JSON.stringify(this.current().state,null,2);if(force||!this.dirtyRaw&&document.activeElement!==this.raw&&text!==this.lastRaw){this.raw.value=text;this.lastRaw=text;}}
 renderFields(force=false){
  const snapshot=this.current(),work=this.saves.current(this.entry()),fields=playerFields(snapshot,{all:this.showAll,observations:work?.sourceHash===this.controller.sourceHash?work?.observations||[]:[]}),schema=JSON.stringify(fields.map(field=>[field.id,fieldKind(field),field.options,field.sources,field.hints]));
  if(force||schema!==this.lastFields){if(this.fields.contains(document.activeElement)&&!force)return;this.lastFields=schema;this.fields.replaceChildren();this.rows.clear();
   if(!fields.length)this.fields.append(node('small',this.showAll?'暂无存储项。可在高级原始状态中添加。':'此操作尚未访问可编辑存储；可切换到全部已知存储项。'));
   const groups=new Map();for(const field of fields){let group=groups.get(field.owner);if(!group){group=node(['inventory','tags'].includes(field.owner)?'details':'section');const heading=node(group.tagName==='DETAILS'?'summary':'h4',({player:'玩家动态属性',world:'世界动态属性',tag:'标签',tags:'标签集合',inventory:'背包',scoreboard:'计分板'})[field.owner]);group.append(heading);groups.set(field.owner,group);this.fields.append(group);}const row=this.buildField(field);group.append(row.element);this.rows.set(field.id,row);}
  }
  for(const field of fields){const row=this.rows.get(field.id);if(!row)continue;row.field=field;for(const input of row.element.querySelectorAll('input,select,button,textarea'))input.disabled=this.controller.busy;row.metadata(field);if(!this.controller.busy&&!row.element.contains(document.activeElement))row.update(field.value??field.hints?.fallback);}
 }
 buildField(field){
  const element=node('div');element.className='player-state-field';element.dataset.fieldId=field.id;const name=node('label',field.owner==='inventory'?'背包 ['+field.key+']':field.key);element.append(name);const body=node('div');element.append(body);let kind=fieldKind(field),last;
  const commit=(value,unset=false)=>this.try(()=>{this.message.dataset.error='false';const state=patchPlayerState(this.current().state,field,value,{unset});this.onEdit(state);});
  const input=(type,label,parent=body)=>{const input=node('input');input.type=type;input.setAttribute('aria-label',label);parent.append(input);return input;};let update=()=>{};
  const render=()=>{body.replaceChildren();
   if(kind==='unknown'){const type=node('select');type.className='state-value-type';for(const value of ['','number','string','boolean','json-string']){const option=node('option',({'':'选择值类型',number:'数字',string:'文本',boolean:'开关','json-string':'JSON 字符串'})[value]);option.value=value;type.append(option);}type.onchange=()=>{kind=type.value;render();};body.append(type);return;}
   if(kind==='inventory'){
    const id=input('text','物品 ID'),amount=input('number','物品数量');id.placeholder='minecraft:book';amount.min=1;amount.max=255;amount.value=1;const change=()=>commit(id.value?{...(last||{}),typeId:id.value,amount:Number(amount.value)}:null,true&&!id.value);id.onchange=amount.onchange=change;update=value=>{last=value;id.value=value?.typeId||'';amount.value=value?.amount||1;};
   }else if(kind==='boolean'){const control=input('checkbox',field.key);control.onchange=()=>commit(control.checked);update=value=>{control.checked=Boolean(value);};}
   else if(kind==='json'||kind==='json-string'){
    const structured=node('div');structured.className='structured-state';body.append(structured);let current;
    const draw=value=>{structured.replaceChildren();let count=0;
     const leaf=(value,path,parent,depth)=>{if(depth>6||++count>120){parent.append(node('small','更多内容请在高级原始状态中编辑'));return;}if(value&&typeof value==='object'){for(const [key,item]of Object.entries(value)){const child=node('div');child.className='structured-state-row';child.append(node('span',key));parent.append(child);leaf(item,[...path,key],child,depth+1);}if(!Object.keys(value).length)parent.append(node('small',Array.isArray(value)?'空数组':'空对象'));return;}
      const control=input(typeof value==='number'?'number':typeof value==='boolean'?'checkbox':'text',path.join('.'),parent);if(control.type==='checkbox')control.checked=value;else control.value=value??'';control.onchange=()=>{let target=current;for(const key of path.slice(0,-1))target=target[key];const next=control.type==='checkbox'?control.checked:control.type==='number'?Number(control.value):control.value;if(path.length)target[path.at(-1)]=next;else current=next;commit(kind==='json-string'?JSON.stringify(current):current);};
     };leaf(value,[],structured,0);
    };update=value=>{const signature=JSON.stringify(value);if(signature===last)return;last=signature;try{current=kind==='json-string'?JSON.parse(value||'{}'):structuredClone(value??{});draw(current);}catch{structured.textContent='JSON 解析失败，请在高级原始状态中修正。';}};
   }else{
    let select;if(field.options?.length>=2){select=node('select');select.className='state-options';for(const option of field.options){const item=node('option',String(option.value)+' · '+stripFormatting(option.label));item.value=JSON.stringify(option.value);select.append(item);}const custom=node('option','自定义值…');custom.value='__custom__';select.append(custom);select.onchange=()=>{if(select.value!=='__custom__')commit(JSON.parse(select.value));else control.focus();};body.append(select);}
    const control=input(kind==='number'?'number':'text',field.key);control.className='state-value';if(kind==='number')control.step='any';control.onchange=()=>this.try(()=>{if(kind==='number'&&control.value==='')throw Error('请输入数字，或点使用默认清除该值');commit(kind==='number'?Number(control.value):control.value);});update=value=>{control.value=value??'';if(select)select.value=field.options.some(option=>Object.is(option.value,value))?JSON.stringify(value):'__custom__';};
   }
  };
  render();const meta=node('small');meta.className='state-field-meta';meta.textContent=(field.write?'有写入':'读取')+' · '+(field.value===undefined?'未设置，使用脚本默认':'已设置');element.append(meta);
  const source=field.sources?.[0];if(source)element.append(button(source.file.split('/').at(-1)+':'+source.line,()=>this.onSource?.(source)));
  if(['player','world','scoreboard','inventory','tag'].includes(field.owner))element.append(button('使用默认 / 清除',()=>commit(undefined,true)));
  const history=node('details');history.className='state-history';const summary=node('summary','读写记录'),values=node('small');history.append(summary,values);element.append(history);
  return {element,field,update:value=>update(value),metadata:current=>{meta.textContent=(current.write?'有写入':'读取')+' · '+(current.value===undefined?'未设置，使用脚本默认':'已设置');summary.textContent='读 '+(current.readCount||0)+' 次 / 写 '+(current.writeCount||0)+' 次';const display=value=>value===undefined?'未设置':JSON.stringify(value).slice(0,500);values.textContent=(current.lastRead?'最近读取：'+display(current.lastRead.value)+'；':'')+(current.lastWritten?'最近写入：'+display(current.lastWritten.value):'');}};
 }
}
