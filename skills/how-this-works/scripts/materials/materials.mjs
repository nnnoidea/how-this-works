#!/usr/bin/env node
/** Immutable material supply for Agents. Never executes the studied repository. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {splitIdentifierSegments} from './vendor/identifier-segments.ts';
import {coverageReport,validateOwnership} from './coverage.mjs';
import {assertStudyCurrent,readInput} from './study_store.mjs';
import {validateResearch,validateScenarios,reviewModel} from './research_review.mjs';
import {extractionPolicy,materialProfile} from './material_profile.mjs';
import {validateHistory,historyBrief} from './history.mjs';
import {mergeRanges} from './vendor/ranges.ts';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const modelHash=model=>hash(JSON.stringify(canonical(model)));
const blobOid=(raw,oid)=>crypto.createHash(oid.length===64?'sha256':'sha1').update(`blob ${Buffer.byteLength(raw)}\0`).update(raw).digest('hex');
function verifiedRaw(dir,oid){const raw=fs.readFileSync(path.join(dir,'raw',oid+'.txt'));assert(blobOid(raw,oid)===oid,'corrupt cached blob; rebuild index');return raw.toString('utf8');}
export function verifyOriginals(dir,files){
 const checked=new Set();
 for(const file of files){
  assert(file?.readable,'original material unavailable');
  if(!checked.has(file.oid)){verifiedRaw(dir,file.oid);checked.add(file.oid);}
 }
 return checked.size;
}
export function currentManifest(dir,{snapshot=false}={}){
 assert(!fs.existsSync(path.join(dir,'BUILDING')),'index incomplete; rebuild first');
 const manifest=json(path.join(dir,'manifest.json'));assert(manifest.schema===2,'index format changed; rebuild index');
 if(!snapshot){const binding=json(path.join(dir,'source.json'));if(binding.model){const source=path.resolve(dir,binding.model);assert(fs.existsSync(source),'model source unavailable; use --snapshot true to read an archived index');if(binding.studyOrigin)assert(fs.existsSync(source+'.origin.json'),'study origin missing: export and rebuild');assertStudyCurrent(source);assert(modelHash(json(source))===manifest.modelHash,'model changed: rebuild index');}
 if(binding.web){const web=path.resolve(dir,binding.web);assert(fs.existsSync(web)&&json(web).modelHash===manifest.modelHash,'web/index model mismatch; rebuild together');}}
 return manifest;
}
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const put=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});const text=JSON.stringify(v)+'\n';if(!fs.existsSync(p)||fs.readFileSync(p,'utf8')!==text){fs.writeFileSync(p+'.tmp',text);fs.renameSync(p+'.tmp',p);}};
const assert=(v,m)=>{if(!v)throw new Error(m);};
const split=s=>s===''?[]:s.split(/\r\n|\n|\r/).slice(0,s.endsWith('\n')||s.endsWith('\r')?-1:undefined);
// Only syntax-extraction changes invalidate parse caches; authoring/UI changes do not.
const VERSION='materials-v2:'+hash([headings.toString(),declarations.toString(),split.toString(),extractionPolicy.toString(),fs.readFileSync(new URL('./python_symbols.py',import.meta.url),'utf8')].join('\n')).slice(0,16);
const terms=s=>[...new Set([s.toLowerCase(),...splitIdentifierSegments(s)])];
const fileKey=p=>hash(p).slice(0,24);
const anchorId=(p,a)=>`${fileKey(p)}:${a.start}:${a.kind}:${hash(a.name).slice(0,10)}`;
const getFile=(dir,p)=>{const f=json(path.join(dir,'files',fileKey(p)+'.json'));assert(f.path===p,'file identity mismatch');return f;};
const getUnit=(dir,id)=>{const u=json(path.join(dir,'units',fileKey(id)+'.json'));assert(u.id===id,'unit identity mismatch');return u;};

// ATX headings outside fenced code. Other Markdown/MDX forms remain original text.
export function headings(text){
  const lines=split(text),out=[];let fence=null;
  for(let i=0;i<lines.length;i++){
    const f=lines[i].match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if(f){if(!fence)fence={char:f[1][0],length:f[1].length};else if(f[1][0]===fence.char&&f[1].length>=fence.length&&!f[2].trim())fence=null;continue;}
    if(fence)continue;
    const h=lines[i].match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if(h)out.push({kind:'heading',name:h[2],level:h[1].length,start:i+1,end:lines.length});
  }
  for(let i=0;i<out.length;i++){const next=out.slice(i+1).find(h=>h.level<=out[i].level);if(next)out[i].end=next.start-1;}
  return out;
}
export function declarations(ts,p,text){
  const sf=ts.createSourceFile(p,text,ts.ScriptTarget.Latest,true);
  const out=[];
  function visit(n,scope){
    const named=ts.isFunctionDeclaration(n)||ts.isClassDeclaration(n)||ts.isInterfaceDeclaration(n)||ts.isTypeAliasDeclaration(n)||ts.isEnumDeclaration(n)||ts.isMethodDeclaration(n)||ts.isGetAccessor(n)||ts.isSetAccessor(n)||ts.isVariableDeclaration(n)||ts.isPropertyDeclaration(n);
    let next=scope;
    if(named&&n.name){
      const name=n.name.getText(sf),qualified=scope?scope+'.'+name:name;
      out.push({kind:ts.SyntaxKind[n.kind],name,qualified,start:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,end:sf.getLineAndCharacterOfPosition(n.end).line+1});
      if(!ts.isVariableDeclaration(n)||ts.isArrowFunction(n.initializer??{})||ts.isFunctionExpression(n.initializer??{}))next=qualified;
    }
    ts.forEachChild(n,c=>visit(c,next));
  }
  visit(sf,'');
  return {anchors:out,diagnostics:sf.parseDiagnostics.map(d=>({line:sf.getLineAndCharacterOfPosition(d.start??0).line+1,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}))};
}
export function validateModel(model,files,revision,options={}){
  assert(!model.concepts&&!model.questions&&!model.events,'legacy study model: current model requires nodes/sections/edges; import researched events through study history');
  assert(Array.isArray(model.nodes)&&Array.isArray(model.edges)&&model.evidence&&typeof model.evidence==='object','current model requires nodes, edges and evidence');
  assert(model.revision===revision,'understanding/material revision mismatch');
  validateScenarios(model);validateResearch(model,files,options);validateOwnership(model,files);
  validateHistory(model.history,model);
  const nodes=new Map(model.nodes.map(n=>[n.id,n]));assert(nodes.size===model.nodes.length,'duplicate unit');
  const claims=new Set(),relations=new Set();
  const refs=rs=>assert(rs?.length&&rs.every(r=>model.evidence[r]),'missing evidence reference');
  for(const n of nodes.values()){
    assert(!n.parent||nodes.has(n.parent),'missing parent');const seen=new Set([n.id]);let p=n.parent;
    while(p){assert(!seen.has(p),'parent cycle');seen.add(p);p=nodes.get(p).parent;}
    for(const c of n.sections){assert(!claims.has(c.id),'duplicate claim');claims.add(c.id);assert(['fact','author','inference'].includes(c.level),'invalid claim level');refs(c.evidence);}
  }
  for(const e of model.edges){assert(!relations.has(e.id),'duplicate relation');relations.add(e.id);assert(nodes.has(e.source)&&nodes.has(e.target),'missing relation unit');refs(e.evidence);}
  for(const [id,e] of Object.entries(model.evidence)){
    assert(id===e.id,'evidence identity mismatch');assert(!e.revision||['snapshot',revision].includes(e.revision),'mixed revision');
    const f=files.get(e.path);assert(f&&f.readable,'unreadable evidence: '+e.path);
    assert(Number.isInteger(e.start)&&Number.isInteger(e.end)&&e.start>=1&&e.end>=e.start&&e.end<=f.lines,`invalid evidence range: ${id}, ${e.path} ${e.start}..${e.end}; valid lines 1..${f.lines}`);
  }
}
function writeWeb(model,files,indexDir,web,semanticHash){
 assert(!path.relative(path.resolve(web),path.resolve(indexDir)).startsWith('..'),'web index must be inside the web output directory');
 assert(model.repo&&model.intro?.title&&model.intro?.text,'web model needs repo and intro.title/text');
 const data=structuredClone(model),roots=data.nodes.filter(n=>!n.parent);
 data.intro.map??='先认识用途，再沿单元与关联深入；点击依据可核对固定版本原文。';
 data.modelHash=semanticHash;data.schema_version=model.schema_version||2;data.omitted??=[];data.displayName??=data.repo.split('/').at(-1);
 data.scenarios??=[];if(!data.scenarios.some(s=>s.id==='all'))data.scenarios.unshift({id:'all',label:'项目全貌',description:'从项目单元进入，按需深入与核验。',nodes:roots.map(n=>n.id)});
 const ids=new Set(data.nodes.map(n=>n.id));
 for(const s of data.scenarios)assert(s.id&&s.label&&Array.isArray(s.nodes)&&s.nodes.every(id=>ids.has(id)),'invalid scenario');
 assert(new Set(data.scenarios.map(s=>s.id)).size===data.scenarios.length,'duplicate scenario');
 for(const [i,n] of data.nodes.entries()){
  assert(!['overview','coverage','scenario','step','architecture','history'].includes(n.id)&&!n.id.startsWith('history:')&&!n.id.startsWith('ev:')&&!n.id.startsWith('support:'),'unit id reserved by viewer');
  assert(!data.edges.some(e=>e.id===n.id),'unit and relation ids must differ');
  assert(n.title&&n.summary&&n.boundary&&n.sections.length,'web unit needs title, summary, boundary and claims');
  for(const c of n.sections)assert(c.title&&c.text,'web claim needs title and text');
  n.methodCount=data.nodes.filter(c=>c.parent===n.id).length;n.depth??=n.parent?'内部单元':'项目单元';n.short??=n.summary;n.question??=n.title;
  if(!n.position){const j=roots.findIndex(r=>r.id===n.id);n.position={x:(Math.max(0,j)%4)*250,y:Math.floor(Math.max(0,j)/4)*250};}
 }
 for(const e of data.edges){assert(['cooperation','composition','feedback'].includes(e.kind),'invalid relationship kind');assert((e.label||e.kind==='composition')&&e.text,'relationship needs label and text');if(e.kind==='composition'&&!e.label)e.label='组成';if(e.kind==='composition')assert(data.nodes.find(n=>n.id===e.target).parent===e.source,'composition differs from parent');e.sourceHandle??='r';e.targetHandle??='l';}
 for(const n of data.nodes.filter(n=>n.parent))assert(data.edges.some(e=>e.kind==='composition'&&e.source===n.parent&&e.target===n.id),'child needs evidenced composition relation');
 for(const e of Object.values(data.evidence)){
  const f=files.get(e.path),lines=split(verifiedRaw(indexDir,f.oid));e.oid=f.oid;
  e.lines=lines.slice(e.start-1,e.end).map((text,i)=>({number:e.start+i,text}));
  e.text_file=path.relative(path.resolve(web),path.resolve(indexDir,'raw',f.oid+'.txt')).split(path.sep).join('/');
  e.url=`https://github.com/${model.repo}/blob/${model.revision}/${e.path}#L${e.start}-L${e.end}`;
 }
 data.explanationCoverage=coverageReport(model,files).summary;
 const notices=[];
 const noticeDir=path.join(web,'upstream-notices');fs.rmSync(noticeDir,{recursive:true,force:true});
 for(const f of files.values()){
  const licenseFile=/^(?:licen[cs]es?|copying|notice|copyright|authors|third[_-]party[_-]notices)(?:[._-].*)?$/i.test(path.basename(f.path))||f.path.split('/').slice(0,-1).some(part=>/^licen[cs]es$/i.test(part));
  if(!f.readable||!licenseFile)continue;
  const name=fileKey(f.path)+'.txt',target=path.join(noticeDir,name);fs.mkdirSync(noticeDir,{recursive:true});
  fs.writeFileSync(target,verifiedRaw(indexDir,f.oid));notices.push({path:f.path,href:'upstream-notices/'+name});
 }
 data.attribution={repo:model.repo,revision:model.revision,repositoryUrl:`https://github.com/${model.repo}`,versionUrl:`https://github.com/${model.repo}/tree/${model.revision}`,notices};
 put(path.join(web,'understanding.json'),data);
 put(path.join(web,'build-info.json'),{revision:model.revision,modelHash:semanticHash,index:path.relative(path.resolve(web),path.resolve(indexDir)),units:data.nodes.length,evidence:Object.keys(data.evidence).length});
 return data.attribution;
}
export async function build({atlas,model:inputModel,out,web,repo,python='python3',parseGenerated=false,parsePath}){
  if(web&&inputModel)assert(path.resolve(inputModel)!==path.resolve(web,'understanding.json'),'author model must be separate from generated web data');
  if(inputModel)assertStudyCurrent(path.resolve(inputModel));
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'BUILDING'),'Index build incomplete; rebuild before reading.');
  const t=performance.now(),base=path.dirname(path.resolve(atlas)),graph=json(atlas),model=inputModel?json(inputModel):{revision:graph.revision,nodes:[],edges:[],evidence:{}};
  const semanticHash=modelHash(model);
  if(repo){const tree=new Map(execFileSync('git',['--git-dir='+path.resolve(repo),'ls-tree','-rz',graph.revision],{encoding:'utf8',maxBuffer:128*1024*1024}).split('\0').filter(Boolean).map(row=>{const [meta,p]=row.split('\t');return [p,meta.split(' ')[2]];}));for(const n of graph.nodes.filter(n=>n.kind!=='directory'))assert(tree.get(n.path)===n.oid,'atlas identity differs from Git tree: '+n.path);}
  const {default:ts}=await import('typescript');
  const pythonVersion=execFileSync(python,['-I','--version'],{encoding:'utf8'}).trim();
  const extractor=VERSION+':ts'+ts.version+':'+pythonVersion;
  const pythonPending=new Map(),pythonFiles=[];
  if(parsePath)assert(graph.nodes.some(n=>n.path===parsePath),'parse-path not in material tree');
  const files=new Map(),postings=Object.create(null),adj=new Map(),uses=new Map();let parsed=0,reused=0,rawWritten=0;
  // Adjacency is accumulated once, rather than rescanning all edges per file.
  for(const edge of graph.edges){for(const id of new Set([edge.source,edge.target])){if(!adj.has(id))adj.set(id,[]);adj.get(id).push(edge);}}
  for(const n of graph.nodes){
    if(n.kind==='directory')continue;
    const readable=Boolean(n.text_file),f={path:n.path,oid:n.oid,kind:n.kind,scan:n.scan,bytes:n.bytes,lines:n.lines??0,readable,anchors:[],diagnostics:[],imports:[],relations:adj.get(n.id)??[],uses:[]};
    if(readable){
      const text=fs.readFileSync(path.resolve(base,n.text_file),'utf8');
      const oid=blobOid(text,n.oid);assert(oid===n.oid,'atlas blob mismatch: '+n.path);
      const raw=path.join(out,'raw',n.oid+'.txt');if(!fs.existsSync(raw)||blobOid(fs.readFileSync(raw),n.oid)!==n.oid){fs.mkdirSync(path.dirname(raw),{recursive:true});fs.writeFileSync(raw,text);rawWritten++;}
      const ext=path.extname(n.path).toLowerCase(),policy=extractionPolicy(n.path,text,{parseGenerated,parsePath});
      f.extraction={deferred:policy.deferred,reasons:policy.reasons};
      const cache=path.join(out,'cache',hash(extractor+':'+ext+':'+policy.deferred+':'+n.oid)+'.json');let result;
      if(fs.existsSync(cache)){result=json(cache);reused++;}else{
        if(policy.deferred)result={anchors:[],diagnostics:[],parser:'deferred-generated'};
        else if(['.py','.pyi'].includes(ext)){
          if(pythonPending.has(cache)){reused++;parsed--;}
          pythonPending.set(cache,{key:cache,raw:path.resolve(raw),path:n.path});pythonFiles.push({file:f,cache});
          result={anchors:[],diagnostics:[],parser:'python-ast'};
        }
        else if(/\.(?:[cm]?[jt]s|[jt]sx)$/.test(n.path)){result={...declarations(ts,n.path,text),parser:'typescript-syntax'};}
        else if(['document','skill','instruction'].includes(n.kind)&&/\.mdx?$/.test(n.path)){result={anchors:headings(text),diagnostics:[],parser:'markdown-atx'};}
        else result={anchors:[],diagnostics:[],parser:'inventory-only'};
        if(!pythonPending.has(cache))put(cache,result);parsed++;
      }
      Object.assign(f,result);f.lines=split(text).length;
      f.anchors=f.anchors.map(a=>({...a,id:anchorId(n.path,a)}));
    }
    files.set(f.path,f);
  }
  if(pythonPending.size){
    const results=JSON.parse(execFileSync(python,['-I',fileURLToPath(new URL('./python_symbols.py',import.meta.url))],{input:JSON.stringify([...pythonPending.values()]),encoding:'utf8',maxBuffer:128*1024*1024}));
    for(const {file:f,cache} of pythonFiles){const result=results[cache];assert(result,'missing Python parser result');put(cache,result);Object.assign(f,result);f.anchors=f.anchors.map(a=>({...a,id:anchorId(f.path,a)}));}
  }
  const duplicateCounts=new Map();for(const f of files.values())duplicateCounts.set(f.oid,(duplicateCounts.get(f.oid)||0)+1);
  for(const f of files.values())f.identicalPaths=duplicateCounts.get(f.oid);
  validateModel(model,files,graph.revision);
  const explanationCoverage=coverageReport(model,files);
  const ownershipByPath=new Map(explanationCoverage.files.map(f=>[f.path,f.owners]));
  function use(eid,item){const e=model.evidence[eid];if(!uses.has(e.path))uses.set(e.path,[]);uses.get(e.path).push({...item,evidence:eid,start:e.start,end:e.end});}
  for(const n of model.nodes)for(const c of n.sections)for(const e of c.evidence)use(e,{unit:n.id,claim:c.id});
  for(const r of model.edges)for(const e of r.evidence)use(e,{relation:r.id,source:r.source,target:r.target});
  function index(label,item){for(const term of terms(label)){postings[term]??=[];postings[term].push(item);}}
  for(const f of files.values()){
    f.ownership=ownershipByPath.get(f.path)||[];f.uses=uses.get(f.path)??[];put(path.join(out,'files',fileKey(f.path)+'.json'),f);
    index(f.path,{type:'file',path:f.path});for(const a of f.anchors)index(a.name,{type:'anchor',path:f.path,id:a.id,name:a.name,start:a.start,end:a.end});
  }
  for(const n of model.nodes){
    const relations=model.edges.filter(e=>e.source===n.id||e.target===n.id),eids=new Set([...n.sections.flatMap(c=>c.evidence),...relations.flatMap(r=>r.evidence)]);
    const evidence=Object.fromEntries([...eids].map(id=>[id,{...model.evidence[id],oid:files.get(model.evidence[id].path).oid}]));
    put(path.join(out,'units',fileKey(n.id)+'.json'),{...n,revision:graph.revision,modelHash:semanticHash,relations,evidence,history:historyBrief(model.history)?.events.filter(e=>e.units.includes(n.id))||[],children:model.nodes.filter(c=>c.parent===n.id).map(c=>({id:c.id,title:c.title})),parentSummary:model.nodes.filter(p=>p.id===n.parent).map(p=>({id:p.id,title:p.title}))[0]??null});
    index(n.id,{type:'unit',id:n.id,title:n.title});index(n.title,{type:'unit',id:n.id,title:n.title});
  }
  const catalog=[...files.values()].map(({path,oid,kind,readable,lines,anchors,parser,diagnostics,extraction,identicalPaths,bytes,scan})=>({path,oid,kind,readable,lines,anchors:anchors.length,parser,parseDiagnostics:diagnostics.length,extraction,identicalPaths,bytes,scan}));
  put(path.join(out,'catalog.json'),catalog);
  const buckets=Object.create(null);for(const [term,items] of Object.entries(postings)){const key=hash(term).slice(0,2);buckets[key]??=Object.create(null);buckets[key][term]=items;}
  for(let i=0;i<256;i++){const key=i.toString(16).padStart(2,'0');put(path.join(out,'terms',key+'.json'),buckets[key]??{});}
  fs.rmSync(path.join(out,'terms.json'),{force:true});put(path.join(out,'evidence.json'),model.evidence);
  const coverage={files:files.size,readable:catalog.filter(f=>f.readable).length,anchors:catalog.reduce((s,f)=>s+f.anchors,0),parseDiagnosticFiles:catalog.filter(f=>f.parseDiagnostics).length,filesWithEvidence:uses.size,units:model.nodes.length,claims:model.nodes.reduce((s,n)=>s+n.sections.length,0),relations:model.edges.length};
  put(path.join(out,'review.json'),reviewModel(model));
  put(path.join(out,'explanation-coverage.json'),{...explanationCoverage,modelHash:semanticHash});
  const profile=materialProfile([...files.values()]);put(path.join(out,'profile.json'),profile);
  const manifest={schema:2,profile,explanationCoverage:explanationCoverage.summary,unitIds:model.nodes.map(n=>n.id),extractor,revision:graph.revision,repo:graph.repo??model.repo,modelHash:semanticHash,coverage,intro:model.intro??null,scenarios:(model.scenarios||[]).map(({steps,...s})=>({...s,stepCount:steps?.length||0})),roots:model.nodes.filter(n=>!n.parent).map(n=>({id:n.id,title:n.title,summary:n.summary})),limits:['Syntax declarations are locations, not call resolution or semantic units.','Markdown: ATX headings outside fences only; other text is still readable.','Unsupported languages, binaries and oversized files remain visible in catalog.','No question interpretation, runtime validation, history, or implicit cross-session read suppression.','Authored claims remain Agent judgments; evidence presence does not prove truth.']};
  manifest.research=model.research??null;
  manifest.history=historyBrief(model.history);
  if(model.history)manifest.limits=manifest.limits.map(s=>s.replace('runtime validation, history, or','runtime validation, or'));
  fs.rmSync(path.join(out,'history'),{recursive:true,force:true});
  for(const e of model.history?.events||[])put(path.join(out,'history',fileKey(e.id)+'.json'),e);
  for(const s of model.scenarios||[])put(path.join(out,'scenarios',fileKey(s.id)+'.json'),s);
  if(web)manifest.attribution=writeWeb(model,files,out,web,semanticHash);
  if(inputModel){assertStudyCurrent(path.resolve(inputModel));assert(modelHash(json(inputModel))===semanticHash,'model changed during build; retry');}
  put(path.join(out,'source.json'),{studyOrigin:!!inputModel&&fs.existsSync(inputModel+'.origin.json'),atlas:path.relative(path.resolve(out),path.resolve(atlas)),model:inputModel?path.relative(path.resolve(out),path.resolve(inputModel)):null,web:web?path.relative(path.resolve(out),path.resolve(web,'understanding.json')):null});
  put(path.join(out,'manifest.json'),manifest);
  fs.rmSync(path.join(out,'BUILDING'));
  const stats={...coverage,parsed,reused,rawWritten,elapsedMs:Math.round(performance.now()-t)};return stats;
}
function readPlan(dir,request,options={},wholeFiles=false){
  const manifest=currentManifest(dir,options);assert(request.revision===manifest.revision,'request/index revision mismatch');
  if(request.modelHash)assert(request.modelHash===manifest.modelHash,'request/model version mismatch');
  const catalog=new Map(json(path.join(dir,'catalog.json')).map(f=>[f.path,f]));
  const evidence=json(path.join(dir,'evidence.json')),group=new Map(),emptyFiles=[];let requestedLines=0;
  assert(Array.isArray(request.ranges),'ranges must be an array');
  for(const [i,r] of request.ranges.entries()){
    let x=r;if(r.evidence){assert(evidence[r.evidence],'unknown evidence');x=evidence[r.evidence];}
    assert(catalog.has(x.path),'unknown file');const f=getFile(dir,x.path);assert(f.oid===catalog.get(x.path).oid,'stale file');assert(f.readable,'unreadable material: '+x.path);
    if(r.oid)assert(r.oid===f.oid,'request blob mismatch');
    if(x.anchor){const a=f.anchors.find(a=>a.id===x.anchor);assert(a,'unknown anchor');x={...x,start:a.start,end:a.end};}
    if(wholeFiles&&!x.anchor&&!r.evidence){
      if(f.lines===0&&x.start===undefined&&x.end===undefined){verifiedRaw(dir,f.oid);emptyFiles.push(x.path);continue;}
      x={...x,start:x.start??1,end:x.end??f.lines};
    }
    assert(Number.isInteger(x.start)&&Number.isInteger(x.end)&&x.start>=1&&x.end>=x.start&&x.end<=f.lines,`invalid range: ranges[${i}], ${x.path} ${x.start}..${x.end}; valid lines 1..${f.lines}`);
    if(!group.has(x.path))group.set(x.path,{file:f,requests:[]});group.get(x.path).requests.push({request:i,evidence:r.evidence,start:x.start,end:x.end});requestedLines+=x.end-x.start+1;
  }
  return {manifest,group,requestedLines,emptyFiles};
}
export const READ_LIMITS={defaultLines:200,defaultChars:12000,maxLines:400,maxChars:16000,responseChars:24000};
function readBudget(request){
 const maxLines=request.maxLines??READ_LIMITS.defaultLines,maxChars=request.maxChars??READ_LIMITS.defaultChars;
 assert(Number.isInteger(maxLines)&&maxLines>0&&maxLines<=READ_LIMITS.maxLines,`maxLines must be 1..${READ_LIMITS.maxLines}; use next to continue`);
 assert(Number.isInteger(maxChars)&&maxChars>0&&maxChars<=READ_LIMITS.maxChars,`maxChars must be 1..${READ_LIMITS.maxChars}; use next to continue`);
 return {maxLines,maxChars};
}
const responseFits=result=>JSON.stringify(result).length<=READ_LIMITS.responseChars-500&&pageText(result).length<=READ_LIMITS.responseChars-500;
function boundedItems(result,field){
 while(JSON.stringify(result).length>READ_LIMITS.responseChars-500&&result[field].length>1){
  result[field].pop();result.next=result.offset+result[field].length;
 }
 assert(JSON.stringify(result).length<=READ_LIMITS.responseChars-500,'query item exceeds output budget; narrow the query or inspect the material artifact');
 return result;
}
export function readBatch(dir,request,options={}){
  const {maxLines,maxChars}=readBudget(request),{manifest,group,requestedLines}=readPlan(dir,request,options);
  const blocks=[];let emittedLines=0;const loaded=new Map();
  for(const [p,{file:f,requests}] of group){
    if(!loaded.has(f.oid))loaded.set(f.oid,split(verifiedRaw(dir,f.oid)));
    const lines=loaded.get(f.oid);for(const span of mergeRanges(requests)){
      emittedLines+=span.end-span.start+1;
      blocks.push({path:p,oid:f.oid,...span,requests:requests.filter(r=>r.start<=span.end&&r.end>=span.start),text:lines.slice(span.start-1,span.end).map((s,i)=>`${span.start+i}: ${s}`).join('\n')});
    }
  }
  assert(emittedLines<=maxLines,'read exceeds line budget; split ranges or explicitly increase maxLines');
  assert(blocks.reduce((n,b)=>n+b.text.length,0)<=maxChars,'read exceeds character budget; narrow the range or explicitly increase maxChars');
  const result={revision:manifest.revision,modelHash:manifest.modelHash,readMode:options.snapshot?'snapshot':'current',stats:{requests:request.ranges.length,files:group.size,blobReads:loaded.size,requestedLines,emittedLines,savedLines:requestedLines-emittedLines},blocks};
  assert(JSON.stringify(result).length<=READ_LIMITS.responseChars-500,'read response exceeds output budget; use paged read');return result;
}
/** Bounded original text. Next contains ordinary ranges, without persistent read state. */
export function readPage(dir,request={},options={}){
 const manifest=currentManifest(dir,options),{maxLines,maxChars}=readBudget(request);
 assert(!(request.ranges&&(request.path||request.evidence)),'provide ranges or one path/evidence');
 const ranges=request.ranges??[request.evidence?{evidence:request.evidence}:{path:request.path,start:request.start,end:request.end,anchor:request.anchor,oid:request.oid}];
 const input={revision:request.revision??manifest.revision,modelHash:request.modelHash,ranges};
 const {group,requestedLines,emptyFiles}=readPlan(dir,input,options,true),spans=[];
 for(const [p,{file,requests}] of group)for(const span of mergeRanges(requests))spans.push({path:p,oid:file.oid,...span});
 const blocks=[],loaded=new Map();let emittedLines=0,emittedChars=0,remaining=[];
 for(let i=0;i<spans.length;i++){
  const span=spans[i];
  if(!loaded.has(span.oid))loaded.set(span.oid,split(verifiedRaw(dir,span.oid)));
  const lines=loaded.get(span.oid),text=[];let line=span.start;
  for(;line<=span.end;line++){
   const value=`${line}: ${lines[line-1]}`,cost=value.length+(text.length?1:0);
   if(emittedLines>=maxLines||emittedChars+cost>maxChars)break;
   text.push(value);emittedLines++;emittedChars+=cost;
  }
  if(text.length)blocks.push({path:span.path,oid:span.oid,start:span.start,end:line-1,text:text.join('\n')});
  if(line<=span.end){
   assert(emittedLines>0,`single source line exceeds character budget: ${span.path}:${line}; use maxChars up to ${READ_LIMITS.maxChars}, or inspect the source artifact`);
   remaining=[{...span,start:line},...spans.slice(i+1)];break;
  }
 }
 const remainingLines=remaining.reduce((n,r)=>n+r.end-r.start+1,0);
 const next=remaining.length?{revision:manifest.revision,ranges:remaining}:null;
 if(next&&request.modelHash)next.modelHash=request.modelHash;
 const result={revision:manifest.revision,modelHash:manifest.modelHash,readMode:options.snapshot?'snapshot':'current',
  stats:{requests:input.ranges.length,files:group.size,blobReads:loaded.size,requestedLines,emittedLines,emittedChars,remainingLines},
  blocks,emptyFiles:[...new Set(emptyFiles)],complete:next===null,next};
 // Include paths, escaping and continuation data in the budget; never slice serialized output.
 while(!responseFits(result)&&result.stats.emittedLines>1){
  const b=result.blocks.at(-1),lines=b.text.split('\n'),removed=lines.pop();
  if(lines.length){b.text=lines.join('\n');b.end--;}else result.blocks.pop();
  const line=lines.length?b.end+1:b.start;
  const rest=result.next?.ranges||[];
  if(rest[0]?.path===b.path&&rest[0].start===line+1)rest[0].start=line;
  else rest.unshift({path:b.path,oid:b.oid,start:line,end:line});
  result.next={revision:manifest.revision,ranges:rest};if(request.modelHash)result.next.modelHash=request.modelHash;
  result.complete=false;result.stats.emittedLines--;result.stats.remainingLines++;
  result.stats.emittedChars-=removed.length+(lines.length?1:0);
 }
 assert(responseFits(result),'read response metadata exceeds output budget; submit fewer ranges (paths/next are included)');
 return result;
}
export function pageText(result){
 const chunks=[`revision: ${result.revision}\nmodelHash: ${result.modelHash}\nreadMode: ${result.readMode}`];
 for(const b of result.blocks)chunks.push(`--- ${b.path}:${b.start}-${b.end} ---\n${b.text}`);
 for(const p of result.emptyFiles||[])chunks.push(`--- ${p}: empty file ---`);
 chunks.push(`page: ${result.stats.emittedLines} lines; remaining: ${result.stats.remainingLines}\nnext: ${result.next?JSON.stringify(result.next):'none'}`);
 return chunks.join('\n\n')+'\n';
}
export function readRequestOptions(o){
 assert(!o.requests||!o.path,'provide path or requests, not both');
 const request=o.requests?readInput(o.requests):{path:o.path,start:o.start===undefined?undefined:Number(o.start),end:o.end===undefined?undefined:Number(o.end),anchor:o.anchor};
 for(const [flag,key] of [['max-lines','maxLines'],['max-chars','maxChars']])if(o[flag]!==undefined)request[key]=Number(o[flag]);
 if(o.revision)request.revision=o.revision;
 return request;
}
export function impact(dir,against,options={}){
  currentManifest(dir,options);currentManifest(against,{snapshot:true});
  const before=new Map(json(path.join(against,'catalog.json')).map(f=>[f.path,f])),after=new Map(json(path.join(dir,'catalog.json')).map(f=>[f.path,f]));const changed=[];
  for(const p of new Set([...before.keys(),...after.keys()]))if(before.get(p)?.oid!==after.get(p)?.oid){
    const old=before.has(p)?getFile(against,p):null,now=after.has(p)?getFile(dir,p):null;
    changed.push({path:p,change:!old?'added':!now?'deleted':'modified',before:old?.oid,after:now?.oid,review:[...(old?.uses??[]),...(now?.uses??[])],structuralNeighbors:[...new Set([...(old?.relations??[]),...(now?.relations??[])].flatMap(e=>[e.source,e.target]))]});
  }
  return {from:json(path.join(against,'manifest.json')).revision,to:json(path.join(dir,'manifest.json')).revision,changed,limit:'Conservative file-level evidence invalidation. These are review candidates, not inferred semantic changes; missing citations can hide impact.'};
}
async function main(){
  const [command,...rest]=process.argv.slice(2),o={};
  if(!command||command==='--help'||rest.includes('--help')){
    console.log(JSON.stringify({purpose:'Locate and read fixed source materials. No responsibility discovery or semantic truth checking.',commands:{
      build:'--atlas data.json --out index [--model model.json] [--repo bare.git] [--web output] [--python python3] [--parse-path path] [--parse-generated true]',
      overview:'--index index',find:'--index index (--term exact-token | --path substring) [--offset 0] [--limit 30]',
      file:'--index index --path path [--part anchors|relations|imports|uses|ownership] [--offset 0] [--limit 40]',
      read:'--index index (--path path [--start 1 --end N --anchor id] | --requests -|inline-JSON|ranges.json [--paged true]) [--max-lines 200 --max-chars 12000 --format text|json]',unit:'--index index --id unit-id',coverage:'--index index [--path substring] [--offset 0] [--limit 30] [--all true]',
      scenario:'--index index --id scenario-id; full process with unit/explanation references',
      history:'--index index [--unit unit-id | --id event-id]; researched history summaries or one event with versioned source excerpts',
      check:'--index index [--model model.json]',review:'--index index',impact:'--index new --against old'},
      readRequest:{revision:'required pinned revision',modelHash:'optional expected model version',ranges:'array of {path,start,end}, {path,anchor}, or {evidence}',maxLines:200,maxChars:12000},
      pagedRead:'Path reads are paged and return compact text. Pass next directly as the next request; it contains fixed revision and remaining ranges, with no saved cursor. --requests - --paged true accepts stdin JSON; --format json returns blocks. Empty files and oversized individual lines remain explicit. Legacy strict reads remain complete-or-error.',
      limits:{pagination:200,read:READ_LIMITS},archive:'Read commands accept --snapshot true for an explicitly archived index.'},null,2));return;
  }
  for(let i=0;i<rest.length;i+=2){assert(rest[i].startsWith('--')&&rest[i+1]!==undefined,'expected --key value');o[rest[i].slice(2)]=rest[i+1];}
  let result,textOutput=false;
  if(command==='build'){if(o['parse-generated']!==undefined)assert(['true','false'].includes(o['parse-generated']),'parse-generated must be true or false');o.parseGenerated=o['parse-generated']==='true';o.parsePath=o['parse-path'];assert(o.atlas&&o.out,'build --atlas data.json [--model understanding.json] --out dir');result=await build(o);}
  else {
    assert(o.index,'required --index dir');const options={snapshot:o.snapshot==='true'},manifest=currentManifest(o.index,options);
    if(o.model)assert(modelHash(json(o.model))===manifest.modelHash,'model changed: rebuild index');
    if(command==='review'){result={revision:manifest.revision,modelHash:manifest.modelHash,...json(path.join(o.index,'review.json'))};}
    else if(command==='overview'){const {unitIds,...brief}=manifest;result=brief;}
    else if(command==='scenario'){assert(manifest.scenarios.some(s=>s.id===o.id),'unknown scenario');result={...json(path.join(o.index,'scenarios',fileKey(o.id)+'.json')),revision:manifest.revision,modelHash:manifest.modelHash};}
    else if(command==='history'){
      assert(manifest.history,'no researched history in this delivery');
      if(o.id){assert(manifest.history.events.some(e=>e.id===o.id),'unknown history event');result={...json(path.join(o.index,'history',fileKey(o.id)+'.json')),revision:manifest.revision,modelHash:manifest.modelHash};}
      else{if(o.unit)assert(manifest.unitIds.includes(o.unit),'unknown unit');result={...manifest.history,events:manifest.history.events.filter(e=>!o.unit||e.units.includes(o.unit)),modelHash:manifest.modelHash};}
    }
    else if(command==='unit'){assert(manifest.unitIds.includes(o.id),'unknown unit');result=getUnit(o.index,o.id);assert(result.revision===manifest.revision,'stale unit');}
    else if(command==='coverage'){const report=json(path.join(o.index,'explanation-coverage.json'));const rows=report.files.filter(f=>(o.all==='true'||f.status!=='explained')&&(!o.path||f.path.includes(o.path)));const offset=Number(o.offset||0),limit=Number(o.limit||30);assert(Number.isInteger(offset)&&offset>=0&&Number.isInteger(limit)&&limit>0&&limit<=200,'invalid pagination');result={...report,files:rows.slice(offset,offset+limit),total:rows.length,next:offset+limit<rows.length?offset+limit:null};}
    else if(command==='file'){
      assert(json(path.join(o.index,'catalog.json')).some(f=>f.path===o.path),'unknown file');const f=getFile(o.index,o.path),part=o.part??'anchors',offset=Number(o.offset??0),limit=Number(o.limit??40);
      assert(['anchors','relations','uses','imports','ownership'].includes(part),'part: anchors, relations, uses, imports');assert(Number.isInteger(offset)&&offset>=0&&Number.isInteger(limit)&&limit>0&&limit<=200,'invalid pagination');
      const {anchors,relations,uses,imports=[],ownership=[],...info}=f,items=f[part]||[];result={...info,revision:manifest.revision,modelHash:manifest.modelHash,counts:{anchors:anchors.length,relations:relations.length,uses:uses.length,imports:imports.length,ownership:ownership.length},part,total:items.length,offset,next:offset+limit<items.length?offset+limit:null,items:items.slice(offset,offset+limit)};
    }
    else if(command==='read'){
      assert(o.paged===undefined||['true','false'].includes(o.paged),'paged must be true or false');
      assert(!o.format||['text','json'].includes(o.format),'format must be text or json');
      const paged=!!o.path||o.paged==='true',request=readRequestOptions(o);
      result=paged?readPage(o.index,request,options):readBatch(o.index,request,options);
      textOutput=paged&&o.format!=='json';
      assert(paged||o.format!=='text','text format requires a paged read');
    }
    else if(command==='impact')result=impact(o.index,o.against,options);
    else if(command==='find'){
      assert(o.term||o.path,'find --term exact-token or --path substring');let matches;
      if(o.term){const term=o.term.toLowerCase(),bucket=json(path.join(o.index,'terms',hash(term).slice(0,2)+'.json'));matches=Object.hasOwn(bucket,term)?bucket[term]:[];}
      else matches=json(path.join(o.index,'catalog.json')).filter(f=>f.path.includes(o.path));
      matches=[...new Map(matches.map(m=>[JSON.stringify(m),m])).values()];const offset=Number(o.offset??0),limit=Number(o.limit??30);assert(Number.isInteger(offset)&&offset>=0&&Number.isInteger(limit)&&limit>0&&limit<=200,'invalid pagination');result={revision:manifest.revision,modelHash:manifest.modelHash,total:matches.length,offset,next:offset+limit<matches.length?offset+limit:null,matches:matches.slice(offset,offset+limit)};
    }else if(command==='check'){
      const catalog=json(path.join(o.index,'catalog.json')),files=new Map(catalog.map(f=>[f.path,getFile(o.index,f.path)]));
      if(o.model){const m=json(o.model);assert(modelHash(m)===manifest.modelHash,'model changed: rebuild index');validateModel(m,files,manifest.revision);}
      let verified=0;for(const f of files.values())if(f.readable){verifiedRaw(o.index,f.oid);verified++;}
      result={status:'passed',verifiedBlobs:verified,semanticTruthChecked:false};
    }else throw new Error('commands: build, overview, review, find, file, unit, read, check, coverage, impact');
  }
  if(command==='file')result=boundedItems(result,'items');
  if(command==='find')result=boundedItems(result,'matches');
  if(command!=='build')result.readMode=o.snapshot==='true'?'snapshot':'current';
  process.stdout.write(textOutput?pageText(result):JSON.stringify(result)+'\n');
}
if(process.argv[1]&&fs.existsSync(process.argv[1])&&fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url)))main().catch(e=>{console.error(e.message);process.exitCode=1;});
