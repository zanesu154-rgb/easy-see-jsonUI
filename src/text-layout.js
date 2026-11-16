import {fontMetrics} from './font.js';
import {textRuns} from './text.js';

// GUI advances, including spacing. Glyph shapes do not determine wrapping.
export function glyphAdvance(char,size=9){
  let advance=6;
  if(char===' ')advance=4;
  else if(char==='\t')advance=16;
  else if(/[il]/.test(char)&&char.length===1)advance=3;
  else if(/[.,!:;'|]/.test(char)&&char.length===1)advance=2;
  else if(/[It()[\]{}]/.test(char)&&char.length===1)advance=4;
  else if(char==='×')advance=5;
  else if('、。，．：；'.includes(char))advance=4;
  else if(char.codePointAt(0)>255)advance=9;
  return advance*size/9;
}

export function layoutText(obj={},maxWidth=Infinity,measure=glyphAdvance){
  const font=fontMetrics(obj),limit=Math.max(0,maxWidth),lineHeight=font.lineHeight+(Number(obj.line_padding)||0);
  const lines=[{glyphs:[],width:0}];
  for(const run of textRuns(obj.text??''))for(const char of run.text){
    if(char==='\r')continue;
    if(char==='\n'){lines.push({glyphs:[],width:0});continue;}
    const width=measure(char,font.fontSize);let line=lines.at(-1);
    if(line.glyphs.length&&line.width+width>limit+1e-7){line={glyphs:[],width:0};lines.push(line);}
    line.glyphs.push({char,width,style:run.style});line.width+=width;
  }
  return {lines,w:Math.min(limit,Math.max(0,...lines.map(line=>line.width))),h:lines.length*lineHeight,lineHeight};
}

let inkContext;const inkWidths=new Map();
export function resetGlyphInk(){inkWidths.clear();}
export function paintGameText(el,obj,textLayout,{family='"Microsoft YaHei", sans-serif',bitmap=()=>null,stretch=false}={}){
  const font=fontMetrics(obj),scale=font.fontSize/9;
  el.style.textAlign=obj.text_alignment||(obj.type==='button'?'center':'left');
  el.style.whiteSpace='pre';
  for(const line of textLayout.lines){
    const row=document.createElement('div');row.className='game-text-line';row.style.height=textLayout.lineHeight+'px';row.style.lineHeight=textLayout.lineHeight+'px';
    for(const glyph of line.glyphs){
      const slot=document.createElement('span');slot.className='game-glyph';slot.style.width=glyph.width+'px';Object.assign(slot.style,glyph.style);
      const image=bitmap(glyph.char);
      if(image){
        const ink=document.createElement('span');ink.className='bitmap-glyph';
        const pixelScale=8/image.cell*scale;
        Object.assign(ink.style,{width:image.inkWidth*pixelScale+'px',height:8*scale+'px',backgroundImage:`url("${image.url}")`,backgroundSize:`${image.sheetWidth*pixelScale}px ${image.sheetHeight*pixelScale}px`,backgroundPosition:`${-(image.x+image.left)*pixelScale}px ${-image.y*pixelScale}px`});
        if(!image.colored){ink.style.backgroundImage='none';Object.assign(ink.style,{backgroundColor:'currentColor',maskImage:`url("${image.url}")`,maskSize:`${image.sheetWidth*pixelScale}px ${image.sheetHeight*pixelScale}px`,maskPosition:`${-(image.x+image.left)*pixelScale}px ${-image.y*pixelScale}px`,maskRepeat:'no-repeat'});}
        const text=document.createElement('span');text.className='glyph-text-alternative';text.textContent=glyph.char;ink.append(text);slot.append(ink);
      }else{
        slot.style.fontFamily=family;slot.style.fontSize=8*scale+'px';
        if(stretch&&/^[!-~]$/.test(glyph.char)){
          inkContext??=document.createElement('canvas').getContext('2d');
          const key=family+'|'+scale+'|'+glyph.char;
          if(!inkWidths.has(key)){inkContext.font=`${8*scale}px ${family}`;inkWidths.set(key,inkContext.measureText(glyph.char).width);if(inkWidths.size>4096)inkWidths.delete(inkWidths.keys().next().value);}
          const ink=document.createElement('span');ink.className='stretched-glyph';ink.textContent=glyph.char;
          ink.style.cssText=`display:inline-block;transform-origin:left center;transform:scaleX(${Math.max(0,glyph.width-scale)/Math.max(.01,inkWidths.get(key))})`;slot.append(ink);
        }else slot.textContent=glyph.char;
      }
      row.append(slot);
    }
    el.append(row);
  }
}
