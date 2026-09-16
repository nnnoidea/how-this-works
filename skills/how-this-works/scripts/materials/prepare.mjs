/** Prepare fixed Git materials and their index; the caller supplies no semantic model. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {build} from './materials.mjs';
import {readJSON,atomicJSON,digest} from './study_store.mjs';
const assert=(v,m)=>{if(!v)throw Error(m);};

export async function prepareMaterials({repo,revision,name,out,python='python3'}){
 assert(repo&&revision&&name&&out,'prepare --repo bare.git --revision ref --name owner/repo --out directory');
 const started=performance.now(),repoDir=fs.realpathSync(repo),root=path.resolve(out);
 const pinned=execFileSync('git',['--git-dir='+repoDir,'rev-parse','--verify',revision+'^{commit}'],{encoding:'utf8'}).trim();
 const receipt=path.join(root,'preparation.json'),previous=fs.existsSync(receipt)?readJSON(receipt):null;
 if(fs.existsSync(root)&&fs.readdirSync(root).length){
  assert(previous?.format===1,'prepare needs an empty directory or its own previous output');
  assert(previous.revision===pinned&&previous.repoDir===repoDir&&previous.repo===name,'prepare output belongs to another snapshot; use a new directory');
 }
 fs.mkdirSync(root,{recursive:true});const lock=path.join(root,'PREPARING');
 try{fs.mkdirSync(lock);}catch{throw Error('material preparation is already running; retry later');}
 const collector=fileURLToPath(new URL('../repository_graph.py',import.meta.url)),collectorHash=digest(fs.readFileSync(collector));
 const atlasDir=path.join(root,'atlas'),atlas=path.join(atlasDir,'data.json'),index=path.join(root,'materials');
 const report={format:1,status:'running',repo:name,repoDir,revision:pinned,collectorHash,atlas,index,steps:{}};
 try{
  atomicJSON(receipt,report);
  const collectStart=performance.now();
  let reused=previous?.status==='complete'&&previous.collectorHash===collectorHash&&fs.existsSync(atlas)&&previous.atlasHash===digest(fs.readFileSync(atlas));
  if(reused){const graph=readJSON(atlas);reused=graph.revision===pinned&&graph.repo===name&&graph.nodes.every(n=>!n.text_file||fs.existsSync(path.resolve(atlasDir,n.text_file)));}
  if(!reused)execFileSync(python,[collector,'--repo',repoDir,'--revision',pinned,'--name',name,'--out',atlasDir],{encoding:'utf8',maxBuffer:4*1024*1024});
  report.atlasHash=digest(fs.readFileSync(atlas));
  report.steps.collection={reused:!!reused,elapsedMs:Math.round(performance.now()-collectStart)};
  report.steps.index=await build({atlas,out:index,repo:repoDir,python});
  report.status='complete';report.elapsedMs=Math.round(performance.now()-started);atomicJSON(receipt,report);
  return report;
 }catch(error){report.status='failed';report.error=error.message;report.elapsedMs=Math.round(performance.now()-started);atomicJSON(receipt,report);throw Error(error.message+'; preparation record: '+receipt);}
 finally{fs.rmdirSync(lock);}
}
