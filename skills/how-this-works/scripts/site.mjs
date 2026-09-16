#!/usr/bin/env node
/** Collect built readers into one portable static site. No upstream code runs. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const within=(parent,child)=>child===parent||child.startsWith(parent+path.sep);
export function sitePaths(repo,site='how-this-works-site'){
 const root=path.resolve(site),slug=repo.split('/').at(-1).replace(/[^a-z0-9-]/gi,'-').slice(0,48)||'project';
 const id=slug+'-'+createHash('sha256').update(repo).digest('hex').slice(0,12);
 return {root,home:path.join(root,'index.html'),project:path.join(root,'projects',id),href:`projects/${id}/`};
}
export function addToSite(delivery,site){
 const source=fs.realpathSync(delivery),model=read(path.join(source,'understanding.json'));
 const manifest=read(path.join(source,'agent/manifest.json'));
 if(!model.repo||!model.modelHash||model.modelHash!==manifest.modelHash)throw Error('Use a paired web/Agent delivery');
 if(model.delivery?.ui===false)throw Error('Data-only delivery cannot be added as a webpage');
 const html=fs.readFileSync(path.join(source,'index.html'),'utf8'),paths=sitePaths(model.repo,site);
 fs.mkdirSync(paths.root,{recursive:true});
 const root=fs.realpathSync(paths.root),target=path.join(root,path.relative(paths.root,paths.project));
 if(within(source,root)||(source!==target&&(within(source,target)||within(target,source))))throw Error('Site and delivery paths must not contain one another');
 if(fs.existsSync(path.join(root,'index.html'))&&!fs.existsSync(path.join(root,'projects.json')))throw Error('Site destination already contains an unrelated homepage');
 if(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())throw Error('Project destination must not be a symlink');
 if(fs.existsSync(target)&&read(path.join(target,'understanding.json')).repo!==model.repo)throw Error('Project destination belongs to another repository');
 if(source!==target){
  fs.rmSync(target,{recursive:true,force:true});
  fs.cpSync(source,target,{recursive:true});
 }
 // Only the collected copy links home; the original delivery stays standalone.
 fs.writeFileSync(path.join(target,'index.html'),html.replace(/<meta name="htw-home"[^>]*>/g,'').replace('</head>','<meta name="htw-home" content="../../"></head>'));
 const entry={repo:model.repo,name:model.displayName||model.repo.split('/').at(-1),revision:model.revision,title:model.intro?.title||model.repo,description:model.intro?.text||'',href:paths.href,updatedAt:new Date().toISOString(),legacy:!model.delivery,scenarios:(model.scenarios||[]).filter(s=>s.id!=='all').map(s=>({id:s.id,label:s.label,steps:s.steps?.length||0})),units:model.nodes?.length||0,events:model.history?.events?.length||0};
 fs.writeFileSync(path.join(target,'site-entry.json'),JSON.stringify(entry,null,2)+'\n');
 renderHome(root);
 return {home:paths.home,project:paths.project};
}
function renderHome(root){
 const projects=fs.readdirSync(path.join(root,'projects'),{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>path.join(root,'projects',d.name,'site-entry.json')).filter(p=>fs.existsSync(p)).map(read).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.repo.localeCompare(b.repo));
 const cards=projects.map(p=>`<article class="project" data-project data-search="${escape([p.name,p.repo,p.title,p.description,...p.scenarios.map(s=>s.label)].join(' ').toLowerCase())}">
  <div class="card-top"><span class="repo">${escape(p.repo)}</span><span class="tag"><span data-ui>${p.legacy?'早期实验':'项目解读'}</span></span></div>
  <h2><a href="${escape(p.href+'?view=understand')}">${escape(p.name)} <span aria-hidden="true">↗</span></a></h2>
  <h3>${escape(p.title)}</h3><p class="description">${escape(p.description)}</p>
  <div class="scenarios">${p.scenarios.filter(s=>s.steps).slice(0,3).map(s=>`<a href="${escape(p.href+'#unit=scenario&task='+encodeURIComponent(s.id))}">${escape(s.label)} <span aria-hidden="true">→</span></a>`).join('')}</div>
  <div class="card-bottom"><span>${p.units}<span data-ui> 个理解单元</span>${p.scenarios.some(s=>s.steps)?` · ${p.scenarios.filter(s=>s.steps).length}<span data-ui> 个场景</span>`:''}${p.events?` · ${p.events}<span data-ui> 段演化</span>`:''}</span><a href="${escape(p.href+'?view=understand')}"><span data-ui>开始了解 →</span></a></div>
  <div class="version"><span data-ui>快照 </span>${escape(p.revision?.slice(0,8))} · <span data-ui>收录更新 </span><time datetime="${escape(p.updatedAt)}">${escape(p.updatedAt.slice(0,10))} UTC</time></div>
 </article>`).join('\n');
 const template=fs.readFileSync(new URL('../assets/home.html',import.meta.url),'utf8').replace('// UI_LANGUAGE',()=>fs.readFileSync(new URL('../assets/ui-language.js',import.meta.url),'utf8'));
 fs.writeFileSync(path.join(root,'index.html'),template.replace('<!-- PROJECTS -->',()=>cards).replaceAll('{{COUNT}}',String(projects.length)));
 fs.writeFileSync(path.join(root,'projects.json'),JSON.stringify(projects,null,2)+'\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const {values}=parseArgs({options:{site:{type:'string',default:'how-this-works-site'},add:{type:'string',multiple:true},help:{type:'boolean'}}});
  if(values.help)console.log('Usage: node scripts/site.mjs --add delivery [--add another-delivery] [--site how-this-works-site]\nCopies built readers into one static site. The same repository updates its existing entry.');
  else {if(!values.add?.length)throw Error('Provide --add delivery');for(const delivery of values.add)console.log(JSON.stringify(addToSite(delivery,values.site)));}
 }catch(error){console.error(error.message);process.exitCode=1;}
}
