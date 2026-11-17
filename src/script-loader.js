// Babel handles lexical scope, live import references, re-exports and circular CommonJS modules.
// A package never receives a network resolver or the host's require().
export function createScriptLoader({Babel,runtime,sources,onProgress=()=>{}}){
 const cache=new Map(),loaded=[];
 function resolve(from,specifier){
  if(specifier==='@minecraft/server'||specifier==='@minecraft/server-ui')return specifier;
  if(!specifier.startsWith('.'))throw Error('不支持外部模块：'+specifier+'（来自 '+from+'）');
  const parts=[];for(const part of (from.slice(0,from.lastIndexOf('/')+1)+specifier).split('/')){if(part==='..'){if(!parts.length)throw Error('模块路径越界');parts.pop();}else if(part&&part!=='.')parts.push(part);}
  const path=parts.join('/');for(const key of [path,path+'.js',path+'/index.js'])if(Object.hasOwn(sources,key))return key;
  throw Error('未找到模块：'+specifier+'（来自 '+from+'）');
 }
 const external=(object,name)=>new Proxy(object,{get(target,key){if(typeof key==='string'&&!Object.hasOwn(target,key)&&!['__esModule','then'].includes(key))runtime.missing(name+'.'+key);return target[key];}});
 const server=external(runtime.server,'@minecraft/server'),ui=external(runtime.ui,'@minecraft/server-ui');
 function load(file){
  if(file==='@minecraft/server')return server;if(file==='@minecraft/server-ui')return ui;
  if(cache.has(file)){const cached=cache.get(file);if(cached.error)throw cached.error;return cached.exports;}
  if(!Object.hasOwn(sources,file))throw Error('脚本入口不存在：'+file);
  const module={exports:{}};cache.set(file,module);loaded.push(file);onProgress(file);
  try{
   const result=Babel.transform(sources[file],{filename:file,sourceType:'module',babelrc:false,configFile:false,retainLines:true,plugins:['transform-dynamic-import',['transform-modules-commonjs',{importInterop:'none'}]]});
   const code=result.code+'\n//# sourceURL=easysee-pack:///'+encodeURI(file).replace(/[\r\n]/g,'');
   new Function('require','module','exports',code)(specifier=>load(resolve(file,specifier)),module,module.exports);
  }catch(thrown){const error=thrown instanceof Error?thrown:new Error(String(thrown));error.file||=file;module.error=error;throw error;}
  return module.exports;
 }
 return {load,loaded};
}
