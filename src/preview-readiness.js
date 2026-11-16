import {presentScene} from './scene-presentation.js';

// Missing simulation is different from a missing resource. Keep that distinction
// visible before the user scrolls through the inspector or the source editor.
export function previewReadiness(scene,ns,rootName,{error,buttonCount=0,schemas=[],mode='edit'}={}){
 if(error)return {kind:'parse-error',message:'当前文件解析失败：'+error};
 const relevant=ns.filter(n=>n.path[0]===rootName),missing=new Set();
 for(const n of relevant){const obj=scene.runtime.get(n.id);if(obj?._collectionMissing&&obj._collectionIndex!==undefined)missing.add(obj._collectionIndex);}
 if(missing.size)return {kind:'missing-buttons',missing:missing.size,message:(buttonCount?'已提供 '+buttonCount+' 项按钮数据，仍有 '+missing.size+' 个序号缺少数据。':'当前尚无按钮模拟数据。')+(mode==='edit'?'编辑模式仅显示占位；':'预览模式不显示缺数据的按钮；')+'请导入按钮模拟 JSON 或加载预设。'};
 const root=scene.runtime.get(JSON.stringify([rootName]));if(!root)return {kind:'none',message:''};
 const presentation=presentScene(relevant,scene),painted=relevant.some(n=>{const obj=scene.runtime.get(n.id),item=presentation.get(n.id);return item?.visible&&item.opacity>0&&item.rect.w>0&&item.rect.h>0&&['image','label','button','custom'].includes(obj?.type);});
 if(painted)return {kind:'ready',message:''};
 const prefixes=schemas.map(schema=>schema.prefix).filter(Boolean),format=prefixes.length?'需要 '+prefixes.slice(0,3).join(' / ')+' 通道数据，可打开填表并应用。':'请检查显示条件，或填写模拟数据。';
 return {kind:root._layoutHidden?'hidden':'empty',message:(root._layoutHidden?'当前面板的显示条件未满足。':'当前没有可显示内容。')+format,canFill:schemas.length>0};
}
