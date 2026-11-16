import {stripFormatting} from './text.js';

export function fieldSample(field){
  if(!field)return '';
  if(!field.dynamic)return field.text||'';
  const parts=field.parts;
  // Unparsed/nested interpolation is never displayed as JavaScript source.
  return parts?.every(part=>part===null||!String(part).includes('${'))?parts.map(part=>part??'示例').join(''):'示例';
}

export function staticConstants(source) {
  const values=new Map();
  for(const m of source.matchAll(/\b(?:const|let|var)\s+([\w$]+)\s*=\s*(['"])((?:\\.|(?!\2).)*)\2\s*(?=[;,\n])/g)) values.set(m[1],m[3].replace(/\\n/g,'\n').replace(/\\(['"\\])/g,'$1'));
  return values;
}

function partsFor(expression,constants) {
  const text=expression.trim();
  if((text[0]==='"'||text[0]==="'")&&text.at(-1)===text[0]&&!new RegExp('(?<!\\\\)'+text[0]).test(text.slice(1,-1)))return [text.slice(1,-1).replace(/\\n/g,'\n').replace(/\\(['"\\])/g,'$1')];
  if(text[0]==='`'&&text.at(-1)==='`') {
    const parts=[],body=text.slice(1,-1);let start=0;
    for(const m of body.matchAll(/\$\{([^{}]*)\}/g)){parts.push(body.slice(start,m.index));const name=m[1].trim();parts.push(constants.has(name)?constants.get(name):null);start=m.index+m[0].length;}
    parts.push(body.slice(start).replace(/\\n/g,'\n'));return parts;
  }
  if(constants.has(text))return [constants.get(text)];
  // Split concatenations outside strings/brackets; never evaluate JavaScript.
  const chunks=[];let quote='',depth=0,start=0;
  for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}if(['"',"'",'`'].includes(c))quote=c;else if('([{'.includes(c))depth++;else if(')]}'.includes(c))depth--;else if(c==='+'&&depth===0){chunks.push(text.slice(start,i));start=i+1;}}
  if(chunks.length){chunks.push(text.slice(start));return chunks.flatMap(v=>partsFor(v,constants));}
  return [null];
}

export function titleDescriptor(expression,constants=new Map()) {
  const parts=partsFor(expression,constants),dynamic=parts.includes(null);
  if(!parts.some(p=>p!==null&&stripFormatting(p).trim()))return null;
  const text=parts.map(p=>p===null?'…':p).join('');
  return {text,display:stripFormatting(text),dynamic,parts};
}

export function titleMatchesRule(field,rule) {
  if(!field.dynamic)return rule.kind==='包含 / 子串条件'?field.text.includes(rule.name):field.text===rule.name;
  const prefix=field.parts?.slice(0,field.parts.indexOf(null)).join('');
  return Boolean(prefix&&(rule.name.startsWith(prefix)||prefix.startsWith(rule.name)));
}

export function formConstants(files,file,source) {
  const local=staticConstants(source),decoder=new TextDecoder();
  for(const m of source.matchAll(/\bimport\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    if(!m[2].startsWith('.'))continue;
    const path=decodeURIComponent(new URL(m[2],'https://local/'+file).pathname.slice(1));
    const bytes=files.get(path);if(!bytes)continue;
    const exported=staticConstants(decoder.decode(bytes));
    for(const spec of m[1].split(',')){const [original,alias]=spec.trim().split(/\s+as\s+/);if(exported.has(original)&&!local.has(alias||original))local.set(alias||original,exported.get(original));}
  }
  return local;
}

export function firstArgument(source,start) {
  let quote='',depth=0;
  for(let i=start;i<source.length;i++){const c=source[i];if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}if(['"',"'",'`'].includes(c))quote=c;else if('([{'.includes(c))depth++;else if(')]}'.includes(c)){if(c===')'&&depth===0)return source.slice(start,i);depth--;}else if(c===','&&depth===0)return source.slice(start,i);}
  return '';
}
