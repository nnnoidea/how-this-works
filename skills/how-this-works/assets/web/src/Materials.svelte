<script>
 import {t} from '../../ui-language.js';
 import {onMount,tick} from 'svelte';
 import {materialKind} from './material-labels.js';
 import SourceNotice from './SourceNotice.svelte';
 import LanguageToggle from './LanguageToggle.svelte';
 let attribution=$state(null),pageName=$state('');
 $effect(()=>{if(pageName)document.title=pageName+' '+$t('· 材料与覆盖');});
 let report=$state(null),query=$state(''),coverageFilter=$state('all'),opened=$state(new Set()),selected=$state(null),source=$state([]),start=$state(1),loading=$state(false),error=$state('');
 const linePage=160;
 const matches=$derived(report?.files.filter(f=>(coverageFilter==='all'||(coverageFilter==='covered'?f.status==='explained':f.status!=='explained'))&&f.path.toLowerCase().includes(query.toLowerCase()))||[]);
 const tree=$derived(directoryTree(matches));
 function directoryTree(files){
  const root={children:new Map()};
  for(const file of files){let parent=root,path='';const parts=file.path.split('/');
   for(const [i,name] of parts.entries()){path=path?path+'/'+name:name;let node=parent.children.get(name);if(!node){node={name,path,children:new Map(),count:0};parent.children.set(name,node);}node.count++;if(i===parts.length-1)node.file=file;parent=node;}
  }
  const sort=node=>[...node.children.values()].sort((a,b)=>Number(!!a.file)-Number(!!b.file)||a.name.localeCompare(b.name,undefined,{numeric:true})).map(n=>({...n,children:sort(n)}));
  return sort(root);
 }
 function parents(path){return path.split('/').slice(0,-1).map((_,i)=>path.split('/').slice(0,i+1).join('/'));}
 function toggle(path,isOpen){const next=new Set(opened);if(isOpen)next.add(path);else next.delete(path);opened=next;}
 function persist(){const url=new URL(location.href);url.searchParams.set('view','materials');for(const [key,value] of Object.entries({coverage:coverageFilter==='all'?'':coverageFilter,q:query,file:selected?.path||'',start:selected?String(start):''})){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);}history.replaceState(null,'',url);}

 const status=f=>f.status==='explained'?'已覆盖':f.explainedLines>0?'部分覆盖':f.status==='unassigned'?'未归属':f.status==='pending'?'待解释':'部分归属';
 function filtered(){if(matches.length<=40&&(query||coverageFilter!=='all'))opened=new Set(matches.flatMap(f=>parents(f.path)));if(selected&&!matches.includes(selected)){selected=null;source=[];}persist();}

 async function choose(f,line=1){
  selected=f;source=[];error='';start=Math.max(1,Math.min(Number(line)||1,Math.max(1,f.lines)));loading=!!f.readable;
  opened=new Set([...opened,...parents(f.path)]);persist();await tick();document.querySelector('.material-file.active')?.scrollIntoView({block:'nearest'});
  if(!f.readable)return;
  try{
   const r=await fetch('./agent/raw/'+f.oid+'.txt');if(!r.ok)throw Error('原文暂不可读');
   const bytes=new Uint8Array(await r.arrayBuffer()),header=new TextEncoder().encode('blob '+bytes.length+'\0'),buffer=new Uint8Array(header.length+bytes.length);buffer.set(header);buffer.set(bytes,header.length);
   const hash=await crypto.subtle.digest(f.oid.length===64?'SHA-256':'SHA-1',buffer);
   if([...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('')!==f.oid)throw Error('原文与固定版本不符，请重建材料');
   if(selected?.path===f.path)source=new TextDecoder().decode(bytes).split(/\r\n|\n|\r/).slice(0,f.lines);
  }catch(e){if(selected?.path===f.path)error=e.message;}finally{if(selected?.path===f.path)loading=false;}
 }
 onMount(async()=>{try{
  const [coverage,model]=await Promise.all([fetch('./agent/explanation-coverage.json').then(r=>r.json()),fetch('./understanding.json').then(r=>r.json())]);
  if(coverage.modelHash!==model.modelHash)throw Error('覆盖清单与理解模型版本不一致');report=coverage;attribution=model.attribution;
  pageName=model.displayName||model.repo;
  const p=new URLSearchParams(location.search);coverageFilter=['covered','gaps'].includes(p.get('coverage'))?p.get('coverage'):'all';query=p.get('q')||'';const f=report.files.find(f=>f.path===p.get('file'));if(matches.length<=40&&(query||coverageFilter!=='all'))opened=new Set(matches.flatMap(f=>parents(f.path)));if(f){if(!matches.includes(f)){coverageFilter='all';query='';}choose(f,p.get('start'));}
 }catch(e){error=e.message;}});
</script>
<div class="materials-page" data-ready={!!report}>
 <header>{#if document.querySelector('meta[name="htw-home"]')}<a data-site-home href={document.querySelector('meta[name="htw-home"]').content}>{$t("← 项目主页")}</a>{/if}<a href="./">{$t("← 理解图")}</a><strong>{$t("材料与解释覆盖")}</strong><LanguageToggle/><span>{report?.revision.slice(0,8)}</span></header>
 {#if report}<p class="coverage-summary">{report.summary.files}{$t(" 份材料 · ")}{report.summary.fullyAssignedFiles}{$t(" 份全部有归属 · ")}{report.summary.fullyExplainedFiles}{$t(" 份全部关联解释 · ")}{report.summary.gapFiles}{$t(" 份仍有缺口。关联情况不证明解释正确。")}</p>{/if}
 <div class="materials-body">
  <aside>
   <input aria-label={$t("搜索材料路径")} placeholder={$t("搜索材料路径…")} bind:value={query} oninput={filtered}/>
   <div class="coverage-filters" role="group" aria-label={$t("解释覆盖筛选")}>{#each [{id:'all',label:$t("全部"),count:report?.summary.files},{id:'covered',label:$t("已覆盖"),count:report?.summary.fullyExplainedFiles},{id:'gaps',label:$t("有缺口"),count:report?.summary.gapFiles}] as option}<button data-coverage-filter={option.id} aria-pressed={coverageFilter===option.id} onclick={()=>{coverageFilter=option.id;filtered();}}>{option.label}<small>{option.count??'—'}</small></button>{/each}</div>
   <p class="coverage-help">{$t("已覆盖：整份材料已关联解释。部分覆盖仍列在“有缺口”中。")}</p>
   <div class="tree-toolbar"><span data-match-count={matches.length}>{matches.length}{$t(" 份匹配材料")}</span><button onclick={()=>opened=new Set()}>{$t("收起目录")}</button></div>
   <ul class="material-tree" aria-label={$t("仓库目录")}>{@render branches(tree)}</ul>
   {#if report&&!matches.length}<p>{$t("没有匹配材料，可以更换筛选或搜索词。")}</p>{/if}
  </aside>
  <main>
   {#if error}<p role="alert">{$t(error)}</p>{/if}
   {#if selected}
    <h1>{selected.path}</h1><p>{$t(materialKind(selected.kind))} · {$t(status(selected))}{$t(" · 固定版本 ")}{report.revision.slice(0,8)}</p>
    <section><h2>{$t("由哪些单元解释")}</h2>
     {#each selected.owners as owner}<article><a href={'./#unit='+encodeURIComponent(owner.unit)}>{owner.title}</a><small> · {owner.wholeFile?$t("文件级"):`L${owner.start}–${owner.end}`} · {owner.status==='explained'?$t("已关联解释"):$t("待解释")}</small><p>{owner.note}</p></article>{:else}<p>{$t("尚无解释归属。引用该文件作为证据不会自动计为覆盖。")}</p>{/each}
     {#if selected.unassigned.length}<p>{$t("尚未归属：")}{selected.unassigned.map(r=>`L${r.start}–${r.end}`).join('，')}</p>{/if}
     {#if selected.pending.length}<p>{$t("已有归属，尚待解释：")}{selected.pending.map(r=>`L${r.start}–${r.end}`).join('，')}</p>{/if}
    </section>
    {#if loading}<p>{$t("读取固定版本原文…")}</p>{:else if selected.readable}
     <nav><button disabled={start<=1} onclick={()=>start=Math.max(1,start-linePage)}>{$t("前 ")}{linePage}{$t(" 行")}</button><span>{$t("行号 ")}{start}–{Math.min(selected.lines,start+linePage-1)}{$t(" 行 / ")}{selected.lines}</span><button disabled={start+linePage>selected.lines} onclick={()=>start+=linePage}>{$t("后 ")}{linePage}{$t(" 行")}</button></nav>
     <div class="material-source" aria-label={$t("固定版本原文")}>{#each source.slice(start-1,start-1+linePage) as line,i}<div><span>{start+i}</span><code>{line||' '}</code></div>{/each}</div>
    {:else}<p>{$t("该材料未提供文本原文（")}{$t(selected.unreadableReason)}{$t("），仍保留在覆盖清单中。")}</p>{/if}
   {:else}<h1>{$t("沿仓库目录查看材料与解释")}</h1><p>{$t("展开左侧目录，选择文件查看已有解释、覆盖缺口和固定版本原文。选择“已覆盖”可以直接找到已整理的材料。")}</p>{/if}
  </main>
 </div>
 <SourceNotice source={attribution}/>
</div>
{#snippet branches(nodes)}
 {#each nodes as node (node.path)}
  <li>{#if node.file}<button class="material-file" class:active={node.path===selected?.path} title={node.path} data-file={node.path} onclick={()=>choose(node.file)}><strong>{node.name}</strong><small>{$t(materialKind(node.file.kind))} · {$t(status(node.file))}{!node.file.readable?$t(" · 无文本原文"):''}</small></button>
   {:else}<details data-directory={node.path} open={opened.has(node.path)} ontoggle={event=>toggle(node.path,event.currentTarget.open)}><summary><span>{node.name}/</span><small>{node.count}</small></summary>{#if opened.has(node.path)}<ul>{@render branches(node.children)}</ul>{/if}</details>{/if}</li>
 {/each}
{/snippet}
<style>
 .coverage-filters{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.coverage-filters button{border:1px solid #d5dfd1;background:white;border-radius:8px;padding:8px 3px}.coverage-filters button[aria-pressed=true]{background:#e4efdf;border-color:#548267;font-weight:600}.coverage-help{font-size:12px;color:#72816e;line-height:1.7}.tree-toolbar{display:flex;justify-content:space-between;align-items:center;font-size:12px;margin:18px 0 10px}.tree-toolbar button{border:0;background:transparent;color:#53785c}.material-tree,.material-tree ul{list-style:none;padding:0;margin:0}.material-tree ul{margin-left:10px;padding-left:10px;border-left:1px solid #dce5db}.material-tree summary{cursor:pointer;padding:8px 4px;overflow-wrap:anywhere}.material-tree summary span{font-weight:600}.material-tree summary small{display:inline;margin-left:8px;font-size:11px;font-weight:400}.material-tree .material-file{font-size:12px;padding:9px 10px}.material-tree .material-file strong{font-weight:500}.material-tree .material-file small{font-size:11px}.material-tree button:focus-visible,.material-tree summary:focus-visible{outline:2px solid #548267;outline-offset:2px}
 .materials-page{height:100dvh;background:#f7f9f5;color:#263e36;font:14px/1.65 system-ui;display:flex;flex-direction:column}header{display:flex;flex-wrap:wrap;gap:16px;align-items:center;padding:20px 28px;border-bottom:1px solid #dce5db;background:white}header span{margin-left:auto;color:#748276}a{color:#316c59}.coverage-summary{margin:0;padding:12px 28px;background:#edf3e9}.materials-body{display:grid;grid-template-columns:350px 1fr;min-height:0;flex:1}aside,main{overflow:auto;padding:22px}aside{border-right:1px solid #dce5db}aside>input{box-sizing:border-box;width:100%;padding:10px;margin-bottom:10px}aside .material-file{display:block;width:100%;text-align:left;margin:7px 0;padding:12px;overflow-wrap:anywhere;background:white;border:1px solid #dce5db;border-radius:8px}aside .material-file.active{background:#dfebdd;border-color:#55806d}small{display:block;color:#687b6e}button{cursor:pointer;color:inherit}button:disabled{opacity:.45;cursor:default}nav{display:flex;gap:12px;align-items:center;margin:16px 0}nav button{padding:6px 12px}h1{font-size:23px;overflow-wrap:anywhere}h2{font-size:18px}article{margin:12px 0;padding:12px;background:white;border-radius:8px}article p{margin:4px 0}.material-source{overflow:auto;background:white;border:1px solid #dce5db;border-radius:8px;padding:14px;max-height:65vh}.material-source>div{display:flex;white-space:pre;font:12px/1.7 ui-monospace,monospace}.material-source span{width:45px;flex-shrink:0;color:#89958a;user-select:none}.material-source code{font:inherit}[role=alert]{color:#9a392d}@media(max-width:760px){.materials-body{grid-template-columns:1fr;overflow:auto;display:block}aside{max-height:35vh}main{overflow:visible}header{padding:14px;gap:12px}.coverage-summary{padding:10px 14px}}
</style>
