import {cached} from './cache.js';
import {parse} from './core.js';

export function imageDimensions(bytes) {
  if(bytes?.length>=24&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);return [v.getUint32(16),v.getUint32(20)];}
  if(bytes?.[0]===255&&bytes?.[1]===216){for(let p=2;p+9<bytes.length;){if(bytes[p]!==255)break;const marker=bytes[p+1];if(marker===217||marker===218)break;const length=(bytes[p+2]<<8)|bytes[p+3];if(length<2)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return [(bytes[p+7]<<8)|bytes[p+8],(bytes[p+5]<<8)|bytes[p+6]];p+=2+length;}}
  return null;
}

export function textureStyle(files,path,obj,rect,url) {
  const info=cached(files,'texture-info:'+path,()=>({dimensions:imageDimensions(files.get(path)),metadata:parse(new TextDecoder().decode(files.get(path.replace(/\.(png|jpe?g)$/i,'.json'))||new Uint8Array())).data}));
  const style={backgroundImage:`url("${url}")`,backgroundSize:'100% 100%',backgroundRepeat:'no-repeat',imageRendering:'pixelated'};
  if(Array.isArray(obj.uv)&&Array.isArray(obj.uv_size)&&info.dimensions&&obj.uv_size.every(v=>typeof v==='number'&&v>0)) {
    const sx=rect.w/obj.uv_size[0],sy=rect.h/obj.uv_size[1];
    style.backgroundSize=`${info.dimensions[0]*sx}px ${info.dimensions[1]*sy}px`;
    style.backgroundPosition=`${-obj.uv[0]*sx}px ${-obj.uv[1]*sy}px`;
  } else if(typeof info.metadata?.nineslice_size==='number'&&info.metadata.nineslice_size>0) {
    const edge=info.metadata.nineslice_size;
    Object.assign(style,{backgroundImage:'none',borderImageSource:`url("${url}")`,borderImageSlice:`${edge} fill`,borderImageWidth:`${edge}px`,borderImageRepeat:'stretch'});
  }
  return style;
}
