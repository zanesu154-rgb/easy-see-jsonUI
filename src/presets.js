import {formButtons} from './collections.js';
export function validateSimulation(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('模拟数据需要 JSON 对象');
 formButtons(value);
 for(const key of ['containerItems','inventoryItems','hotbarItems']){
  const items=value[key];if(items===undefined)continue;
  if(!Array.isArray(items)||items.length>2048)throw Error(key+' 需要最多 2048 项的物品数组');
  for(const item of items){
   if(item===null)continue;
   if(!item||typeof item!=='object'||Array.isArray(item)||item.name!==undefined&&typeof item.name!=='string'||item.texture!==undefined&&typeof item.texture!=='string'||item.count!==undefined&&(!Number.isInteger(item.count)||item.count<0))throw Error(key+' 的物品可填写字符串 name、texture 和非负整数 count');
  }
 }
 return value;
}
export class Presets{
 entries=[];next=1;
 save(scene,name,simulation){
  validateSimulation(simulation);name=name.trim();if(!name)throw Error('请填写预设名称');
  if(this.entries.length>=100)throw Error('每个工程最多保存 100 组预设');
  const entry={id:'preset-'+this.next++,scene,name,data:structuredClone(simulation)};this.entries.push(entry);return entry;
 }
 remove(id){this.entries=this.entries.filter(entry=>entry.id!==id);}
 clear(){this.entries=[];this.next=1;}
 text(){return JSON.stringify({version:1,presets:this.entries},null,2)+'\n';}
 load(source,{merge=false}={}){
  const value=JSON.parse(source);if(value?.version!==1||!Array.isArray(value.presets)||value.presets.length>100)throw Error('预设文件需要 version: 1 和 presets 数组（最多 100 组）');
  for(const entry of value.presets){if(!entry||typeof entry.scene!=='string'||typeof entry.name!=='string'||!entry.name.trim())throw Error('预设缺少界面位置或名称');validateSimulation(entry.data);}
  if(!merge)this.clear();if(this.entries.length+value.presets.length>100)throw Error('合并后超过 100 组预设');
  for(const entry of value.presets)this.save(entry.scene,entry.name,entry.data);
 }
}
