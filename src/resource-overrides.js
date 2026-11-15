import {isVanilla,VANILLA} from './resources.js';
// Compare resource-relative paths, ignoring archive wrappers and pack directories.
export function resourcePath(path){const parts=path.replace(/\\/g,'/').split('/');const index=parts.findIndex(p=>['ui','textures','font','texts'].includes(p));return index<0?undefined:parts.slice(index).join('/')}
export function projectResourcePaths(files){return new Set([...files.keys()].filter(p=>!isVanilla(p)).map(resourcePath).filter(Boolean))}
export function removeShadowedVanilla(files){const overridden=projectResourcePaths(files);return new Map([...files].filter(([p])=>!isVanilla(p)||!overridden.has(p.slice(VANILLA.length))))}
