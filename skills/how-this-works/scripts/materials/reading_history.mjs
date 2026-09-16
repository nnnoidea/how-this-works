/** Returned-source ranges; never a record of understanding. */
import fs from 'node:fs';
import path from 'node:path';
import {union,subtract} from './coverage.mjs';
const assert=(v,m)=>{if(!v)throw Error(m);};
export function appendReading(study,entry){
 fs.appendFileSync(path.join(study,'reading-history.jsonl'),JSON.stringify(entry)+'\n');
}
export function readingReport(study,files,revision,{path:filter,offset=0,limit=30}={}){
 assert(Number.isInteger(offset)&&offset>=0&&Number.isInteger(limit)&&limit>0&&limit<=200,'invalid pagination');
 const file=path.join(study,'reading-history.jsonl'),events=fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
 const groups=new Map(),byPhase={};let returnedLines=0;
 for(const e of events){
  assert(e.revision===revision,'reading history belongs to another revision');
  byPhase[e.phase]=(byPhase[e.phase]||0)+1;
  for(const p of e.emptyFiles||[]){assert(files.get(p)?.readable&&files.get(p).lines===0,'empty-file reading history mismatch');if(!groups.has(p))groups.set(p,{path:p,spans:[],requests:0,returnedLines:0,units:new Set()});groups.get(p).requests++;}
  for(const r of e.ranges){
   assert(files.get(r.path)?.oid===r.oid,'reading history blob mismatch');
   const g=groups.get(r.path)||{path:r.path,spans:[],requests:0,returnedLines:0,units:new Set()};
   g.spans.push(r);g.requests++;g.returnedLines+=r.end-r.start+1;if(e.unit)g.units.add(e.unit);groups.set(r.path,g);returnedLines+=r.end-r.start+1;
  }
 }
 let uniqueLines=0;
 const rows=[...groups.values()].sort((a,b)=>a.path.localeCompare(b.path)).map(g=>{
  const ranges=union(g.spans).map(({start,end})=>({start,end})),count=ranges.reduce((n,r)=>n+r.end-r.start+1,0);uniqueLines+=count;
  return {path:g.path,requests:g.requests,returnedLines:g.returnedLines,uniqueLines:count,repeatedLines:g.returnedLines-count,ranges,
   notReturned:files.get(g.path).lines?subtract([{start:1,end:files.get(g.path).lines}],ranges):[],units:[...g.units]};
 });
 const matching=filter?rows.filter(r=>r.path.includes(filter)):rows;
 return {revision,summary:{requests:events.length,files:rows.length,returnedLines,uniqueLines,repeatedLines:returnedLines-uniqueLines,byPhase},
  files:matching.slice(offset,offset+limit),total:matching.length,next:offset+limit<matching.length?offset+limit:null,
  note:'Only study read calls are recorded. These are successfully returned ranges, not proof of receipt, reading or understanding. Files absent from this report have no recorded returns; rereading is always allowed.'};
}
