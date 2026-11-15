import {runtimeObject} from './bindings.js';
export function desktopViewport(resolution,guiScale){const [width,height]=resolution.split(',').map(Number);return {width:Math.round(width/guiScale),height:Math.round(height/guiScale)}}
export function fitScale(width,height,availableWidth,availableHeight){return Math.max(.05,Math.min((availableWidth-32)/width,(availableHeight-32)/height))}
export function sceneForForm(entries,form){const matches=entries.filter(s=>s.links.some(f=>f.id===form.id));return matches.find(s=>s.namespace==='server_form'&&s.node.name==='long_form')||matches.find(s=>s.node.name.endsWith('_screen')&&runtimeObject(s.node.obj,form).visible!==false)|| (matches.length===1?matches[0]:undefined)}
export function titleForScene(screen){for(const trigger of screen.triggers){const value=runtimeObject(screen.node.obj,null,{formTitle:trigger.name});if(value.visible===true)return trigger.name}return undefined;}
