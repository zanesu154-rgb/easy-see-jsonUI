import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
http.createServer(async(req,res)=>{try{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root+path.sep)&&p!==root)throw Error();const f=p===root||p.endsWith(path.sep)?path.join(p,'index.html'):p;res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','js':'text/javascript','css':'text/css'})[f.split('.').pop()]||'application/octet-stream');res.end(await readFile(f));}catch{res.statusCode=404;res.end('Not found');}}).listen(5173,'127.0.0.1',()=>console.log('http://localhost:5173'));
