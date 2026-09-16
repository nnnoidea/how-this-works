import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const digest=v=>crypto.createHash('sha256').update(v).digest('hex');
export const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8'));
/** Author input may be an object, inline JSON, stdin, or a legacy JSON file. */
export function readInput(value){
 if(value&&typeof value==='object')return structuredClone(value);
 if(typeof value!=='string'||!value.trim())throw Error('JSON input required');
 if(value==='-'){
  if(process.stdin.isTTY)throw Error('provide JSON on stdin');
  return JSON.parse(fs.readFileSync(0,'utf8'));
 }
 if(value.trimStart().startsWith('{')||value.trimStart().startsWith('['))return JSON.parse(value);
 return readJSON(value.startsWith('@')?value.slice(1):value);
}
export function atomicJSON(p,v){
 fs.mkdirSync(path.dirname(p),{recursive:true});const tmp=p+'.'+process.pid+'.tmp';
 try{fs.writeFileSync(tmp,JSON.stringify(v,null,2)+'\n');fs.renameSync(tmp,p);}finally{fs.rmSync(tmp,{force:true});}
}
export const studyContentHash=entries=>digest(entries.map(([name,hash])=>name+'\0'+hash).join('\n'));
export function sourceHash(dir,locked=false){
 if(!locked&&fs.existsSync(path.join(dir,'WRITE_LOCK')))throw Error('study write in progress; retry after completion');
 const files=['project.json',...fs.readdirSync(path.join(dir,'units')).filter(f=>f.endsWith('.json')).sort().map(f=>'units/'+f)];
 return studyContentHash(files.map(f=>[f,digest(fs.readFileSync(path.join(dir,f)))]));
}
export function assertStudyCurrent(model){
 const origin=model+'.origin.json';if(!fs.existsSync(origin))return;
 const o=readJSON(origin);if(sourceHash(path.resolve(path.dirname(model),o.study))!==o.sourceHash)throw Error('study changed: export and rebuild before using this model');
 if(digest(fs.readFileSync(model))!==o.exportHash)throw Error('exported model edited directly: update units and export again');
}
export function withLock(dir,fn){
 const lock=path.join(dir,'WRITE_LOCK');try{fs.mkdirSync(lock);}catch{throw Error('study is locked; do not write concurrently (after a crashed writer, inspect and remove WRITE_LOCK)');}
 try{return fn();}finally{fs.rmdirSync(lock);}
}
