// Project bytes are immutable between edits. Selection never invalidates analysis.
const analyses=new WeakMap();
export function cached(files,key,build){let entries=analyses.get(files);if(!entries){entries=new Map();analyses.set(files,entries)}if(!entries.has(key))entries.set(key,build());return entries.get(key)}
export function invalidate(files){analyses.delete(files)}
