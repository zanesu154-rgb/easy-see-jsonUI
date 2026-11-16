import {isVanilla} from './resources.js';

export const SETTINGS_PATH='.easysee/project.json';
export const isEditorFile=path=>/(^|\/)\.easysee\//.test(path);
const decode=bytes=>new TextDecoder().decode(bytes);
const equal=(a,b)=>a===b||Boolean(a&&b&&a.length===b.length&&a.every((v,i)=>v===b[i]));

export function generatedHeader(source){
  // Only leading comments are evidence. A label containing "generated" is not.
  const header=/^(?:\uFEFF)?\s*((?:(?:\/\/[^\r\n]*(?:\r?\n|$)|\/\*[\s\S]*?\*\/)\s*)*)/.exec(source)?.[1]||'';
  return header.split(/\r?\n/).find(line=>/由\s*.+生成|自动生成|auto[- ]?generated|generated\s+by|do\s+not\s+edit/i.test(line))?.replace(/^\s*(?:\/\/|\/\*|\*)\s*/,'').replace(/\*\/\s*$/,'').trim()||'';
}

export class EditSession{
  originals=new Map();protection=new Map();
  snapshot(){return {originals:new Map(this.originals),protection:new Map(this.protection)};}
  restore(value){this.originals=new Map(value.originals);this.protection=new Map(value.protection);}
  acceptImport(files,{replace=false,changedPaths=[...files.keys()]}={}){
    if(replace){this.originals.clear();this.protection.clear();}
    for(const path of changedPaths)if(files.has(path)&&!isVanilla(path)&&!isEditorFile(path))this.originals.set(path,files.get(path));
  }
  protected(path,bytes){
    if(isVanilla(path))return {locked:true,reason:'原版预览资源只读'};
    const header=bytes?generatedHeader(decode(bytes)):'';
    const locked=this.protection.has(path)?this.protection.get(path):Boolean(header);
    return {locked,reason:locked?(header||'已手动标记为生成文件'):''};
  }
  settings(){return JSON.stringify({version:1,generatedFiles:Object.fromEntries([...this.protection].sort(([a],[b])=>a.localeCompare(b)))},null,2)+'\n';}
  loadSettings(source){
    const value=JSON.parse(source);
    if(value?.version!==1||!value.generatedFiles||typeof value.generatedFiles!=='object'||Array.isArray(value.generatedFiles))throw Error('工程设置格式无效，需要 version: 1 和 generatedFiles 对象。');
    const entries=Object.entries(value.generatedFiles);
    for(const [path,flag]of entries)if(typeof flag!=='boolean'||!path||path.startsWith('/')||path.includes('\\')||path.split('/').includes('..'))throw Error('生成文件标记无效：'+path);
    this.protection=new Map(entries);
  }
  changes(files){
    const result=[];
    for(const path of new Set([...this.originals.keys(),...files.keys()])){
      if(isVanilla(path)||isEditorFile(path))continue;
      const before=this.originals.get(path),after=files.get(path);
      if(equal(before,after))continue;
      result.push({path,before,after,kind:!before?'added':!after?'removed':'modified'});
    }
    return result.sort((a,b)=>a.path.localeCompare(b.path));
  }
}
