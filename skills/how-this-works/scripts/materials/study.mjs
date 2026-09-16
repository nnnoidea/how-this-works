#!/usr/bin/env node
/** Small authoring transactions; no model calls and no repository execution. */
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {currentManifest,validateModel,modelHash,verifyOriginals,readPage,readRequestOptions,pageText,build} from './materials.mjs';
import {coverageReport} from './coverage.mjs';
import {digest,readJSON,readInput,atomicJSON,sourceHash,studyContentHash,withLock} from './study_store.mjs';
import {prepareMaterials} from './prepare.mjs';
import {appendReading,readingReport} from './reading_history.mjs';
import {editPacket} from './study_edit.mjs';
import {validateHistory} from './history.mjs';
import {addToSite} from '../site.mjs';
const assert=(v,m)=>{if(!v)throw Error(m);};
const key=id=>digest(id).slice(0,24)+'.json';
const unitPath=(dir,id)=>path.join(dir,'units',key(id));
const materialIdentity=files=>digest(JSON.stringify([...files.values()].map(f=>[f.path,f.oid,f.lines,f.readable]).sort((a,b)=>a[0].localeCompare(b[0]))));
const researchState=project=>project.research||{target:'complete',stage:'architecture',summary:'',remaining:[]};
const targetName=value=>{assert(['architecture','complete'].includes(value),'target must be architecture or complete');return value;};
const unitNames=dir=>fs.readdirSync(path.join(dir,'units')).filter(f=>f.endsWith('.json')).sort();
function context(dir,project=readJSON(path.join(dir,'project.json'))){
 const index=path.resolve(dir,project.materialIndex);
 const manifest=currentManifest(index,{snapshot:true});
 const files=new Map(readJSON(path.join(index,'catalog.json')).map(f=>[f.path,f]));
 assert(manifest.revision===project.revision&&materialIdentity(files)===project.materialIdentity,'material snapshot changed: use a new study');
 return {project,index,files};
}
function aggregate(dir){
 const projectBytes=fs.readFileSync(path.join(dir,'project.json'));
 const {project,index,files}=context(dir,JSON.parse(projectBytes)),{materialIndex,materialIdentity:identity,...meta}=project;
 const model={...meta,research:researchState(project),nodes:[],edges:[],evidence:{}};
 const sourceEntries=[['project.json',digest(projectBytes)]];
 for(const name of unitNames(dir)){
  const bytes=fs.readFileSync(path.join(dir,'units',name)),p=JSON.parse(bytes);sourceEntries.push(['units/'+name,digest(bytes)]);
  model.nodes.push(p.unit);model.edges.push(...(p.relations||[]));
  for(const [id,e] of Object.entries(p.evidence||{})){
   assert(!model.evidence[id]||modelHash(model.evidence[id])===modelHash(e),'conflicting shared evidence: '+id);model.evidence[id]=e;
  }
  if(p.unit.parent&&p.parentEvidence?.length)model.edges.push({id:p.unit.id+':parent',source:p.unit.parent,target:p.unit.id,kind:'composition',label:'组成',text:p.parentNote||'作者记录的单元归属。',evidence:p.parentEvidence});
 }
 model.nodes.sort((a,b)=>a.id.localeCompare(b.id));model.edges.sort((a,b)=>a.id.localeCompare(b.id));
 return {model,index,files,sourceHash:studyContentHash(sourceEntries)};
}
function unresolved(model){
 const ids=new Set(model.nodes.map(n=>n.id));return [
  ...model.nodes.filter(n=>n.parent&&!ids.has(n.parent)).map(n=>({unit:n.id,target:n.parent,kind:'parent'})),
  ...model.edges.filter(e=>!ids.has(e.source)||!ids.has(e.target)).map(e=>({relation:e.id,source:e.source,target:e.target,kind:'relation'})),
  ...(model.scenarios||[]).flatMap(s=>s.nodes.filter(id=>!ids.has(id)).map(id=>({scenario:s.id,target:id,kind:'scenario'})))];
}
export function initStudy({out,index,from,data,model:existing,target='complete'}){
 targetName(target);
 assert([from,data,existing].filter(v=>v!==undefined).length===1,'provide exactly one of from, data, or model');
 from=data??from;
 assert(out&&index&&(from||existing),'init --out study --index materials --from project.json (or --model existing.json)');
 assert(!fs.existsSync(out)||!fs.readdirSync(out).length,'study directory must be empty');
 const manifest=currentManifest(index),files=new Map(readJSON(path.join(index,'catalog.json')).map(f=>[f.path,f]));
 const input=readInput(existing||from);
 if(existing)validateModel(input,files,manifest.revision);
 assert(existing||!input.research,'use target/progress commands to record research progress');
 const {nodes,edges,evidence,research:discard,...meta}=input;
 if(meta.scenarios)meta.scenarios=meta.scenarios.map(s=>s.steps?{...s,nodes:[...new Set(s.steps.flatMap(step=>step.nodes))]}:s);
 assert(meta.intro?.title&&meta.intro?.text,'project introduction required');
 assert(!meta.revision||meta.revision===manifest.revision,'project revision differs from materials');
 assert(!meta.repo||meta.repo===manifest.repo,'project repo differs from materials');
 fs.mkdirSync(path.join(out,'units'),{recursive:true});
 atomicJSON(path.join(out,'project.json'),{...meta,research:{target,stage:'architecture',summary:'',remaining:[]},schema_version:existing?(meta.schema_version||2):3,repo:manifest.repo,revision:manifest.revision,materialIndex:path.relative(path.resolve(out),path.resolve(index)),materialIdentity:materialIdentity(files)});
 if(existing)for(const n of nodes){
  const relations=edges.filter(e=>e.source===n.id),refs=new Set([...n.sections.flatMap(c=>c.evidence),...(n.study?.reviewedEvidence||[]),...relations.flatMap(e=>e.evidence)]);
  atomicJSON(unitPath(out,n.id),{unit:n,relations,evidence:Object.fromEntries([...refs].map(id=>[id,evidence[id]]))});
 }
 return {study:path.resolve(out),revision:manifest.revision,units:nodes?.length||0,sourceHash:sourceHash(out)};
}
export function putUnit({study,from,payload,id,expected}){
 assert((from!==undefined)!==(payload!==undefined),'provide exactly one of from or payload');
 from=payload??from;
 assert(study&&from,'put --study dir --from unit.json [--id stable-id]');
 return withLock(study,()=>saveUnit(study,readInput(from),id,expected));
}
function saveUnit(study,p,id,expected){
  const {project,index,files}=context(study);
  assert(p.unit&&p.evidence,'payload needs unit and evidence');
  id=id||p.unit.id||'unit-'+digest(p.unit.title||'').slice(0,12);assert(id&&typeof id==='string','unit id required');
  const target=unitPath(study,id),previous=fs.existsSync(target)?readJSON(target):null;
  assert(!expected||(previous&&digest(JSON.stringify(previous))===expected),'unit changed: reload before replacing');
  assert(!previous||previous.unit.id===id,'unit storage identity mismatch');
  const n=structuredClone(p.unit);n.id=id;n.parent??=null;
  const qualify=local=>local.startsWith(id+':')?local:id+':'+local;
  const em=new Map(Object.keys(p.evidence).map(k=>[k,qualify(k)]));
  const cm=new Map(n.sections.map(c=>{const local=c.id||'claim-'+digest(c.title||c.text||'').slice(0,12);return [local,qualify(local)];}));
  const refs=rs=>(rs||[]).map(k=>{assert(em.has(k),'missing local evidence: '+k);return em.get(k);});
  const evidence={};
  for(const [local,entry] of Object.entries(p.evidence)){
   const e={...entry,id:em.get(local)},f=files.get(e.path);assert(f?.readable,'evidence file unavailable: '+e.path);
   if(e.anchor){const detail=readJSON(path.join(index,'files',key(e.path))),a=detail.anchors.find(a=>a.id===e.anchor);assert(a,'anchor not found');e.start=a.start;e.end=a.end;delete e.anchor;}
   e.kind??=f.kind;e.label??=path.basename(e.path)+':'+e.start+'–'+e.end;evidence[e.id]=e;
  }
  n.sections=n.sections.map(c=>{
   const local=c.id||'claim-'+digest(c.title||c.text||'').slice(0,12);
   return {...c,id:cm.get(local),evidence:refs(c.evidence),support:c.support?.map(s=>({...s,evidence:refs([s.evidence])[0]}))};
  });
  if(n.study)n.study.reviewedEvidence=refs(n.study.reviewedEvidence);
  n.ownership=(n.ownership||[]).map(r=>({...r,sections:(r.sections||[]).map(k=>{assert(cm.has(k),'ownership references unknown local section: '+k+'; valid sections: '+[...cm.keys()].join(', '));return cm.get(k);})}));
  const relations=p.relations===undefined?(previous?.relations||[]):p.relations.map(e=>({...e,id:qualify(e.id||'rel-'+digest([e.target,e.kind,e.label].join(':')).slice(0,12)),source:e.source||id,evidence:refs(e.evidence)}));
  const parentEvidence=p.parentEvidence===undefined?(previous?.parentEvidence||[]):refs(p.parentEvidence);
  // Validate each complete unit immediately. Cross-unit references may remain drafts until export.
  validateModel({schema_version:3,repo:project.repo,revision:project.revision,intro:project.intro,nodes:[{...n,parent:null}],edges:[],evidence},files,project.revision,{draft:true});
  const combinedEvidence={...(previous?.evidence||{}),...evidence};
  for(const e of relations){assert(e.source===id,'relation writer owns the source unit');assert(['cooperation','composition','feedback'].includes(e.kind)&&e.text&&e.evidence?.length,'relation needs kind, explanation and evidence');assert(e.evidence.every(r=>combinedEvidence[r]),'missing relationship evidence');}
  // Verify cited original bytes as well as their ranges before saving.
  verifyOriginals(index,Object.values(evidence).map(e=>files.get(e.path)));
  const result={unit:n,evidence:combinedEvidence,relations,parentEvidence,parentNote:p.parentNote===undefined?previous?.parentNote:p.parentNote};
  atomicJSON(target,result);
  return {id,unitHash:digest(JSON.stringify(result)),path:target,claims:n.sections.length,ownershipRanges:n.ownership.length,saved:true,
   note:previous?'Unit updated. Revisit the overall explanation only if this change affects the project architecture.':undefined};
}
export function editUnit({study,id,from,data,expected}){
 assert((from!==undefined)!==(data!==undefined),'provide exactly one of from or data');
 const input=readInput(data??from);
 assert(id||input.unit?.title,'new unit needs unit.title; existing edits need --id');
 return withLock(study,()=>{
  const unitId=id||'unit-'+randomUUID();
  const target=unitPath(study,unitId);
  if(id)assert(fs.existsSync(target),'unknown unit: '+id);
  const previous=id?readJSON(target):null;
  const {payload,changed}=editPacket(previous,input,unitId);
  const result=saveUnit(study,payload,unitId,expected);
  return {...result,changed};
 });
}
export function readUnit({study,id,explanation,relation}){
 const p=readJSON(unitPath(study,id));assert(p.unit.id===id,'unknown unit: '+id);
 const unitHash=digest(JSON.stringify(p));
 assert(!(explanation&&relation),'select explanation or relation, not both');
 if(!explanation&&!relation)return {...p,unitHash};
 const item=explanation?p.unit.sections.find(c=>c.id===explanation):p.relations.find(r=>r.id===relation);
 assert(item,'unknown '+(explanation?'explanation':'relation')+': '+(explanation||relation));
 const {support,source,...value}=item;
 value.evidence=item.evidence.map(eid=>{
  const {id:discard,...entry}=p.evidence[eid],s=support?.find(s=>s.evidence===eid);
  return {...entry,...(explanation?{role:s?.role,note:s?.note,reviewed:p.unit.study?.reviewedEvidence?.includes(eid)||false}:{})};
 });
 if(explanation)value.coverage=p.unit.ownership.filter(r=>r.sections.includes(explanation)).map(({sections,...r})=>r);
 return {id,unitHash,[explanation?'explanations':'relations']:[value]};
}
export function studyCoverage(dir,{offset=0,limit=30,path:filter,all=false}={}){
 const {model,files}=aggregate(dir),report=coverageReport(model,files);
 const rows=report.files.filter(f=>(all||f.status!=='explained')&&(!filter||f.path.includes(filter)));
 assert(Number.isInteger(offset)&&offset>=0&&Number.isInteger(limit)&&limit>0&&limit<=200,'invalid pagination');
 return {...report,files:rows.slice(offset,offset+limit),total:rows.length,next:offset+limit<rows.length?offset+limit:null,unresolved:unresolved(model)};
}
export function exportStudy(dir,out){
 assert(out&&!path.resolve(out).startsWith(path.resolve(dir,'units')+path.sep)&&path.resolve(out)!==path.resolve(dir,'project.json'),'export outside author unit files');
 return withLock(dir,()=>{
  const {model,files,sourceHash:authorHash}=aggregate(dir);validateModel(model,files,model.revision);
  atomicJSON(out,model);atomicJSON(out+'.origin.json',{study:path.relative(path.dirname(path.resolve(out)),path.resolve(dir)),sourceHash:authorHash,exportHash:digest(fs.readFileSync(out))});
  return {model:path.resolve(out),modelHash:modelHash(model),coverage:coverageReport(model,files).summary,research:model.research};
 });
}
export function updateProject({study,from,data}){
 assert((from!==undefined)!==(data!==undefined),'provide exactly one of from or data');
 const patch=readInput(data??from);
 return withLock(study,()=>{
  const project=readJSON(path.join(study,'project.json'));
  for(const k of Object.keys(patch))assert(['intro','scenarios','omitted','validationNote','displayName'].includes(k),'project field cannot be changed: '+k);
  if(patch.scenarios)patch.scenarios=patch.scenarios.map(s=>s.steps?{...s,nodes:[...new Set(s.steps.flatMap(step=>step.nodes))]}:s);
  const next={...project,...patch};assert(next.intro?.title&&next.intro?.text,'project introduction required');
  atomicJSON(path.join(study,'project.json'),next);return {saved:true,repo:next.repo,revision:next.revision};
 });
}
export function importHistory({study,collection,from,data}){
 assert(collection&&(from!==undefined)!==(data!==undefined),'history needs collection and exactly one of from/data');
 const script=fileURLToPath(new URL('../evolution.py',import.meta.url));
 const history=JSON.parse(execFileSync('python3',[script,'export','--events','-','--collection',collection],{input:JSON.stringify(readInput(data??from)),encoding:'utf8',maxBuffer:16*1024*1024}));
 return withLock(study,()=>{
  const {model}=aggregate(study);validateHistory(history,model);
  const project=readJSON(path.join(study,'project.json'));project.history=history;
  atomicJSON(path.join(study,'project.json'),project);
  return {saved:true,events:history.events.length,revision:history.revision};
 });
}
export function setTarget({study,target}){
 targetName(target);
 return withLock(study,()=>{
  const project=readJSON(path.join(study,'project.json'));project.research={...researchState(project),target};
  atomicJSON(path.join(study,'project.json'),project);return {target,saved:true};
 });
}
export function updateProgress({study,from,data}){
 assert((from!==undefined)!==(data!==undefined),'provide exactly one of from or data');
 const input=readInput(data??from);
 assert(['architecture','deepening','complete'].includes(input.stage),'stage must be architecture, deepening or complete');
 assert(typeof input.summary==='string'&&Array.isArray(input.remaining)&&input.remaining.every(x=>typeof x==='string'),'progress needs summary and remaining');
 return withLock(study,()=>{
  const project=readJSON(path.join(study,'project.json'));
  if(input.stage==='complete'){
   const {model,files}=aggregate(study);validateModel(model,files,model.revision);
   assert(model.nodes.length&&coverageReport(model,files).summary.gapFiles===0,'complete requires zero explanation gaps');
  }
  project.research={target:researchState(project).target,stage:input.stage,summary:input.summary,remaining:input.remaining};
  atomicJSON(path.join(study,'project.json'),project);return {saved:true,research:project.research};
 });
}
export function studyStatus(study,{offset=0,limit=20}={}){
 assert(Number.isInteger(offset)&&offset>=0&&Number.isInteger(limit)&&limit>0&&limit<=200,'invalid pagination');
 const project=readJSON(path.join(study,'project.json')),names=unitNames(study);
 const items=names.slice(offset,offset+limit).map(name=>readJSON(path.join(study,'units',name)).unit);
 return {revision:project.revision,intro:project.intro,research:researchState(project),
  units:{items:items.map(n=>({id:n.id,parent:n.parent,title:n.title,summary:n.summary,depth:n.study?.depth||'unrecorded',openQuestions:n.study?.openQuestions.length||0,nextReads:n.study?.nextReads.length||0})),
   total:names.length,next:offset+limit<names.length?offset+limit:null}};
}
export function readForStudy({study,unit,reason,request,snapshot=false}){
 assert(!unit||typeof unit==='string','unit must be a stable id or intended unit name');assert(!reason||typeof reason==='string','reason must be text');
  const project=readJSON(path.join(study,'project.json')),index=path.resolve(study,project.materialIndex),phase=researchState(project).stage;
  assert(!request?.revision||request.revision===project.revision,'request/study revision mismatch');
  const result=readPage(index,{...request,revision:project.revision},{snapshot});
  const receipt={at:new Date().toISOString(),revision:project.revision,phase,unit:unit||null,reason:reason||null,
   ranges:result.blocks.map(({path,oid,start,end})=>({path,oid,start,end})),emptyFiles:result.emptyFiles};
  try{appendReading(study,receipt);return {...result,recorded:true,phase};}
  catch(error){return {...result,recorded:false,phase,recordingError:error.message};}
}
export function studyReadings(study,options={}){
 const {project,files}=context(study);return readingReport(study,files,project.revision,options);
}
async function main(){
 const [cmd,...args]=process.argv.slice(2),o={};
 if(!cmd||cmd==='--help'||args.includes('--help')){
  console.log(JSON.stringify({purpose:'Prepare materials, write one researched unit, calculate gaps, and build a fixed understanding graph.',commands:{
   prepare:'--repo bare.git --revision ref --name owner/repo --out prepared [--python python3]',
   init:'--index material-index --out study (--from -|inline-JSON|project.json | --model existing-model.json) [--target architecture|complete (default complete)]',
   edit:'--study study --from -|JSON [--id existing-unit-id --expected unitHash]; unit metadata, explanations with inline evidence/coverage, relations or parent',
   target:'--study study --target architecture|complete; keeps units, evidence and reading history',
   status:'--study study [--offset 0 --limit 20]',
   progress:'--study study --from -|JSON|file; input: {stage:architecture|deepening|complete,summary,remaining:[string]}',
   read:'--study study (--path path [--start N --end N --anchor id] | --requests -|JSON|file) [--unit id --reason text --max-lines 200 --max-chars 12000 --format text|json --snapshot true]',
   readings:'--study study [--path substring --offset 0 --limit 30]; returned ranges, never an understanding score',
   project:'--study study [--from -|inline-JSON|metadata-patch.json]',put:'--study study --from -|inline-JSON|unit.json [--id stable-id] [--expected unitHash]',
   history:'--study study --collection history-collection --from -|JSON|events.json; validates historical references and imports their excerpts',
   unit:'--study study --id unit-id [--explanation claim-id | --relation relation-id]',coverage:'--study study [--path substring] [--offset 0] [--limit 30] [--all true]',
   export:'--study study --out model.json',build:'--study study --out delivery [--site how-this-works-site] [--repo bare.git] [--atlas data.json] [--ui false]'},
   input:'Use --from - with JSON on stdin to save directly, without a request file or patch. Module API accepts initStudy({data}), editUnit({data,id?}), updateProject({data}). putUnit is the full-packet import/replacement API.',
   contracts:'references/current-model.md',result:'JSON; build also writes build-summary.json, prepare writes preparation.json. No repository code or semantic model is executed.'},null,2));return;
 }
 for(let i=0;i<args.length;i+=2){assert(args[i].startsWith('--')&&args[i+1]!==undefined,'expected --key value');o[args[i].slice(2)]=args[i+1];}
 const started=performance.now();let result,textOutput=false;
 if(cmd==='prepare')result=await prepareMaterials(o);
 else if(cmd==='init')result=initStudy(o);
 else if(cmd==='put')result=putUnit(o);
 else if(cmd==='edit')result=editUnit(o);
 else if(cmd==='target')result=setTarget(o);
 else if(cmd==='progress')result=updateProgress(o);
 else if(cmd==='history')result=importHistory(o);
 else if(cmd==='status')result=studyStatus(o.study,{offset:Number(o.offset||0),limit:Number(o.limit||20)});
 else if(cmd==='readings')result=studyReadings(o.study,{path:o.path,offset:Number(o.offset||0),limit:Number(o.limit||30)});
 else if(cmd==='read'){
  assert(!o.format||['text','json'].includes(o.format),'format must be text or json');
  const request=readRequestOptions(o);
  result=readForStudy({...o,request,snapshot:o.snapshot==='true'});textOutput=o.format!=='json';
 }
 else if(cmd==='project'){
  if(o.from)result=updateProject(o);
  else result=readJSON(path.join(o.study,'project.json'));
 }
 else if(cmd==='unit')result=readUnit(o);
 else if(cmd==='coverage')result=studyCoverage(o.study,{offset:Number(o.offset||0),limit:Number(o.limit||30),path:o.path,all:o.all==='true'});
 else if(cmd==='export')result=exportStudy(o.study,o.out);
 else if(cmd==='build'){
  assert(o.out,'build needs output directory');fs.mkdirSync(o.out,{recursive:true});
  const exported=exportStudy(o.study,path.join(o.out,'author-model.json')),{index}=context(o.study);
  const binding=readJSON(path.join(index,'source.json')),atlas=o.atlas||(binding.atlas&&path.resolve(index,binding.atlas));
  assert(atlas,'build needs --atlas for older material indices');
  const built=await build({atlas,model:exported.model,out:path.join(o.out,'agent'),web:o.out,repo:o.repo});
  const builder=fileURLToPath(new URL('../build_web.mjs',import.meta.url));
  if(o.ui!=='false'){
   assert(fs.existsSync(builder),'skill web builder missing; reinstall the complete skill');
   execFileSync(process.execPath,[builder,'--out',path.resolve(o.out)],{stdio:'pipe'});
  }
  result={...exported,output:path.resolve(o.out),index:path.resolve(o.out,'agent'),understandingGraph:o.ui==='false'?null:path.resolve(o.out,'index.html'),statistics:built};
 }
 else throw Error('unknown study command; use --help');
 const output={...result,elapsedMs:Math.round(performance.now()-started)};
 if(cmd==='build'){
  const web=path.join(o.out,'understanding.json'),data=readJSON(web);
  data.delivery={status:'built',ui:o.ui!=='false'};atomicJSON(web,data);
  if(o.ui!=='false')output.site=addToSite(o.out,o.site);
  output.elapsedMs=Math.round(performance.now()-started);
  atomicJSON(path.join(o.out,'build-summary.json'),output);
  if(output.site)atomicJSON(path.join(output.site.project,'build-summary.json'),output);
 }
 if(textOutput)process.stdout.write(pageText(result)+(result.recorded?`recorded: returned ranges (${result.phase}); not proof of understanding\n`:`not recorded: ${result.recordingError}\n`));
 else console.log(JSON.stringify(output));
}
if(process.argv[1]&&fs.existsSync(process.argv[1])&&fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url)))main().catch(e=>{console.error(e.message);process.exitCode=1;});
