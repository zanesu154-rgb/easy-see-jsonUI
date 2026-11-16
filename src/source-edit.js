import {parseTree,findNodeAtLocation,getNodeValue,modify,applyEdits,createScanner,SyntaxKind} from '../vendor/jsonc-parser/main.js';

// textarea.value normalises CRLF to LF. Restore the file's convention on input,
// and return the exact bytes' text for a visually unchanged source document.
export function sourceInput(value,original){
  if(value===original.replace(/\r\n?/g,'\n'))return original;
  return original.includes('\r\n')?value.replace(/\r?\n/g,'\r\n'):value;
}

// JSONC offsets are UTF-16 offsets, just like string.slice. Keep BOM length.
export function sourceTree(source){
  const errors=[],tree=parseTree(source.replace(/^\uFEFF/,' '),errors,{allowTrailingComma:true});
  if(errors.length||!tree)throw Error('源码存在 JSONC 语法错误，请先修复后再修改属性。');
  return tree;
}

function uniquePath(tree,path){
  let node=tree;
  for(const key of path){
    if(node?.type==='object'){
      const matches=node.children.filter(p=>p.children[0].value===key);
      if(matches.length>1)throw Error('编辑路径含重复键：'+key+'，请先在源码中消除歧义。');
      node=matches[0]?.children[1];
    }else if(node?.type==='array')node=node.children[key];
    else return;
  }
}

function formatting(source){
  const indent=/^[\t ]+(?="[^"\r\n]+"\s*:)/m.exec(source)?.[0]||'  ';
  return {insertSpaces:!indent.includes('\t'),tabSize:indent.includes('\t')?4:indent.length,eol:source.includes('\r\n')?'\r\n':'\n'};
}

function retainedComments(source){
  const scanner=createScanner(source),comments=[];
  for(let token=scanner.scan();token!==SyntaxKind.EOF;token=scanner.scan()){
    if(token===SyntaxKind.LineCommentTrivia||token===SyntaxKind.BlockCommentTrivia){
      const comment=source.slice(scanner.getTokenOffset(),scanner.getTokenOffset()+scanner.getTokenLength());
      comments.push(comment+(token===SyntaxKind.LineCommentTrivia?(source.includes('\r\n')?'\r\n':'\n'):' '));
    }
  }
  return comments.join('');
}

function removeProperty(source,node){
  const property=node.parent;
  if(property?.type!=='property')throw Error('这里只支持清除对象属性。');
  const end=property.offset+property.length;
  const edits=[{offset:property.offset,length:property.length,content:retainedComments(source.slice(property.offset,end))}];
  const scanner=createScanner(source,true);scanner.setPosition(end);
  if(scanner.scan()===SyntaxKind.CommaToken)edits.push({offset:scanner.getTokenOffset(),length:1,content:''});
  else{
    const siblings=property.parent.children,index=siblings.indexOf(property);
    if(index>0){
      scanner.setPosition(siblings[index-1].offset+siblings[index-1].length);
      if(scanner.scan()===SyntaxKind.CommaToken)edits.push({offset:scanner.getTokenOffset(),length:1,content:''});
    }
  }
  return edits;
}

export function editValue(source,path,value){
  const tree=sourceTree(source);uniquePath(tree,path);
  if(!findNodeAtLocation(tree,path.slice(0,-1)))throw Error('控件已变化，请重新选择后再修改。');
  const edits=[];
  function collect(node,next){
    const previous=getNodeValue(node);
    if(JSON.stringify(previous)===JSON.stringify(next))return;
    // Preserve comments and spacing inside arrays (offset/size/color), and only
    // replace the leaves that actually changed.
    if(node.type==='array'&&Array.isArray(next)&&node.children.length===next.length){
      node.children.forEach((child,i)=>collect(child,next[i]));return;
    }
    edits.push({offset:node.offset,length:node.length,content:retainedComments(source.slice(node.offset,node.offset+node.length))+JSON.stringify(next)});
  }
  const node=findNodeAtLocation(tree,path);
  if(node&&value!==undefined)collect(node,value);
  else if(node)edits.push(...removeProperty(source,node));
  else edits.push(...modify(source.replace(/^\uFEFF/,' '),path,value,{formattingOptions:formatting(source)}));
  const result=applyEdits(source,edits);
  sourceTree(result);
  return result;
}
