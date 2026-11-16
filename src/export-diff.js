import {diffLines} from '../vendor/diff/diff/line.js';

// Timeout keeps reviewing a completely rewritten large file responsive. Exact
// original/current text is still available in the fallback, never a guessed diff.
export function lineChanges(before,after){
  const parts=diffLines(before,after,{timeout:150,maxEditLength:20000});
  if(!parts)return {fallback:true,before,after,rows:[]};
  let oldLine=1,newLine=1;const rows=[];
  for(const part of parts){
    const lines=part.value.match(/[^\n]*\n|[^\n]+$/g)||[];
    for(const text of lines){
      rows.push({kind:part.added?'add':part.removed?'remove':'same',old:part.added?null:oldLine++,new:part.removed?null:newLine++,text});
    }
  }
  const changed=rows.map((row,i)=>row.kind==='same'?-1:i).filter(i=>i>=0),keep=new Set();
  for(const i of changed)for(let j=Math.max(0,i-3);j<=Math.min(rows.length-1,i+3);j++)keep.add(j);
  const visible=[];let previous=-1;
  for(const i of [...keep].sort((a,b)=>a-b)){if(i>previous+1)visible.push({kind:'gap',text:'…'});visible.push(rows[i]);previous=i;}
  return {fallback:false,rows:visible};
}

export function decodeText(bytes){
  if(!bytes)return '';
  try{const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);return text.includes('\0')?null:text;}
  catch{return null;}
}
