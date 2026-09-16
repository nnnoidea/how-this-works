import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {addToSite} from '../skills/how-this-works/scripts/site.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'htw-site-')),site=path.join(tmp,'site');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function fixture(dir,repo,extra={}){
 fs.mkdirSync(path.join(dir,'agent'),{recursive:true});
 fs.writeFileSync(path.join(dir,'agent/manifest.json'),JSON.stringify({modelHash:'paired'}));
 fs.writeFileSync(path.join(dir,'index.html'),'<html><head></head><body>reader</body></html>');
 fs.writeFileSync(path.join(dir,'LICENSE'),'Original attribution\n');
 fs.writeFileSync(path.join(dir,'understanding.json'),JSON.stringify({repo,modelHash:'paired',displayName:'<script>alert(1)</script>',revision:'1234567890',delivery:{ui:true},intro:{title:'How?',text:'A & B'},nodes:[{id:'a'},{id:'b',parent:'a'}],scenarios:[{id:'all'},{id:'a b',label:'Do work',steps:[{}]}],...extra}));
}
try{
 const first=path.join(tmp,'first');fixture(first,'one/example');
 const a=addToSite(first,site);assert.equal(json(path.join(site,'projects.json')).length,1);
 assert.equal(fs.readFileSync(path.join(a.project,'LICENSE'),'utf8'),'Original attribution\n');
 assert(!fs.readFileSync(path.join(first,'index.html'),'utf8').includes('htw-home'));
 assert(fs.readFileSync(path.join(a.project,'index.html'),'utf8').includes('content="../../"'));
 const html=fs.readFileSync(a.home,'utf8');assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>alert'));assert(html.includes('task=a%20b'));assert(html.replace(/<[^>]*>/g,'').includes('2 个理解单元'));
 fs.writeFileSync(path.join(a.project,'old-asset.js'),'stale');
 const newer=path.join(tmp,'newer');fixture(newer,'one/example',{displayName:'Updated'});
 assert.equal(addToSite(newer,site).project,a.project);assert(!fs.existsSync(path.join(a.project,'old-asset.js')));
 assert.equal(json(path.join(site,'projects.json')).length,1);assert.equal(json(path.join(site,'projects.json'))[0].name,'Updated');
 const other=path.join(tmp,'other');fixture(other,'two/example');addToSite(other,site);assert.equal(json(path.join(site,'projects.json')).length,2);
 const dataOnly=path.join(tmp,'data');fixture(dataOnly,'one/example',{delivery:{ui:false}});assert.throws(()=>addToSite(dataOnly,site),/Data-only/);assert.equal(json(path.join(site,'projects.json')).length,2);
 assert.throws(()=>addToSite(first,path.join(first,'nested')),/contain/);
 const unrelated=path.join(tmp,'unrelated');fs.mkdirSync(unrelated);fs.writeFileSync(path.join(unrelated,'index.html'),'Keep');assert.throws(()=>addToSite(first,unrelated),/unrelated/);assert.equal(fs.readFileSync(path.join(unrelated,'index.html'),'utf8'),'Keep');
 const moved=path.join(tmp,'moved');fs.cpSync(site,moved,{recursive:true});for(const entry of json(path.join(moved,'projects.json')))assert(fs.existsSync(path.join(moved,entry.href,'index.html')));
 console.log(JSON.stringify({status:'passed',checks:'add, update, distinct repositories, escaping, source preservation, path safety, data-only rejection, relocation'}));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
