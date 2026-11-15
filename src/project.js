import {unchangedRoot} from './baseline.js';
import {isVanilla} from './resources.js';
import {readForms as scriptForms} from './forms.js';
import {nameRules} from './name-rules.js';
import {cached} from './cache.js';
import {parse,nodes} from './core.js';
import {resolveProject} from './resolver.js';
const decode=b=>new TextDecoder().decode(b);
// Static analysis only: never execute imported scripts.
export {readForms as scriptForms} from './forms.js';
export function screens(files,showUnchanged=false){const result=cached(files,'screens',()=>scanScreens(files));return showUnchanged?{...result,entries:[...result.entries,...result.unchanged]}:result}
function scanScreens(files){const all=[],references=new Set();for(const [file,bytes] of files){if(isVanilla(file)||!/\.json$/i.test(file))continue;const d=resolveProject(files,file).data;if(!d||(!/(^|\/)ui\//.test(file)&&!d.namespace))continue;for(const n of nodes(d)){if(n.name.includes('@'))references.add(n.name.split('@')[1]);if(!n.parent)all.push({file,node:n,namespace:d.namespace||'',id:file+'::'+n.id});}}const forms=scriptForms(files);for(const s of all){s.triggers=nameRules(s.node.obj);s.links=forms.filter(f=>f.fields.some(field=>!field.dynamic&&field.kind==='title'&&field.text.length>0&&s.triggers.some(rule=>rule.name===field.text)));s.referenced=references.has(s.namespace+'.'+s.node.name.split('@')[0]);}const entries=all.filter(s=>(s.triggers.length||!s.referenced)&&(s.node.obj.type==='screen'||s.node.obj.controls||s.links.length||s.triggers.length));const unchanged=all.filter(s=>unchangedRoot(files,s.file,s.node.path[0]));const candidates=(entries.length?entries:all).filter(s=>!unchanged.includes(s));const seen=new Set();return {entries:candidates.filter(s=>{const key=s.namespace+'::'+s.node.name+'::'+JSON.stringify(s.node.obj);if(seen.has(key))return false;seen.add(key);return true}),forms,unchanged};}
