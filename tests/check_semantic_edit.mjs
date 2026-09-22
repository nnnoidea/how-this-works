import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {build,readPage,pageText,readBatch,READ_LIMITS} from '../skills/how-this-works/scripts/materials/materials.mjs';
import {initStudy,editUnit,readUnit,studyCoverage,exportStudy,readForStudy,studyReadings,updateProgress,updateProject} from '../skills/how-this-works/scripts/materials/study.mjs';

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'semantic-edit-')),checks=[];
const check=(name,fn)=>{fn();checks.push(name);};
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v));
const load=p=>JSON.parse(fs.readFileSync(p));
const cli=path.resolve('skills/how-this-works/scripts/materials/study.mjs');
try{
 check('Module APIs can be imported directly from stdin without treating - as a file',()=>{
  const output=execFileSync(process.execPath,['--input-type=module','-'],{input:"import {importHistory} from './skills/how-this-works/scripts/materials/study.mjs'; console.log(typeof importHistory);",encoding:'utf8'});
  assert.equal(output.trim(),'function');
 });
 const revision='e'.repeat(40),nodes=[];
 for(const [file,text,kind] of [
  ['migration.md',Array.from({length:87},(_,i)=>`line ${i+1}`).join('\n'),'document'],
  ['src.ts','export const value = 1;\n','code'],
  ['escaping.txt',Array.from({length:80},()=> '\t'.repeat(1000)+'"\\中文').join('\n'),'document'],
  ['empty.txt','','document']]){
  const raw='raw-'+nodes.length+'.txt',oid=crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
  fs.writeFileSync(path.join(temp,raw),text);nodes.push({id:file,path:file,kind,oid,text_file:raw,lines:text?text.trimEnd().split('\n').length:0});
 }
 const atlas=path.join(temp,'atlas.json'),index=path.join(temp,'index'),study=path.join(temp,'study');
 save(atlas,{repo:'test/edit',revision,nodes,edges:[]});await build({atlas,out:index});
 initStudy({index,out:study,target:'architecture',data:{intro:{title:'Fixture',text:'Explain a return value.'}}});
 let root,first,second,child,edge;
 const evidence={path:'src.ts',start:1,end:1,role:'implementation',note:'The return value.',reviewed:true};
 check('Create a responsibility before detailed explanations; incomplete export is refused',()=>{
  root=editUnit({study,data:{unit:{title:'Return a value',summary:'A return boundary.',boundary:'Only this fixture.'}}});
  assert.equal(readUnit({study,id:root.id}).unit.sections.length,0);
  assert.throws(()=>exportStudy(study,path.join(temp,'incomplete.json')),/claims/);
 });
 check('Inline evidence generates IDs; citation and explanation coverage remain independent',()=>{
  const r=editUnit({study,id:root.id,data:{explanations:[
   {title:'Return',text:'Returns one.',level:'fact',evidence:[evidence]},
   {title:'Migration boundary',text:'A declaration about migration.',level:'author',evidence:[{path:'migration.md',start:3,end:25,role:'declaration',note:'Declared boundary.'}],coverage:[{path:'migration.md',start:3,end:25,status:'explained',note:'Declaration scope.'}]}
  ]}});[first,second]=r.changed.explanations.map(c=>c.id);
  const p=readUnit({study,id:root.id});assert.equal(p.unit.study.reviewedEvidence.length,1);
  assert.equal(studyCoverage(study).summary.explainedLines,23);assert(!p.unit.ownership.some(r=>r.path==='src.ts'));
 });
 check('One text or range edit preserves every unrelated explanation and citation',()=>{
  const before=readUnit({study,id:root.id}),other=structuredClone(before.unit.sections[1]);
  const text='Literal `backtick` $HOME $(do-not-run) "quote"\n中文';
  const edit={explanations:[{id:first,text}]};
  const r=JSON.parse(execFileSync(process.execPath,[cli,'edit','--study',study,'--id',root.id,'--from','-'],{input:JSON.stringify(edit),encoding:'utf8'}));
  assert(r.saved);const after=readUnit({study,id:root.id});assert.equal(after.unit.sections[0].text,text);assert.deepEqual(after.unit.sections[1],other);
  assert.deepEqual(after.unit.sections[0].evidence,before.unit.sections[0].evidence);
  editUnit({study,id:root.id,data:{explanations:[{id:first,coverage:[{path:'src.ts',start:1,end:1,status:'explained',note:'Return declaration.'}]}]}});
  assert.equal(studyCoverage(study).summary.explainedLines,24);
  assert(JSON.stringify(edit).length<JSON.stringify(before).length/3);
 });
 check('Actual failed range shape reports file, item and legal bounds without damaging saved work',()=>{
  const before=fs.readFileSync(root.path);
  assert.throws(()=>editUnit({study,id:root.id,data:{explanations:[{id:second,coverage:[{path:'migration.md',start:21,end:149,status:'explained',note:'Invalid former input.'}]}]}}),/ownership\[.*migration.md.*valid lines 1\.\.87/);
  assert.deepEqual(fs.readFileSync(root.path),before);
  assert.throws(()=>editUnit({study,id:root.id,data:{explanations:[{id:first,text:'Must not save'},{id:'missing',text:'Bad reference'}]}}),/explanations\[1\].id.*unknown/);
  assert.deepEqual(fs.readFileSync(root.path),before);
 });
 check('Narrow reads return editable inline evidence and preserve stable IDs through a round trip',()=>{
  const r=readUnit({study,id:root.id,explanation:first});assert.equal(r.explanations.length,1);assert.equal(r.explanations[0].evidence[0].path,'src.ts');
  editUnit({study,id:root.id,data:{explanations:r.explanations}});
  assert.equal(readUnit({study,id:root.id}).unit.sections[0].id,first);
 });
 check('Parent input requires an explicit rationale and creates exactly one composition edge',()=>{
  child=editUnit({study,data:{unit:{title:'Inspect a declaration',summary:'Reads a declaration.',boundary:'One statement.'},explanations:[{title:'Inspect',text:'Reads one value.',level:'fact',evidence:[evidence]}]}});
  assert.throws(()=>editUnit({study,id:child.id,data:{parent:{id:root.id,text:'Part of return.'}}}),/parent.evidence/);
  editUnit({study,id:child.id,data:{parent:{id:root.id,text:'Inspects the returned declaration.',evidence:[{path:'src.ts',start:1,end:1}]}}});
  const file=path.join(temp,'model.json');exportStudy(study,file);assert.equal(load(file).edges.filter(e=>e.kind==='composition').length,1);
  assert.throws(()=>editUnit({study,id:child.id,data:{relations:[{target:root.id,kind:'composition'}]}}),/use parent/);
 });
 check('Relations can be created, corrected and removed without replacing the unit',()=>{
  const before=readUnit({study,id:child.id}).unit;
  const r=editUnit({study,id:child.id,data:{relations:[{target:root.id,kind:'feedback',label:'Check result',text:'Reports what was inspected.',evidence:[{path:'src.ts',start:1,end:1}]}]}});edge=r.changed.relations[0].id;
  editUnit({study,id:child.id,data:{relations:[{id:edge,text:'Revised result boundary.'}]}});
  assert.equal(readUnit({study,id:child.id,relation:edge}).relations[0].text,'Revised result boundary.');
  assert.deepEqual(readUnit({study,id:child.id}).unit,before);
  editUnit({study,id:child.id,data:{relations:[{id:edge,remove:true}]}});assert.equal(readUnit({study,id:child.id}).relations.length,0);
 });
 check('Explanation deletion removes only its coverage; no permanent reused claim IDs',()=>{
  editUnit({study,id:root.id,data:{explanations:[{id:second,remove:true}]}});
  assert.equal(studyCoverage(study).summary.explainedLines,1);
  const r=editUnit({study,id:root.id,data:{explanations:[{title:'Another statement',text:'Returns one.',level:'fact',evidence:[evidence]}]}});
  assert.notEqual(r.changed.explanations[0].id,second);
 });
 check('Oversized former read requests cannot override the source or envelope budgets',()=>{
  assert.throws(()=>readPage(index,{path:'migration.md',maxLines:2600,maxChars:200000}),/maxLines.*use next/);
  assert.throws(()=>readBatch(index,{revision,ranges:[{path:'migration.md',start:1,end:85}],maxChars:200000}),/maxChars/);
  let r=readPage(index,{path:'escaping.txt',maxChars:16000}),all=[];
  while(true){assert(JSON.stringify(r).length<READ_LIMITS.responseChars);assert(pageText(r).length<READ_LIMITS.responseChars);all.push(...r.blocks.flatMap(b=>b.text.split('\n').map(s=>Number(s.split(':')[0]))));if(!r.next)break;r=readPage(index,r.next);}
  assert.deepEqual(all,Array.from({length:80},(_,i)=>i+1));
 });
 check('Paging still allows rereads without implying coverage or understanding',()=>{
  const before=studyCoverage(study).summary;readForStudy({study,request:{path:'migration.md',start:1,end:2}});readForStudy({study,request:{path:'migration.md',start:1,end:2}});
  assert.equal(studyReadings(study).summary.repeatedLines,2);assert.deepEqual(studyCoverage(study).summary,before);
 });
 const scene={id:'return-task',label:'Read a return value',description:'A concrete task.',start:'A caller requests a value.',outcome:'The value is inspected.',steps:[{title:'Return the value',text:'Read the declaration and inspect its result.',nodes:[root.id,root.id],claims:[first]}]};
 check('Scene references do not repeat responsibility buttons; invalid explanation ownership blocks export',()=>{
  updateProject({study,data:{scenarios:[scene]}});const file=path.join(temp,'scene-model.json');exportStudy(study,file);
  assert.deepEqual(load(file).scenarios[0].nodes,[root.id]);
  assert.deepEqual(load(file).scenarios[0].steps[0].nodes,[root.id]);
  const bad=structuredClone(scene);bad.steps[0].nodes=[child.id];updateProject({study,data:{scenarios:[bad]}});
  assert.throws(()=>exportStudy(study,file),/scenario return-task step 1.*participating/);
  updateProject({study,data:{scenarios:[scene]}});
 });
 updateProgress({study,data:{stage:'deepening',summary:'The return boundary and its inspection are understood.',remaining:['Most fixture material is not explained.']}});
 const output=process.env.SEMANTIC_EDIT_UI_OUT||path.join(temp,'delivery');
 const result=JSON.parse(execFileSync(process.execPath,[cli,'build','--study',study,'--out',output,'--ui',process.env.SEMANTIC_EDIT_UI_OUT?'true':'false'],{encoding:'utf8'}));
 check('Counts and build outcome are derived without modifying authored understanding or gaps',()=>{
  const data=load(path.join(output,'understanding.json'));assert.equal(result.statistics.units,2);assert.equal(result.statistics.claims,3);assert.equal(result.statistics.relations,1);
  assert.equal(data.delivery.status,'built');assert.equal(data.delivery.ui,!!process.env.SEMANTIC_EDIT_UI_OUT);
  assert.equal(data.research.summary,'The return boundary and its inspection are understood.');assert(result.coverage.gapFiles>0);
 });
 check('Agent can fetch one complete scenario without embedding every process in overview',()=>{
  const manifest=load(path.join(output,'agent/manifest.json'));assert.equal(manifest.scenarios[0].stepCount,1);assert.equal(manifest.scenarios[0].steps,undefined);
  const result=JSON.parse(execFileSync(process.execPath,[path.resolve('skills/how-this-works/scripts/materials/materials.mjs'),'scenario','--index',path.join(output,'agent'),'--id',scene.id],{encoding:'utf8'}));
  assert.deepEqual(result.steps[0].claims,[first]);assert.equal(result.start,scene.start);
 });
 console.log(JSON.stringify({status:'passed',checks},null,2));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
