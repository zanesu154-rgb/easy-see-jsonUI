import {glyphAdvance} from './text-layout.js';

export class PreviewFont {
  family='"Microsoft YaHei", sans-serif';
  #glyphs=new Map();#urls=[];#face=null;
  bitmap=char=>this.#glyphs.get(char);
  measure=(char,size)=>{const glyph=this.#glyphs.get(char);return glyph?glyph.advance*size/9:glyphAdvance(char,size);};
  reset(){this.#urls.forEach(URL.revokeObjectURL);this.#urls=[];this.#glyphs.clear();if(this.#face)document.fonts.delete(this.#face);this.#face=null;this.family='"Microsoft YaHei", sans-serif';}
  async load(file){
    if(/\.(ttf|otf|woff2?)$/i.test(file.name)){
      const face=new FontFace('EasySeePreviewFont',await file.arrayBuffer());await face.load();
      this.reset();document.fonts.add(face);this.#face=face;this.family='"EasySeePreviewFont", "Microsoft YaHei", sans-serif';return '预览字体：'+file.name+'（字宽按游戏单位校准）';
    }
    const entries=[];
    if(/\.png$/i.test(file.name))entries.push([file.name,new Uint8Array(await file.arrayBuffer())]);
    else{
      if(!globalThis.JSZip)throw Error('压缩包组件未加载');
      const zip=await JSZip.loadAsync(file);
      for(const entry of Object.values(zip.files))if(!entry.dir&&/(^|\/)glyph_[0-9a-f]{2,4}\.png$/i.test(entry.name))entries.push([entry.name,await entry.async('uint8array')]);
    }
    if(!entries.length)throw Error('未找到 glyph_XX.png 字体页；也可选择 TTF / OTF / WOFF 字体');
    const glyphs=new Map(),urls=[];
    try{
      for(const [path,bytes]of entries){
        const page=parseInt(/glyph_([0-9a-f]+)\.png$/i.exec(path)?.[1]||'',16);
        if(!Number.isFinite(page)||page>0x10ff)throw Error('字体页文件名无效：'+path);
        const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));urls.push(url);
        const image=new Image();image.src=url;await image.decode();
        if(image.width!==image.height||image.width%16!==0||image.width>2048)throw Error('字体页必须为 16×16 格的正方形 PNG：'+path);
        const cell=image.width/16,canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
        const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);const data=context.getImageData(0,0,image.width,image.height).data;
        for(let index=0;index<256;index++){
          const x=index%16*cell,y=Math.floor(index/16)*cell;let left=cell,right=-1,colored=false;
          for(let row=0;row<cell;row++)for(let column=0;column<cell;column++){
            const p=((y+row)*image.width+x+column)*4;
            if(!data[p+3])continue;
            left=Math.min(left,column);right=Math.max(right,column);if(data[p]!==data[p+1]||data[p+1]!==data[p+2])colored=true;
          }
          if(right<left)continue;
          glyphs.set(String.fromCodePoint(page*256+index),{url,x,y,left,cell,colored,inkWidth:right-left+1,sheetWidth:image.width,sheetHeight:image.height,advance:(right-left+1)*8/cell+1});
        }
      }
      if(!glyphs.size)throw Error('字体页没有非透明字形');
      this.reset();this.#glyphs=glyphs;this.#urls=urls;return '预览字体：'+entries.length+' 页，'+glyphs.size+' 个字形';
    }catch(error){urls.forEach(URL.revokeObjectURL);throw error;}
  }
}
