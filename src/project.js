import {readForms as scriptForms} from './forms.js';
import {nameRules} from './name-rules.js';
import {cached} from './cache.js';
import {parse,nodes} from './core.js';
import {resolveProject} from './resolver.js';
const decode=b=>new TextDecoder().decode(b);
// Static analysis only: never execute imported scripts.
export {readForms as scriptForms} from './forms.js';
export function screens(files){return cached(files,'screens',()=>scanScreens(files))}
function scanScreens(files){const all=[],references=new Set();for(const [file,bytes] of files){if(!/\.json$/i.test(file))continue;const d=resolveProject(files,file).data;if(!d||(!/(^|\/)ui\//.test(file)&&!d.namespace))continue;for(const n of nodes(d)){if(n.name.includes('@'))references.add(n.name.split('@')[1]);if(!n.parent)all.push({file,node:n,namespace:d.namespace||'',id:file+'::'+n.id});}}const forms=scriptForms(files);for(const s of all){s.triggers=nameRules(s.node.obj);s.links=forms.filter(f=>f.fields.some(field=>!field.dynamic&&field.kind==='title'&&field.text.length>0&&s.triggers.some(rule=>rule.name===field.text)));s.referenced=references.has(s.namespace+'.'+s.node.name.split('@')[0]);}const entries=all.filter(s=>(s.triggers.length||!s.referenced)&&(s.node.obj.type==='screen'||s.node.obj.controls||s.links.length||s.triggers.length));return {entries:entries.length?entries:all,forms};}
