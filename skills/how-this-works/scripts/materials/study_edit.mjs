// Compile small semantic edits into the existing author packet. No extra store or queue.
import {randomUUID} from 'node:crypto';
import {digest} from './study_store.mjs';
const assert=(v,m)=>{if(!v)throw Error(m);};
const fields=(value,allowed,where)=>{
 assert(value&&typeof value==='object'&&!Array.isArray(value),where+' must be an object');
 for(const k of Object.keys(value))assert(allowed.includes(k),where+'.'+k+': unsupported field');
};
const array=(v,where)=>{assert(Array.isArray(v),where+' must be an array');return v;};
const newId=(_rows,prefix)=>prefix+randomUUID();

export function editPacket(previous,input,id){
 fields(input,['unit','explanations','relations','parent'],'edit');
 const p=structuredClone(previous||{unit:{id,parent:null,sections:[],ownership:[],study:{depth:'located',scope:'',reviewedEvidence:[],openQuestions:[],nextReads:[]}},evidence:{},relations:[],parentEvidence:[]});
 p.unit.study||={depth:'located',scope:p.unit.boundary,reviewedEvidence:[],openQuestions:[],nextReads:[]};
 p.unit.ownership||=[];p.relations||=[];p.parentEvidence||=[];
 const changed={explanations:[],relations:[]};
 if(input.unit){
  fields(input.unit,['title','summary','boundary','study'],'unit');
  const {study,...meta}=input.unit;Object.assign(p.unit,meta);
  if(study){
   fields(study,['depth','scope','openQuestions','nextReads'],'unit.study');
   Object.assign(p.unit.study,study);
  }
 }
 if(!previous)p.unit.study.scope||=p.unit.boundary;
 const proof=(items,where,withSupport=false)=>array(items,where).map((item,i)=>{
  const at=where+'['+i+']';
  fields(item,['path','start','end','anchor','kind','label','role','note','reviewed'],at);
  assert(typeof item.path==='string'&&item.path,at+'.path required');
  if(withSupport)assert(['declaration','implementation','test','observation'].includes(item.role)&&item.note,at+': role and note required');
  if(item.reviewed!==undefined)assert(typeof item.reviewed==='boolean',at+'.reviewed must be boolean');
  const {role,note,reviewed,...entry}=item;
  const eid=id+':proof-'+digest(JSON.stringify(entry)).slice(0,12);
  p.evidence[eid]={...entry,id:eid};
  if(reviewed&&!p.unit.study.reviewedEvidence.includes(eid))p.unit.study.reviewedEvidence.push(eid);
  return {evidence:eid,role,note};
 });
 for(const [i,edit] of array(input.explanations===undefined?[]:input.explanations,'explanations').entries()){
  const at='explanations['+i+']';fields(edit,['id','title','text','level','evidence','coverage','remove'],at);
  assert(edit.remove===undefined||typeof edit.remove==='boolean',at+'.remove must be boolean');
  const old=edit.id?p.unit.sections.find(c=>c.id===edit.id):null;
  assert(!edit.id||old,at+'.id: unknown explanation '+edit.id+'; use an id returned by edit/unit');
  const cid=old?.id||newId(p.unit.sections,id+':claim-');
  const replaceCoverage=()=>{
   p.unit.ownership=p.unit.ownership.flatMap(r=>r.sections.includes(cid)?(r.sections.length>1?[{...r,sections:r.sections.filter(s=>s!==cid)}]:[]):[r]);
  };
  if(edit.remove===true){
   assert(old,at+'.remove requires an existing id');
   assert(Object.keys(edit).every(k=>['id','remove'].includes(k)),at+': remove cannot be combined with edits');
   replaceCoverage();p.unit.sections=p.unit.sections.filter(c=>c.id!==cid);
  }else{
   const section={...old,id:cid};
   for(const key of ['title','text','level'])if(edit[key]!==undefined)section[key]=edit[key];
   assert(section.title&&section.text&&['fact','author','inference'].includes(section.level),at+': title, text and level (fact/author/inference) required');
   if(edit.evidence!==undefined){section.support=proof(edit.evidence,at+'.evidence',true);section.evidence=section.support.map(s=>s.evidence);}
   assert(section.evidence?.length,at+'.evidence: at least one source required');
   if(old)p.unit.sections[p.unit.sections.indexOf(old)]=section;else p.unit.sections.push(section);
   if(edit.coverage!==undefined){
    replaceCoverage();
    for(const [j,r] of array(edit.coverage,at+'.coverage').entries()){
     fields(r,['path','start','end','wholeFile','status','note'],at+'.coverage['+j+']');
     assert(['explained','pending'].includes(r.status)&&r.note,at+'.coverage['+j+']: status and note required');
     p.unit.ownership.push({...r,sections:[cid]});
    }
   }
  }
  changed.explanations.push({id:cid,removed:edit.remove===true});
 }
 for(const [i,edit] of array(input.relations===undefined?[]:input.relations,'relations').entries()){
  const at='relations['+i+']';fields(edit,['id','target','kind','label','text','evidence','remove'],at);
  assert(edit.remove===undefined||typeof edit.remove==='boolean',at+'.remove must be boolean');
  const old=edit.id?p.relations.find(r=>r.id===edit.id):null;
  assert(!edit.id||old,at+'.id: unknown relation '+edit.id+'; use an id returned by edit/unit');
  const rid=old?.id||newId(p.relations,id+':relation-');
  if(edit.remove===true){
   assert(old,at+'.remove requires an existing id');
   assert(Object.keys(edit).every(k=>['id','remove'].includes(k)),at+': remove cannot be combined with edits');
   p.relations=p.relations.filter(r=>r.id!==rid);
  }else{
   const relation={...old,id:rid,source:id};
   for(const key of ['target','kind','label','text'])if(edit[key]!==undefined)relation[key]=edit[key];
   assert(['cooperation','feedback'].includes(relation.kind),at+'.kind: use cooperation/feedback; use parent for composition');
   assert(relation.target&&relation.label&&relation.text,at+': target, label and text required');
   if(edit.evidence!==undefined)relation.evidence=proof(edit.evidence,at+'.evidence').map(s=>s.evidence);
   assert(relation.evidence?.length,at+'.evidence: at least one source required');
   if(old)p.relations[p.relations.indexOf(old)]=relation;else p.relations.push(relation);
  }
  changed.relations.push({id:rid,removed:edit.remove===true});
 }
 if(input.parent!==undefined){
  if(input.parent===null){p.unit.parent=null;p.parentEvidence=[];p.parentNote=null;}
  else{
   fields(input.parent,['id','text','evidence'],'parent');
   assert(input.parent.id&&input.parent.id!==id,'parent.id must name a different unit');
   assert(input.parent.text,'parent.text required');
   p.parentEvidence=proof(input.parent.evidence,'parent.evidence').map(s=>s.evidence);
   assert(p.parentEvidence.length,'parent.evidence required');
   p.unit.parent=input.parent.id;p.parentNote=input.parent.text;
  }
 }
 return {payload:p,changed};
}
