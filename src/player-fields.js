import {normalizePlayerState} from './player-saves.js';
export function stateFieldValue(state,field){
 if(field.owner==='player'||field.owner==='world')return state[field.owner]?.[field.key];
 if(field.owner==='tag')return (state.tags||[]).includes(field.key);
 if(field.owner==='tags')return state.tags||[];
 if(field.owner==='inventory')return state.inventory?.[Number(field.key)]??null;
 if(field.owner==='scoreboard')return state.scores?.[field.objective??field.key.split('/')[0]]?.[field.participant??field.key.split('/').slice(1).join('/')];
}
export function playerFields(snapshot,{all=false,observations=[]}={}){
 const known=new Map(observations.map(record=>[record.id,record])),state=normalizePlayerState(snapshot?.state||{}),records=all?[...observations,...(snapshot?.reads||[])]:snapshot?.action?.kind==='startup'?[]:snapshot?.actionReads||[],byId=new Map();
 for(const record of records)if(['player','world','tag','tags','inventory','scoreboard'].includes(record.owner))byId.set(record.id,{...known.get(record.id),...record,options:record.options?.length?record.options:known.get(record.id)?.options,hints:{...known.get(record.id)?.hints,...record.hints},value:stateFieldValue(state,record)});
 if(all){
  const add=(owner,key,extra={})=>{const id=owner+':'+(owner==='scoreboard'?JSON.stringify([extra.objective,extra.participant]):key);if(!byId.has(id))byId.set(id,{id,owner,key,...extra,value:stateFieldValue(state,{owner,key,...extra})});};
  for(const owner of ['player','world'])for(const key of Object.keys(state[owner]))add(owner,key);
  for(const tag of state.tags)add('tag',tag);
  for(const [objective,scores]of Object.entries(state.scores))for(const participant of Object.keys(scores))add('scoreboard',objective+'/'+participant,{objective,participant,hints:{type:'number'}});
  state.inventory.forEach((item,index)=>{if(item)add('inventory',String(index));});
 }
 return [...byId.values()].sort((a,b)=>a.owner.localeCompare(b.owner)||a.key.localeCompare(b.key,undefined,{numeric:true}));
}
export function fieldKind(field){
 if(field.owner==='inventory')return 'inventory';if(field.owner==='tags')return 'json';if(field.owner==='tag')return 'boolean';if(field.owner==='scoreboard')return 'number';
 const value=field.value??field.hints?.fallback;
 if(typeof value==='string'){try{const parsed=JSON.parse(value);if(parsed&&typeof parsed==='object')return 'json-string';}catch{}return 'string';}
 if(typeof value==='boolean'||typeof value==='number')return typeof value;
 if(value&&typeof value==='object')return 'json';return field.hints?.type||'unknown';
}
export function compactObservations(reads=[]){return reads.slice(-4096).map(({id,owner,key,objective,participant,hints,options,optionSource,sources,readCount,writeCount,write,lastRead,lastWritten})=>({id,owner,key,...(objective!==undefined?{objective,participant}:{}),hints,options,optionSource,sources,readCount,writeCount,write,lastRead,lastWritten}));}

export function mergeObservations(previous=[],next=[]){const map=new Map(previous.map(record=>[record.id,record]));for(const record of next){const old=map.get(record.id);const choices=new Map((old?.options||[]).map(option=>[JSON.stringify(option.value),option]));for(const option of record.options||[])if(record.optionSource?.kind==='array-index'||old?.optionSource?.kind!=='array-index'||!choices.has(JSON.stringify(option.value)))choices.set(JSON.stringify(option.value),option);map.set(record.id,{...old,...record,hints:{...old?.hints,...record.hints},options:[...choices.values()].slice(0,64),sources:[...(old?.sources||[]),...(record.sources||[])].filter((source,index,list)=>list.findIndex(value=>value.file===source.file&&value.line===source.line)===index).slice(0,4)});}return compactObservations([...map.values()]);}
