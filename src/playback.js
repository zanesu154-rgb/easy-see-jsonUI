import {compileAnimations,animateScene} from './animations.js';
import {presentScene,clipInsets} from './scene-presentation.js';
const $=id=>document.getElementById(id);
export class Playback {
 external=false;time=0;playing=false;sceneKey='';last=0;request=0;data=null;
 constructor(onFrame,onEvent){
  this.onFrame=onFrame;
  $('animationEnabled').onchange=()=>{if(!$('animationEnabled').checked)this.pause();this.paint();};
  $('playAnimation').onclick=()=>{if(this.playing){this.pause();return;}if(this.time>=this.compiled.duration)this.time=0;$('animationEnabled').checked=true;this.playing=true;this.last=0;this.updateControls();this.request=requestAnimationFrame(this.tick);};
  $('restartAnimation').onclick=()=>{this.pause();this.time=0;$('animationEnabled').checked=true;this.paint();};
  $('animationTime').oninput=()=>{const time=Number($('animationTime').value);this.pause();this.time=time;$('animationEnabled').checked=true;this.paint();};
  $('animationEvent').onchange=()=>{this.pause();this.time=0;onEvent();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});
 }
 pause(){cancelAnimationFrame(this.request);this.playing=false;this.last=0;this.updateControls();}
 tick=now=>{
  if(!this.playing)return;
  if(!this.last){this.last=now;this.paint();}
  if(now-this.last>=33){this.time=Math.min(this.compiled.duration,this.time+(now-this.last)/1000);this.last=now;this.paint();}
  if(this.time>=this.compiled.duration){this.pause();return;}
  this.request=requestAnimationFrame(this.tick);
 };
 setScene(files,file,info,key){
  if(key!==this.sceneKey){this.pause();this.time=0;this.sceneKey=key;}
  this.data={files,file,info};this.compiled=compileAnimations(files,file,info.ns,info.scene.runtime,{event:$('animationEvent').value});
  const select=$('animationEvent'),previous=select.value;select.replaceChildren();
  for(const value of ['',...this.compiled.events]){const option=document.createElement('option');option.value=value;option.textContent=value||'自动动画（无事件限制）';select.append(option);}
  if([...select.options].some(option=>option.value===previous))select.value=previous;
  $('animationTracks').textContent=this.compiled.tracks.length+' 条动画 · 支持位移、透明度、等待与 next 循环'+(this.compiled.warnings.length?' · '+this.compiled.warnings.join('；'):'');
  $('animationTime').max=this.compiled.duration;this.time=Math.min(this.time,this.compiled.duration);this.paint();
 }
 followScript(time){this.external=true;this.pause();this.time=time;$('animationEnabled').checked=true;this.paint();}
 releaseScript(){this.external=false;this.pause();this.time=0;this.paint();}
 updateControls(){
  $('playAnimation').textContent=this.playing?'暂停':'播放';$('playAnimation').disabled=this.external||!this.compiled?.tracks.length;for(const id of ['restartAnimation','animationTime','animationEnabled','animationEvent','dualPreview'])$(id).disabled=this.external;
  if(this.external)$('animationTime').max=Math.max(this.compiled?.duration||10,this.time);$('animationTime').value=this.time;$('animationClock').textContent=this.external?this.time.toFixed(2)+' 秒 · 跟随脚本 tick':this.time.toFixed(2)+' / '+(this.compiled?.duration||10).toFixed(2)+' 秒';
 }
 paint(){
  this.updateControls();if(!this.data)return;
  const {info}=this.data,scene=$('animationEnabled').checked?animateScene(info.ns,info.scene,this.compiled,this.time):info.scene,presentation=presentScene(info.ns,scene,info.states);
  for(const [id,el]of info.elements){const item=presentation.get(id);if(!item)continue;el.hidden=!item.visible;Object.assign(el.style,{left:item.rect.x+'px',top:item.rect.y+'px',opacity:item.opacity,clipPath:clipInsets(item.rect,item.clip)});}
  this.onFrame(this.time,$('animationEnabled').checked);
 }
}
