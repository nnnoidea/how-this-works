#!/usr/bin/env node
/** Render the bundled reader over an already-built, paired study delivery. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
if(args.includes('--help')){
 console.log('Usage: node scripts/build_web.mjs --out delivery\nRenders the bundled Svelte reader. Use study.mjs build to generate both data and webpage.');
 process.exit(0);
}
if(args.length!==2||args[0]!=='--out')throw Error('Expected --out delivery');
const out=path.resolve(args[1]),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const model=read(path.join(out,'understanding.json')),index=read(path.join(out,'agent/manifest.json'));
if(!model.modelHash||model.modelHash!==index.modelHash)throw Error('Web/Agent data mismatch: run study.mjs build first');
if(!fs.existsSync(path.join(skill,'node_modules')))throw Error(`Install skill dependencies: npm ci --prefix "${skill}" --ignore-scripts --no-audit --no-fund`);
const {build}=await import('vite'),{svelte}=await import('@sveltejs/vite-plugin-svelte');
await build({root:path.join(skill,'assets/web'),configFile:false,base:'./',plugins:[svelte()],build:{outDir:out,emptyOutDir:false,chunkSizeWarningLimit:700}});
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html=path.join(out,'index.html'),title=escape(`${model.displayName||model.repo} · How This Works`);
fs.writeFileSync(html,fs.readFileSync(html,'utf8').replace(/<title>.*?<\/title>/s,`<title>${title}</title>`).replace('</head>',`<meta name="description" content="${escape(model.intro.text.slice(0,180))}"></head>`));

const lock=read(path.join(skill,'package-lock.json')),notices=['Third-party dependency notices\n'];
for(const [relative,info] of Object.entries(lock.packages||{})){
 if(!relative)continue;
 const folder=path.join(skill,relative);if(!fs.existsSync(folder))continue;
 const license=['LICENSE','LICENSE.md','LICENSE.txt','license','license.md'].find(name=>fs.existsSync(path.join(folder,name)));
 notices.push(`\n${relative.replace(/^node_modules\//,'')} ${info.version}\n${'='.repeat(60)}\n${license?fs.readFileSync(path.join(folder,license),'utf8'):'License declared by package: '+(info.license||'see package metadata')}`);
}
fs.writeFileSync(path.join(out,'THIRD_PARTY_NOTICES.txt'),notices.join('\n'));
