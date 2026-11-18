// Player storage is deliberately distinct from JSON UI binding presets.
export function normalizePlayerState(input={}){
 const record=value=>value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value)),copy=value=>structuredClone(value);
 if(!record(input))throw Error('玩家状态需要对象');
 const atom=(value,depth=0)=>{if(depth>8)throw Error('状态嵌套过深');if(typeof value==='boolean'||typeof value==='string'&&value.length<=131072||typeof value==='number'&&Number.isFinite(value))return;if(record(value)&&Object.keys(value).sort().join(',')==='x,y,z'&&Object.values(value).every(v=>typeof v==='number'&&Number.isFinite(v)))return;throw Error('动态属性只支持文本、有限数字、布尔或坐标对象');};
 const properties=(value,label)=>{if(value===undefined)return {};if(!record(value)||Object.keys(value).length>4096)throw Error(label+'需要最多 4096 项的对象');for(const [key,item]of Object.entries(value)){if(!key||key.length>256)throw Error(label+'键名无效');atom(item);}return copy(value);};
 const tags=input.tags??[];if(!Array.isArray(tags)||tags.length>2048||tags.some(tag=>typeof tag!=='string'||!tag||tag.length>256))throw Error('标签需要文本数组');
 const scores=input.scores??{};if(!record(scores)||Object.keys(scores).length>512)throw Error('计分板需要对象');for(const [objective,participants]of Object.entries(scores)){if(!objective||objective.length>256||!record(participants)||Object.keys(participants).length>2048)throw Error('计分项格式无效');for(const [name,value]of Object.entries(participants))if(!name||name.length>256||!Number.isSafeInteger(value)||value<-2147483648||value>2147483647)throw Error('分数需要 32 位整数');}
 const inventory=input.inventory??[];if(!Array.isArray(inventory)||inventory.length>36)throw Error('背包最多 36 格');const items=Array.from({length:36},(_,i)=>{const item=inventory[i];if(item==null)return null;if(!record(item)||typeof item.typeId!=='string'||!/^[-\w.]+:[-\w./]+$/.test(item.typeId)||!Number.isInteger(item.amount)||item.amount<1||item.amount>255)throw Error('背包 ['+i+'] 需要有效物品 ID 和 1–255 数量');if(item.nameTag!==undefined&&typeof item.nameTag!=='string'||item.lore!==undefined&&(!Array.isArray(item.lore)||item.lore.some(line=>typeof line!=='string')))throw Error('物品名称或描述无效');return {typeId:item.typeId,amount:item.amount,...(item.nameTag!==undefined?{nameTag:item.nameTag}:{}),...(item.lore?.length?{lore:[...item.lore]}:{}),...(item.dynamicProperties?{dynamicProperties:properties(item.dynamicProperties,'物品属性')}:{})};});
 const tick=input.tick??0;if(!Number.isSafeInteger(tick)||tick<0||tick>1e12)throw Error('tick 需要非负整数');
 const dimension=input.dimension??'minecraft:overworld';if(typeof dimension!=='string'||!dimension||dimension.length>256)throw Error('维度无效');
 const state={player:properties(input.player,'玩家属性'),world:properties(input.world,'世界属性'),tags:[...new Set(tags)],scores:copy(scores),inventory:items,dimension,tick};
 if(JSON.stringify(state).length>4*1024*1024)throw Error('单份玩家状态超过 4 MB');return state;
}
export function playerStateSignature(input,{clock=false}={}){
 const sort=value=>Array.isArray(value)?value.map(sort):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,sort(item)])):value;
 const state=normalizePlayerState(input);if(!clock)delete state.tick;state.tags.sort();return JSON.stringify(sort(state));
}
export function patchPlayerState(input,field,value,{unset=false}={}){
 const state=normalizePlayerState(input),put=(object,key,item)=>Object.defineProperty(object,key,{value:item,enumerable:true,writable:true,configurable:true});
 if(['player','world'].includes(field.owner)){if(unset)delete state[field.owner][field.key];else put(state[field.owner],field.key,value);}
 else if(field.owner==='tag'){const tags=new Set(state.tags);if(value&&!unset)tags.add(field.key);else tags.delete(field.key);state.tags=[...tags];}
 else if(field.owner==='tags'){state.tags=unset?[]:value;}
 else if(field.owner==='scoreboard'){const objective=field.objective??field.key.split('/')[0],participant=field.participant??field.key.slice(objective.length+1);if(!Object.hasOwn(state.scores,objective))put(state.scores,objective,{});if(unset)delete state.scores[objective][participant];else put(state.scores[objective],participant,value);}
 else if(field.owner==='inventory'){const index=Number(field.key);if(!Number.isInteger(index)||index<0||index>=36)throw Error('背包格子越界');state.inventory[index]=unset?null:value;}
 else if(field.owner==='dimension')state.dimension=value;
 else throw Error('此存储类型暂不可编辑：'+field.owner);
 return normalizePlayerState(state);
}
export class PlayerSaves{
 constructor(){this.clear();}
 clear(){this.entries=[];this.working=new Map();this.active=new Map();this.next=1;this.revision=0;}
 setWorking(entry,state,extra={}){this.working.set(entry,{...structuredClone(extra),state:normalizePlayerState(state)});}
 current(entry){return this.working.get(entry);}
 save(entry,name,state,extra={}){name=String(name).trim();if(!entry||!name||name.length>100)throw Error('请填写 1–100 字的存档名称');if(this.entries.length>=100)throw Error('每个工程最多 100 份玩家存档');const value={...structuredClone(extra),id:'save-'+this.next++,entry,name,state:normalizePlayerState(state)};if(JSON.stringify({...JSON.parse(this.text()),saves:[...this.entries,value]}).length>16*1024*1024)throw Error('玩家存档总量超过 16 MB');this.entries.push(value);this.active.set(entry,value.id);this.setWorking(entry,value.state,extra);this.revision++;return value;}
 select(id){const value=this.entries.find(value=>value.id===id);if(!value)throw Error('存档不存在');this.active.set(value.entry,id);const {state,...extra}=structuredClone(value);delete extra.id;delete extra.entry;delete extra.name;this.setWorking(value.entry,state,extra);this.revision++;return structuredClone(value);}
 remove(id){const value=this.entries.find(value=>value.id===id);this.entries=this.entries.filter(value=>value.id!==id);if(value&&this.active.get(value.entry)===id)this.active.delete(value.entry);this.revision++;}
 text(){return JSON.stringify({version:1,saves:this.entries,working:Object.fromEntries(this.working),active:Object.fromEntries(this.active)},null,2)+'\n';}
 load(source,{merge=false}={}){
  const input=typeof source==='string'?JSON.parse(source):source;if(input?.version!==1||!Array.isArray(input.saves)||input.saves.length>100||input.working!==undefined&&(!input.working||typeof input.working!=='object'||Array.isArray(input.working)))throw Error('玩家存档文件需要 version: 1、saves 数组和 working 对象');
  const validateExtra=value=>{
   if(value.action!==undefined&&value.action!==null&&(!value.action||typeof value.action.event!=='string'||JSON.stringify(value.action).length>10000))throw Error('存档动作格式无效');
   if(value.observations!==undefined){if(!Array.isArray(value.observations)||value.observations.length>4096)throw Error('观察记录过多');for(const field of value.observations){if(!field||typeof field.id!=='string'||typeof field.key!=='string'||typeof field.owner!=='string')throw Error('观察字段格式无效');if(field.options!==undefined&&(!Array.isArray(field.options)||field.options.length>64||field.options.some(option=>!option||!['number','string','boolean'].includes(typeof option.value)||typeof option.label!=='string')))throw Error('状态候选值格式无效');if(field.sources!==undefined&&(!Array.isArray(field.sources)||field.sources.some(source=>!source||typeof source.file!=='string'||!Number.isInteger(source.line)||source.line<1)))throw Error('状态来源格式无效');if(field.hints!==undefined&&(!field.hints||typeof field.hints!=='object'||Array.isArray(field.hints)))throw Error('类型提示格式无效');}}
   if(value.previews!==undefined){const previews=value.previews;if(!previews||previews.status!=='ready'||typeof previews.key!=='string'||!Array.isArray(previews.outputs)||previews.outputs.length>64)throw Error('存档缩略图记录无效');for(const output of previews.outputs){if(output.form&&(typeof output.form.title!=='string'||!Array.isArray(output.form.buttons)||output.form.buttons.length>500||output.form.buttons.some(button=>!button||typeof button.text!=='string')))throw Error('存档表单记录无效');if(output.hud&&['title','subtitle','actionbar'].some(key=>typeof output.hud[key]!=='string'))throw Error('存档 HUD 记录无效');if(output.hud?.messages&&(!Array.isArray(output.hud.messages)||output.hud.messages.some(message=>!message||typeof message.text!=='string')))throw Error('存档聊天记录无效');}}
  };
  const saves=input.saves.map(value=>{if(!value||typeof value.entry!=='string'||!value.entry||typeof value.name!=='string'||!value.name.trim())throw Error('玩家存档缺少入口和名称');validateExtra(value);return {...structuredClone(value),state:normalizePlayerState(value.state)};});
  const working=Object.entries(input.working||{}).map(([entry,value])=>{if(!entry||!value)throw Error('工作状态格式无效');validateExtra(value);return [entry,{...structuredClone(value),state:normalizePlayerState(value.state)}];});
  if((merge?this.entries.length:0)+saves.length>100)throw Error('合并后超过 100 份玩家存档');if(JSON.stringify(input).length>16*1024*1024)throw Error('玩家存档文件超过 16 MB');
  if(!merge)this.clear();const remap=new Map();for(const value of saves){const oldId=value.id;value.id='save-'+this.next++;this.entries.push(value);remap.set(oldId,value.id);}for(const [entry,value]of working)this.working.set(entry,value);for(const [entry,id]of Object.entries(input.active||{}))if(remap.has(id))this.active.set(entry,remap.get(id));this.revision++;
 }
}
