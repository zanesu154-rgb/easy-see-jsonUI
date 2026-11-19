import {cached} from './cache.js';
import {nodes} from './core.js';
import {layoutScene} from './layout.js';
import {resolveTemplate} from './resolver.js';
import {textureResource,isVanilla} from './resources.js';
import {imageDimensions} from './texture-style.js';
import {inferChannels,texturePatterns,expressionSources,expressionSpan,fieldValues,composeChannel,binaryFill,setChannel} from './simulation-tools.js';

const words={node:'节点',task:'任务',goal:'目标',challenge:'挑战',ready:'可领取',active:'进行中',done:'已完成',locked:'锁定',tab:'分页',subtab:'小页',on:'选中',off:'未选中',normal:'常态',cold:'寒',warm:'暖',half:'半格',cell:'图标',frame:'边框',frost:'霜冻',overlay:'覆盖层'};
const describe=name=>name.split('_').map(word=>words[word]||word).join(' · ');
const stem=path=>path.split('/').at(-1).replace(/\.(png|jpe?g)$/i,'');
const hash=bytes=>{let value=2166136261;for(const byte of bytes)value=Math.imul(value^byte,16777619);return value>>>0;};
function assets(files,file){
 const root=file.includes('/ui/')?file.slice(0,file.indexOf('/ui/')):'';
 return cached(files,'sample-assets:'+root,()=>{
  const all=[];
  for(const [path,bytes]of files){
   const match=/(?:^|\/)(textures\/.*\.(?:png|jpe?g))$/i.exec(path);if(!match)continue;
   const texture=match[1].replace(/\.(png|jpe?g)$/i,''),resource=textureResource(files,file,texture);if(resource.path!==path)continue;
   const size=imageDimensions(bytes);all.push({path,texture,name:stem(path),size,hash:size?.[0]>1&&size?.[1]>1?hash(bytes):null,bytes});
  }
  all.sort((a,b)=>Number(isVanilla(a.path))-Number(isVanilla(b.path))||a.texture.localeCompare(b.texture));
  const icons=all.filter(asset=>asset.size&&asset.size[0]/asset.size[1]>=.7&&asset.size[0]/asset.size[1]<=1.4&&/textures\/(?:items|blocks)\/|(?:^|\/)icon_/.test(asset.texture));
  icons.sort((a,b)=>(Number(isVanilla(a.path))*10+(a.texture.startsWith('textures/items/')?0:a.texture.startsWith('textures/blocks/')?1:2))-(Number(isVanilla(b.path))*10+(b.texture.startsWith('textures/items/')?0:b.texture.startsWith('textures/blocks/')?1:2)));
  const backgrounds=all.filter(asset=>asset.size&&asset.size[0]>=asset.size[1]*3&&/toast|notification/i.test(asset.name));
  return {all,icons,backgrounds,labels:new Map()};
 });
}
function stateLabel(pattern,code,library){
 const texture=pattern.prefix+code+pattern.suffix;if(library.labels.has(texture))return library.labels.get(texture);const asset=library.all.find(item=>item.texture===texture);
 const aliases=asset?.hash===null||!asset?[]:library.all.filter(other=>other.path!==asset.path&&other.hash===asset.hash&&other.bytes.length===asset.bytes.length&&other.path.slice(0,other.path.lastIndexOf('/'))===asset.path.slice(0,asset.path.lastIndexOf('/'))&&other.bytes.every((byte,i)=>asset.bytes[i]===byte)&&/(ready|active|done|locked|normal|cold|warm|half|_on$|_off$)/i.test(other.name));
 const alias=aliases.sort((a,b)=>b.name.length-a.name.length)[0];
 const label=alias?describe(alias.name)+'（'+code+'）':code;library.labels.set(texture,label);return label;
}
function stateMeaning(pattern,code,library){const label=stateLabel(pattern,code,library);return ['active','done','locked','ready'].find(key=>label.includes(words[key]));}
// Isolated literals such as tab_on do not join the P0/P1 state family.
function family(values){
 const pending=new Set(values),groups=[];
 while(pending.size){const group=[pending.values().next().value];pending.delete(group[0]);for(let i=0;i<group.length;i++)for(const value of pending){let diff=0;for(let j=0;j<value.length;j++)if(value[j]!==group[i][j])diff++;if(diff===1){group.push(value);pending.delete(value);}}groups.push(group);}
 return groups.sort((a,b)=>b.length-a.length||Number(/^[A-Z0-9]+$/.test(b[0]))-Number(/^[A-Z0-9]+$/.test(a[0])))[0]||[];
}
const patternId=pattern=>[pattern.prefix,pattern.suffix,pattern.start,pattern.end].join('|');
function solve(patterns,primary,code,existing=''){
 const ordered=[primary,...patterns.filter(pattern=>pattern!==primary).sort((a,b)=>(b.end-b.start)-(a.end-a.start))];let attempts=0;
 const visit=(index,chars)=>{
  if(++attempts>512)return;
  if(index===ordered.length)return chars;
  const pattern=ordered[index],values=index===0?[code]:[...pattern.values].sort((a,b)=>Number(existing.slice(pattern.start,pattern.end)===b)-Number(existing.slice(pattern.start,pattern.end)===a));
  for(const value of values){if(value.split('').some((char,i)=>chars[pattern.start+i]!==undefined&&chars[pattern.start+i]!==char))continue;const next=[...chars];value.split('').forEach((char,i)=>next[pattern.start+i]=char);const result=visit(index+1,next);if(result)return result;}
 };
 return visit(0,[]);
}
function formScope(node){
 for(let current=node;current;current=current.parent)if(current.obj.collection_name)return current.obj.collection_name==='form_buttons';
 return !node.obj.$item_collection_name||node.obj.$item_collection_name==='form_buttons';
}
function hiddenPrefixes(objects){
 const codes=new Set(),walk=tree=>{
  if(!tree)return;
  if(tree.type==='unary'&&tree.op==='not'&&tree.value?.op==='=')for(const [a,b]of [[tree.value.left,tree.value.right],[tree.value.right,tree.value.left]]){
   const part=expressionSpan(a);if(part?.channel==='#form_button_text'&&part.start===0&&b.type==='literal'&&typeof b.value==='string'&&b.value.length===part.end)codes.add(b.value);
  }
  if(tree.left)walk(tree.left);if(tree.right)walk(tree.right);if(tree.type==='unary')walk(tree.value);
 };
 for(const obj of objects)for(const {tree}of expressionSources({bindings:Array.isArray(obj.bindings)?obj.bindings.filter(binding=>binding?.target_property_name==='#visible'):[]}))walk(tree);
 return [...codes];
}
function references(tree,name){return Boolean(tree&&(tree.type==='ref'&&tree.value===name||references(tree.left,name)||references(tree.right,name)||tree.type==='unary'&&references(tree.value,name)));}
function buttonProfiles(obj,files,file,library,{formTitle,titleMatches}){
 const controls=[];
 for(const n of nodes({main:obj}))if(formScope(n)&&Number.isInteger(n.obj.collection_index)&&n.obj.collection_index>=0&&n.obj.collection_index<500){
  const existing=controls.find(item=>item.index===n.obj.collection_index);if(existing)existing.objects.push(n.obj);else controls.push({index:n.obj.collection_index,objects:[n.obj]});
 }
 if(!controls.length){
  const factory=nodes({main:obj}).find(n=>n.obj.collection_name==='form_buttons'&&n.obj.factory?.control_ids?.button);
  const target=factory&&resolveTemplate(files,file,factory.obj.factory.control_ids.button);
  if(target)for(let i=0;i<4;i++)controls.push({index:i,objects:[target.obj]});
 }
 if(!controls.length)return [];
 const analysis=new Map(),families=new Map();
 for(const control of controls){
  // Shared resolved templates often differ only in layout and collection index.
  const patterns=[...new Map(control.objects.flatMap(obj=>{
   const signature=JSON.stringify(obj.bindings)+JSON.stringify(obj.controls);let found=analysis.get(signature);
   if(!found){
    const patterns=texturePatterns(obj,files).filter(pattern=>pattern.channel==='#form_button_text'&&pattern.end<=64).map(pattern=>({...pattern,values:pattern.values.filter(code=>textureResource(files,file,pattern.prefix+code+pattern.suffix).status==='found').slice(0,128)}));
    const unsupported=expressionSources(obj).some(source=>source.target==='#texture'&&(references(source.tree,'#form_button_text')||!source.tree&&source.source.includes('#form_button_text'))&&!texturePatterns({},new Map(),{sources:[source]}).length);
    found={patterns,unsupported};analysis.set(signature,found);
   }
   if(found.unsupported)control.unavailable=true;
   return found.patterns;
  }).map(pattern=>[patternId(pattern),pattern])).values()];
  const primary=patterns.filter(pattern=>pattern.values.length).sort((a,b)=>Number(b.start===0)-Number(a.start===0)||(b.end-b.start)-(a.end-a.start))[0];
  if(control.unavailable||patterns.some(pattern=>!pattern.values.length)){control.unavailable=true;continue;}
  if(primary){const values=family(primary.values).filter(code=>solve(patterns,primary,code));if(!values.length){control.unavailable=true;continue;}control.patterns=patterns;control.primary=primary;control.values=values;control.key=patternId(primary);const hidden=hiddenPrefixes(control.objects),existing=families.get(control.key);if(existing){existing.values=existing.values.filter(code=>values.includes(code));existing.hidden=new Set([...existing.hidden].filter(code=>hidden.includes(code)));}else families.set(control.key,{primary,values,hidden:new Set(hidden)});}
 }
 if(controls.some(control=>control.unavailable))return [];
 const create=(simulation,chosen,original)=>{
  const next=structuredClone(simulation),buttons=Array.isArray(next.formButtons)?next.formButtons:[];
  const max=Math.max(...controls.map(control=>control.index));for(let i=0;i<=max;i++)if(buttons[i]===undefined)buttons[i]={text:'示例按钮 '+(i+1),texture:library.icons[i%Math.max(1,library.icons.length)]?.texture||''};
  for(const control of controls){
   const old=original?.formButtons?.[control.index]??buttons[control.index],item=typeof old==='string'?{text:old}:old;
   let text=item.text;
   if(chosen?.hidden&&chosen.key===control.key){text=chosen.code;}
   else if(control.primary){
    const baseCode=control.values.find(code=>text.startsWith(code))||control.values[control.index%control.values.length];
    const matches=chosen?.key===control.key;
    const code=matches&&chosen.state?control.values.filter(code=>stateMeaning(control.primary,code,library)===chosen.state).sort((a,b)=>[...a].filter((char,i)=>char!==baseCode[i]).length-[...b].filter((char,i)=>char!==baseCode[i]).length)[0]||baseCode:matches?chosen.code:chosen?baseCode:control.values[control.index%control.values.length],chars=solve(control.patterns,control.primary,code,text)||solve(control.patterns,control.primary,code);
    if(!chars)throw Error('无法组合该按钮状态，请导入真实模拟数据');
    const length=Math.max(...control.patterns.map(pattern=>pattern.end)),prefix=Array.from({length},(_,i)=>chars[i]??'0').join('');
    text=prefix+(control.values.some(value=>text.startsWith(value))&&text.length>length?text.slice(length):length<=2?'示例'+(control.index+1):'示例节点 '+(control.index+1)+'\n状态来自包内贴图');
   }
   buttons[control.index]={...item,text,texture:item.texture||library.icons[control.index%Math.max(1,library.icons.length)]?.texture||''};
  }
  next.formButtons=buttons;if(formTitle&&(!next.formTitle||!titleMatches?.(next.formTitle)))next.formTitle=formTitle;
  next.formBody=next.formBody||'示例 · 包内状态预览';return next;
 };
 const graph=nodes({main:obj});let visibilityBudget=20000;
 const hiddenValid=(key,code)=>{
  if(graph.length*2>visibilityBudget)return false;visibilityBudget-=graph.length*2;
  const simulation=create({}, {key,code,hidden:true}),indices=new Set(controls.filter(control=>control.key===key).map(control=>control.index));
  for(const touch of [false,true]){
   const scene=layoutScene(graph,'["main"]',{width:640,height:360,simulation:{...simulation,touch,pocketScreen:touch,pocketEdition:touch},mode:'preview'});
   for(const node of graph)if(indices.has(node.obj.collection_index)){const value=scene.runtime.get(node.id);if(value&&value.visible!==false&&value.ignored!==true)return false;}
  }
  return true;
 };
 const result=[{id:'buttons:mixed',label:'按钮混合状态',recipes:[{id:'buttons:mixed',label:'混合展示包内状态',make:(sim,original)=>create(sim,undefined,original),source:'从 '+controls.length+' 个按钮位置及已有贴图生成'}]}];
 for(const [key,{primary,values,hidden}]of families){
  if(!values.length&&!hidden.size)continue;
  const states=new Map();for(const code of values){const state=stateMeaning(primary,code,library);if(state)states.set(state,(states.get(state)||0)+1);}
  const semantic=states.size>1&&[...states.values()].some(count=>count>1)?[...states.keys()].map(state=>({id:key+'=state:'+state,label:'全部'+words[state]+'（保留形状）',source:'使用包内同状态贴图，保留节点形状与原文字',make:(sim,original)=>create(sim,{key,state},original)})):[];
  result.push({id:'buttons:'+key,label:primary.prefix.split('/').at(-1)+' 按钮状态',recipes:[...semantic,...values.slice(0,64).map(code=>({id:key+'='+code,label:stateLabel(primary,code,library),source:primary.prefix+code+primary.suffix,make:(sim,original)=>create(sim,{key,code},original)})),...[...hidden].filter(code=>hiddenValid(key,code)).map(code=>({id:key+'=hidden:'+code,label:'隐藏／空位（'+code+'）',source:'显示条件：'+code,make:(sim,original)=>create(sim,{key,code,hidden:true},original)}))]});
 }
 return result.filter(group=>group.recipes.length);
}
function characterLabels(obj,channel){
 const labels=new Map();
 for(const node of nodes({main:obj})){
  if(typeof node.obj.texture!=='string'||!node.obj.texture.startsWith('textures/'))continue;
  const name=stem(node.obj.texture),token=name.split('_').find(word=>['normal','cold','warm','half','empty','active','done','ready','locked'].includes(word));
  const walk=tree=>{
   if(!tree)return;
   if(tree.type==='binary'&&tree.op==='=')for(const [a,b]of [[tree.left,tree.right],[tree.right,tree.left]]){
    const left=expressionSpan(a),part=b?.op==='+'&&expressionSpan(b.left),char=b?.right?.value;
    if(left?.channel===channel&&part?.channel===channel&&left.start===0&&part.start===0&&left.end===part.end+1&&typeof char==='string'&&char.length===1){
     const key=part.end+':'+char;labels.set(key,{token,label:describe(name==='frost_overlay'?node.name.split('@')[0]:name)});
    }
   }
   if(tree.left)walk(tree.left);if(tree.right)walk(tree.right);if(tree.type==='unary')walk(tree.value);
  };
  for(const {tree}of expressionSources({bindings:node.obj.bindings}))walk(tree);
 }
 return labels;
}
function channelProfiles(obj,files,library){
 const result=[];
 for(const schema of inferChannels(obj,files).filter(schema=>schema.channel!=='#form_button_text'&&schema.channel!=='#title_text')){
  const labels=characterLabels(obj,schema.channel),fields=schema.fields,base=fieldValues(schema,''),binary=fields.findIndex(field=>field.kind==='binary'),sequence=fields.findIndex(field=>field.kind==='sequence'),paths=fields.map((field,i)=>field.kind==='path'?i:-1).filter(i=>i>=0),recipes=[];
  fields.forEach((field,i)=>{if(!Number.isFinite(field.end))base[i]='示例状态';else if(field.kind==='fixed'||field.kind==='sequence')base[i]=([...field.allowed||'0'].find(char=>labels.get(field.start+':'+char)?.token==='normal')||field.allowed?.[0]||'0').repeat(field.end-field.start);});
  const add=(id,label,values)=>recipes.push({id:schema.id+':'+id,label,source:schema.prefix+' · '+schema.channel,make:sim=>setChannel(sim,schema.channel,composeChannel(schema,values))});
  if(paths.length){
   if(!library.icons.length||!library.backgrounds.length)continue;
   for(const background of library.backgrounds.slice(0,32)){const values=[...base];paths.forEach((index,i)=>values[index]=(i===0?library.icons[0]:background).texture);if(paths.some(index=>values[index].length>fields[index].end-fields[index].start))continue;add(background.texture,'弹窗 · '+background.name,values);}
  }else if(binary>=0){
   const stage=fields.findIndex(field=>field.kind==='enum'),stages=stage>=0?fields[stage].options:[''];
   for(const code of stages.slice(0,16))for(const percent of [50,0,25,75,100]){const values=[...base];if(stage>=0)values[stage]=code;values[binary]=binaryFill(fields[binary].end-fields[binary].start,percent);values[values.length-1]='示例 · '+percent+'%';add(code+':'+percent,(code?'阶段 '+code+' · ':'')+percent+'% 填充',values);}
  }else if(sequence>=0){
   for(const char of fields[sequence].allowed||'n'){
    const values=[...base],hint=labels.get(fields[sequence].start+':'+char);values[sequence]=char.repeat(fields[sequence].end-fields[sequence].start);
    if(hint?.token)fields.forEach((field,i)=>{if(i===sequence||field.end-field.start!==1)return;const related=[...field.allowed||''].find(option=>labels.get(field.start+':'+option)?.token===hint.token);if(related)values[i]=related;});
    add('sequence:'+char,(hint?.label||'序列 '+char)+' × '+values[sequence].length,values);
   }
   const values=[...base],alphabet=fields[sequence].allowed||'n';values[sequence]=Array.from({length:fields[sequence].end-fields[sequence].start},(_,i)=>alphabet[i%alphabet.length]).join('');add('mixed','混合序列',values);
  }else{
   const choices=fields.map((field,i)=>({i,options:field.options?.length?field.options:field.allowed?[...field.allowed]:[]})).filter(field=>field.options.length);
   if(choices.length)for(const choice of choices)for(const option of choice.options.slice(0,32)){const values=[...base];values[choice.i]=option;add(choice.i+':'+option,(labels.get(fields[choice.i].start+':'+option)?.label||'第 '+(fields[choice.i].start+1)+' 位')+' · '+option,values);}
   else for(const [id,text]of [['single','示例状态 100 / 100'],['multiple','示例状态\n第二行示例\n第三行 50%']]){const values=[...base];if(!Number.isFinite(fields.at(-1)?.end))values[values.length-1]=text;add(id,id==='single'?'单行文字':'多行文字',values);}
  }
  if(recipes.length){recipes.push({id:schema.id+':hidden',label:'隐藏（清空该通道）',source:schema.channel,make:sim=>setChannel(sim,schema.channel,'')});result.push({id:schema.id,label:schema.prefix+' 通道状态',recipes:recipes.slice(0,100)});}
 }
 return result;
}
export function sampleCatalog(obj,files,file,options={}){
 const library=assets(files,file),groups=options.channelOnly?[]:buttonProfiles(obj,files,file,library,options);
 groups.push(...channelProfiles(obj,files,library));
 if(options.containers?.length){groups.push({id:'containers',label:'容器布局',recipes:options.containers.slice(0,20).flatMap(route=>[false,true].map(pocket=>({id:route.id+':'+pocket,label:route.label+' · '+(pocket?'手机':'桌面'),source:route.content,make:sim=>{const next={...structuredClone(sim),containerTitle:route.sample,touch:pocket,pocketEdition:pocket,pocketScreen:pocket};for(const field of ['variables','bindings'])for(const [key,value]of Object.entries({'$container_title':route.sample,'$pocket_screen':pocket,'$pocket_edition':pocket,'$touch':pocket,'$desktop_screen':!pocket}))if(Object.hasOwn(next[field]||{},key))next[field][key]=value;return next;}})))});}
 return groups;
}
