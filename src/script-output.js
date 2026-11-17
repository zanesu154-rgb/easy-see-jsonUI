import {cached} from './cache.js';
import {instantiateCollections} from './collections.js';
import {inferChannels,channelValue} from './simulation-tools.js';
// HUD selection follows the package's channel prefixes, including factory templates.
// No package-specific control names, storage keys, or title formats live here.
export function scriptHudScreen(files,simulation,entries,current){
 const targets=cached(files,'script-hud-targets',()=>entries.filter(entry=>entry.namespace==='hud'||/(?:^|\/)hud_screen\.json$/i.test(entry.file)||entry.insertions?.some(value=>/(?:^|\/)hud_screen\.json$/i.test(value.file))).map(entry=>{
  const name=entry.node.name,obj=entry.node.obj;
  const expanded=obj.factory?instantiateCollections({[name]:obj},files,entry.file,{},null,{rootName:name,previewFactory:true}).data[name]:obj;
  return {entry,schemas:inferChannels(expanded,files)};
 }));
 const matches=targets.map(target=>({...target,matched:target.schemas.filter(schema=>{const value=channelValue(simulation,schema.channel);return schema.prefix&&value.startsWith(schema.prefix);})})).filter(target=>target.matched.length);
 matches.sort((a,b)=>Math.max(...b.matched.map(schema=>schema.prefix.length))-Math.max(...a.matched.map(schema=>schema.prefix.length)));
 return matches.find(target=>target.entry.id===current)?.entry||matches[0]?.entry;
}
