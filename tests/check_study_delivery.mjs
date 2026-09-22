import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {build} from '../skills/how-this-works/scripts/materials/materials.mjs';
import {initStudy,editUnit,updateProject,updateProgress,setTarget,checkStudy,studyStatus} from '../skills/how-this-works/scripts/materials/study.mjs';

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'study-delivery-'));
const cli=path.resolve('skills/how-this-works/scripts/materials/study.mjs');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const checks=[];
try{
 const text='export function run() {\n return 1;\n}\n',revision='a'.repeat(40);
 const oid=crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
 const atlas=path.join(temp,'atlas.json'),index=path.join(temp,'materials'),study=path.join(temp,'study'),delivery=path.join(temp,'delivery');
 fs.writeFileSync(path.join(temp,'source.txt'),text);
 fs.writeFileSync(atlas,JSON.stringify({repo:'fixture/delivery',revision,nodes:[{id:'src.ts',path:'src.ts',kind:'code',oid,text_file:'source.txt',lines:3}],edges:[]}));
 await build({atlas,out:index});
 const intro={title:'Return a value',text:'A small project with one entry point.'};
 const invalidIntro={...intro,example:{kind:'illustration',text:'The caller receives one.'}};
 const invalidStudy=path.join(temp,'invalid-example');
 assert.throws(()=>initStudy({index,out:invalidStudy,target:'architecture',data:{intro:invalidIntro}}),/intro.example must be a string/);
 assert(!fs.existsSync(invalidStudy));
 const implicit=initStudy({index,out:path.join(temp,'default-study'),data:{intro}});
 assert.equal(implicit.research.target,'complete');
 assert.throws(()=>checkStudy({study:implicit.study,target:'architecture'}),/target mismatch/);
 assert.throws(()=>checkStudy({study:implicit.study}),/target must be/);
 const initialized=initStudy({index,out:study,target:'architecture',data:{intro}});
 assert.equal(initialized.research.target,'architecture');
 assert.equal(initialized.research.stage,'architecture');
 const initialProject=fs.readFileSync(path.join(study,'project.json'),'utf8');
 assert.throws(()=>updateProject({study,data:{intro:invalidIntro}}),/intro.example must be a string/);
 assert.equal(fs.readFileSync(path.join(study,'project.json'),'utf8'),initialProject);
 fs.writeFileSync(path.join(study,'project.json'),JSON.stringify({...JSON.parse(initialProject),intro:invalidIntro}));
 assert.throws(()=>checkStudy({study,target:'architecture'}),/intro.example must be a string/);
 fs.writeFileSync(path.join(study,'project.json'),initialProject);
 updateProject({study,data:{intro:{...intro,example:'Illustrative: the caller receives one.'}}});
 checks.push('Example objects are rejected before initialization, during updates, and by delivery validation; failed writes preserve existing data.');
 const unit=editUnit({study,data:{unit:{title:'Produce a result',summary:'Return one.',boundary:'Only this fixture.'},
  explanations:[{title:'Return a constant',text:'The function returns 1.',level:'fact',
   evidence:[{path:'src.ts',start:2,end:2,role:'implementation',note:'The return statement.',reviewed:true}],
   coverage:[{path:'src.ts',start:2,end:2,status:'explained',note:'The return statement.'}]}]}});
 const claim=unit.changed.explanations[0].id;
 const runBuild=(...args)=>execFileSync(process.execPath,[cli,'build','--study',study,'--out',delivery,'--atlas',atlas,'--ui','false',...args],{encoding:'utf8',stdio:['pipe','pipe','pipe']});
 const preview=JSON.parse(runBuild());
 assert(!preview.deliveryCheck);assert(fs.existsSync(path.join(delivery,'understanding.json')));
 const prior=()=>Object.fromEntries(['author-model.json','author-model.json.origin.json','understanding.json','agent/manifest.json','build-summary.json'].map(f=>[f,fs.readFileSync(path.join(delivery,f),'utf8')]));
 let saved=prior();
 assert.throws(()=>runBuild('--target','architecture'),/still being established/);
 assert.deepEqual(prior(),saved);
 assert.equal(studyStatus(study).research.stage,'architecture');
 checks.push('Draft builds remain usable; a checked delivery cannot silently advance the stage or overwrite a preview.');

 updateProgress({study,data:{stage:'deepening',summary:'The entry and its result establish this tiny project.',remaining:[]}});
 assert.throws(()=>checkStudy({study,target:'architecture'}),/authored scenario/);
 const overview={id:'all',label:'Overview',description:'Structural navigation, not a process.',nodes:[unit.id]};
 updateProject({study,data:{scenarios:[overview]}});
 assert.throws(()=>checkStudy({study,target:'architecture'}),/authored scenario/);
 const legacy={id:'read',label:'Read a result',description:'An old unit shortcut.',nodes:[unit.id]};
 updateProject({study,data:{scenarios:[overview,legacy]}});
 assert.throws(()=>checkStudy({study,target:'architecture'}),/scenario needs steps: read/);
 assert(!JSON.parse(runBuild()).deliveryCheck);
 saved=prior();assert.throws(()=>runBuild('--target','architecture'),/scenario needs steps: read/);assert.deepEqual(prior(),saved);
 checks.push('Missing scenarios, overview-only navigation, and legacy shortcuts cannot satisfy final delivery; previews remain available.');

 const scenario={id:'read',label:'Read the result',description:'Use the entry point.',start:'The caller needs a value.',outcome:'The caller receives 1.',
  steps:[{title:'Call the entry',text:'Call run to receive 1.',nodes:[unit.id],claims:[claim]}]};
 updateProject({study,data:{scenarios:[{...scenario,steps:[{...scenario.steps[0],claims:['absent']}]}]}});
 assert.throws(()=>checkStudy({study,target:'architecture'}),/explanations must belong/);
 updateProject({study,data:{scenarios:[scenario]}});
 const before=fs.readFileSync(path.join(study,'project.json'),'utf8');
 const checked=checkStudy({study,target:'architecture'});
 assert.equal(checked.semanticTruthChecked,false);assert.equal(checked.scenarios,1);
 assert.equal(fs.readFileSync(path.join(study,'project.json'),'utf8'),before);
 const delivered=JSON.parse(runBuild('--target','architecture'));
 assert.equal(delivered.deliveryCheck.target,'architecture');assert.equal(delivered.deliveryCheck.semanticTruthChecked,false);
 assert.equal(delivered.modelHash,checked.modelHash);
 assert.equal(delivered.modelHash,load(path.join(delivery,'agent/manifest.json')).modelHash);
 assert.equal(delivered.modelHash,load(path.join(delivery,'understanding.json')).modelHash);
 assert.deepEqual(load(path.join(delivery,'build-summary.json')).deliveryCheck,delivered.deliveryCheck);
 const standalone=JSON.parse(execFileSync(process.execPath,[cli,'check','--study',study,'--target','architecture'],{encoding:'utf8'}));
 assert.equal(standalone.modelHash,checked.modelHash);
 checks.push('Valid English-language content passes unchanged; target checks reuse existing step/claim validation and bind to the exported model.');

 const website=JSON.parse(runBuild('--target','architecture','--ui','true','--site',path.join(temp,'site')));
 assert(fs.existsSync(website.understandingGraph));assert(fs.existsSync(website.site.home));
 assert.deepEqual(load(path.join(website.site.project,'build-summary.json')).deliveryCheck,website.deliveryCheck);
 assert.equal(load(path.join(website.site.project,'understanding.json')).modelHash,website.modelHash);
 checks.push('A checked webpage build registers the same model and check result in an isolated homepage.');

 saved=prior();assert.throws(()=>runBuild('--target','complete'),/target mismatch/);assert.deepEqual(prior(),saved);
 const unitBytes=fs.readFileSync(unit.path);
 setTarget({study,target:'complete'});assert.deepEqual(fs.readFileSync(unit.path),unitBytes);
 assert.throws(()=>checkStudy({study,target:'complete'}),/requires the complete stage/);
 assert.throws(()=>updateProgress({study,data:{stage:'complete',summary:'Not covered yet.',remaining:[]}}),/zero explanation gaps/);
 editUnit({study,id:unit.id,data:{explanations:[{id:claim,coverage:[{path:'src.ts',start:1,end:3,status:'explained',note:'The full fixture.'}]}]}});
 updateProgress({study,data:{stage:'complete',summary:'All fixture materials have explanation assignments.',remaining:[]}});
 assert.equal(checkStudy({study,target:'complete'}).stage,'complete');
 editUnit({study,id:unit.id,data:{explanations:[{id:claim,coverage:[]}]}});
 assert.throws(()=>checkStudy({study,target:'complete'}),/zero explanation gaps/);
 checks.push('The target is not a completion declaration; later edits cannot hide reopened coverage gaps behind an old complete stage.');
 console.log(JSON.stringify({status:'passed',checks},null,2));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
