// Pinned versions occupy separate keys. Cache failure never blocks preview.
const database='easy-see-official-resources';
export class ResourceCache {
 constructor(version){this.version=version;}
 async open(){
  if(!globalThis.indexedDB)return null;
  if(!this.connection)this.connection=new Promise(resolve=>{
   const request=indexedDB.open(database,1);let settled=false;
   const finish=value=>{if(settled){value?.close();return;}settled=true;clearTimeout(timer);resolve(value);};
   const timer=setTimeout(()=>finish(null),3000);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('files'))request.result.createObjectStore('files');};
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();this.connection=null;};finish(db);};
   request.onerror=request.onblocked=()=>finish(null);
  });
  return this.connection;
 }
 key(path){return this.version+'/'+path;}
 async get(path){
  try{const db=await this.open();if(!db)return null;return await new Promise(resolve=>{const tx=db.transaction('files'),request=tx.objectStore('files').get(this.key(path));request.onsuccess=()=>resolve(request.result?new Uint8Array(request.result):null);request.onerror=()=>resolve(null);tx.onabort=()=>resolve(null);});}catch{return null;}
 }
 async put(path,bytes){
  try{const db=await this.open();if(!db)return false;return await new Promise(resolve=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(new Uint8Array(bytes),this.key(path));tx.oncomplete=()=>resolve(true);tx.onabort=tx.onerror=()=>resolve(false);});}catch{return false;}
 }
 async inspect(clear=false){
  const result={count:0,bytes:0,available:false};
  try{const db=await this.open();if(!db)return result;result.available=true;return await new Promise(resolve=>{
   const tx=db.transaction('files',clear?'readwrite':'readonly'),request=tx.objectStore('files').openCursor();
   request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;if(String(cursor.key).startsWith(this.version+'/')){result.count++;result.bytes+=cursor.value.byteLength||0;if(clear)cursor.delete();}cursor.continue();};
   tx.oncomplete=tx.onerror=tx.onabort=()=>resolve(result);
  });}catch{return result;}
 }
 async clear(){return this.inspect(true);}
}
