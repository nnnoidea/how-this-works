// Assignment coverage is explicit author data, never inferred from citations.
const assert=(v,m)=>{if(!v)throw Error(m);};
export function union(spans){
 const out=[];for(const r of spans.map(r=>({...r})).sort((a,b)=>a.start-b.start||a.end-b.end)){
  const last=out.at(-1);if(last&&r.start<=last.end+1)last.end=Math.max(last.end,r.end);else out.push(r);
 }return out;
}
const length=rs=>rs.reduce((n,r)=>n+r.end-r.start+1,0);
export function subtract(base,cut){
 const out=[];const cs=union(cut);for(const b of union(base)){
  let start=b.start;for(const c of cs){if(c.end<start)continue;if(c.start>b.end)break;if(c.start>start)out.push({start,end:c.start-1});start=Math.max(start,c.end+1);}
  if(start<=b.end)out.push({start,end:b.end});
 }return out;
}
export function validateOwnership(model,files){
 for(const n of model.nodes)for(const [i,r] of (n.ownership||[]).entries()){
  const f=files.get(r.path);assert(f,'ownership path not found: '+r.path);
  assert(['pending','explained'].includes(r.status)&&r.note,'ownership needs status and note');
  if(f.readable&&f.lines>0)assert(Number.isInteger(r.start)&&Number.isInteger(r.end)&&r.start>=1&&r.end>=r.start&&r.end<=f.lines,`invalid ownership range: unit ${n.id}, ownership[${i}], ${r.path} ${r.start}..${r.end}; valid lines 1..${f.lines}`);
  else assert(r.wholeFile===true&&r.start===undefined&&r.end===undefined,'non-readable/empty ownership needs wholeFile: '+r.path);
  assert(Array.isArray(r.sections)&&r.sections.every(id=>n.sections.some(c=>c.id===id)),'ownership sections must belong to this unit');
  if(r.status==='explained')assert(r.sections.length,'explained ownership must point to an explanation');
 }
}
export function coverageReport(model,files){
 validateOwnership(model,files);const owners=new Map();
 for(const n of model.nodes)for(const [i,r] of (n.ownership||[]).entries()){const rows=owners.get(r.path)||[];rows.push({...r,unit:n.id,title:n.title});owners.set(r.path,rows);}
 const records=[];
 for(const f of files.values()){
  const assigned=owners.get(f.path)||[],hasLines=f.readable&&f.lines>0;
  const mapped=hasLines?union(assigned):[],explained=hasLines?union(assigned.filter(r=>r.status==='explained')):[];
  const uncovered=hasLines?subtract([{start:1,end:f.lines}],mapped):[];
  const pending=hasLines?subtract(mapped,explained):[];
  const fullyMapped=hasLines?!uncovered.length:assigned.length>0;
  const fullyExplained=hasLines?length(explained)===f.lines:assigned.some(r=>r.status==='explained');
  records.push({path:f.path,oid:f.oid,kind:f.kind,readable:f.readable,lines:f.lines||0,bytes:f.bytes,
   status:fullyExplained?'explained':!assigned.length?'unassigned':fullyMapped?'pending':'partial',
   mappedLines:length(mapped),explainedLines:length(explained),unassigned:uncovered,pending,
   owners:assigned,contentVerified:false,unreadableReason:f.readable?null:f.scan});
 }
 const summary={files:records.length,fullyAssignedFiles:records.filter(f=>!['unassigned','partial'].includes(f.status)).length,
  fullyExplainedFiles:records.filter(f=>f.status==='explained').length,gapFiles:records.filter(f=>f.status!=='explained').length,
  unreadableFiles:records.filter(f=>!f.readable).length,totalLines:records.filter(f=>f.readable).reduce((n,f)=>n+f.lines,0),
  assignedLines:records.reduce((n,f)=>n+f.mappedLines,0),explainedLines:records.reduce((n,f)=>n+f.explainedLines,0)};
 return {revision:model.revision,summary,semanticTruthChecked:false,
  note:'Coverage measures explicit explanation assignments, not semantic correctness. All materials remain in the denominator; binary/empty files use file-level assignments.',files:records};
}
