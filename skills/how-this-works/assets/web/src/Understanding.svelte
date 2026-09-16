<script>
 import {t} from '../../ui-language.js';
 import {onMount,tick} from 'svelte';
 import {SvelteFlow,Background,Controls,ViewportPortal,ConnectionMode,MarkerType,useSvelteFlow} from '@xyflow/svelte';
 import UnderstandingNode from './UnderstandingNode.svelte';
 import SourceNotice from './SourceNotice.svelte';
 import LanguageToggle from './LanguageToggle.svelte';
 import UnderstandingRelationEdge from './UnderstandingRelationEdge.svelte';
 import {focusScene,focusPorts,EVIDENCE_PAGE_SIZE,CONTEXT_NODE_SIZE} from './focus-layout.js';
 import {distributePorts} from './edge-layout.js';
 import './understanding.css';
 import {materialKind,supportRole,studyDepth} from './material-labels.js';
 import {ancestors,navigation} from './hierarchy.js';
 const flow=useSvelteFlow(),nodeTypes={understanding:UnderstandingNode},edgeTypes={relation:UnderstandingRelationEdge};
 let data=$state.raw(null),nodes=$state.raw([]),edges=$state.raw([]),selected=$state('overview'),expanded=$state(null),scenario=$state('all');
 let materialFor=$state(null),evidenceId=$state(null),evidencePage=$state(0),error=$state(''),mobileRead=$state(false),filter=$state(''),showComposition=$state(false),reader=$state(),graphStage=$state();
 let historyUnit=$state(null);
 let step=$state(null),processView=$state(),sourceDialog=$state();
 let viewport=$state({x:25,y:25,zoom:1}),ready=$state(false),cache={},scenes={},renderedScene=null;
 let scene=$state.raw(null),transitioning=$state(false),openClaim=$state(null),stack=$state.raw([]),sourceFull=$state(false),sourceLoading=$state(false),sourceError=$state(''),fullLines=$state.raw([]);
 const levels=$derived({fact:$t('实现事实'),author:$t('作者说明'),inference:$t('研究归纳')});
 const current=$derived(data?.nodes.find(n=>n.id===selected));
 const relation=$derived(data?.edges.find(e=>e.id===selected));
 const currentEvidence=$derived(evidenceId?data?.evidence[evidenceId]:null);
 const defaultScope=()=>{const rs=data?.nodes.filter(n=>!n.parent)||[];return rs.length===1&&data.nodes.some(n=>n.parent===rs[0].id)?rs[0].id:null;};
 const activeScenario=$derived(data?.scenarios.find(s=>s.id===scenario));
 const showProcess=$derived(selected==='scenario'||selected==='step');
 const showHistory=$derived(selected==='history'||selected.startsWith('history:'));
 const historyEvents=$derived((data?.history?.events||[]).filter(e=>!historyUnit||e.units.includes(historyUnit)));
 const historyEvent=$derived(data?.history?.events.find(e=>selected==='history:'+e.id));
 const showReading=$derived(showProcess||selected==='overview'||showHistory);
 const historyDate=value=>new Date(value).toLocaleDateString($t.language==='en'?'en-GB':'zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
 const reviewingScenario=$derived(selected==='architecture'&&scenario!=='all');
 const participating=$derived(new Set(scenario==='all'?[]:activeScenario?.nodes||[]));
 const currentStep=$derived(step===null?null:activeScenario?.steps?.[step]);
 const stepClaims=$derived((currentStep?.claims||[]).flatMap(id=>data.nodes.flatMap(n=>n.sections.filter(c=>c.id===id).map(c=>({...c,unit:n.id,unitTitle:n.title})))));
 const readingKey=()=>showHistory?`${selected}:${historyUnit||'all'}`:showProcess?`${scenario}:${selected}:${step??''}`:selected==='architecture'?`architecture:${scenario}`:selected;
 const roots=$derived(data?.nodes.filter(n=>!n.parent)||[]);
 const listed=$derived(navigation(data,expanded,filter));
 const currentChildren=$derived(data?.nodes.filter(n=>n.parent===selected)||[]);
 const currentAncestors=$derived(data?ancestors(data,selected):[]);
 const linkedEvidence=$derived(current?[...new Set(current.sections.flatMap(s=>s.evidence))]:relation?relation.evidence:[]);
 const focusRoot=$derived(current?(currentChildren.length?current:current.parent?data.nodes.find(n=>n.id===current.parent):null):data?.nodes.find(n=>n.id===expanded));
 const expandedRoot=$derived(data?.nodes.find(n=>n.id===expanded));
 const materialOwner=$derived(data?.nodes.find(n=>n.id===materialFor));
 const methodGroup=$derived.by(()=>{if(scene?.kind!=='methods')return null;const children=nodes.filter(n=>n.data.parent===expanded&&!n.data.contextRole);if(!children.length)return null;const x=Math.min(...children.map(n=>n.position.x))-36,y=Math.min(...children.map(n=>n.position.y))-48,right=Math.max(...children.map(n=>n.position.x+126))+36,bottom=Math.max(...children.map(n=>n.position.y+166))+22;return {x,y,width:right-x,height:bottom-y,count:children.length};});
 const scenarioHelp=$derived(Object.fromEntries((data?.scenarios||[]).map(s=>[s.id,s.help||s.description])));
 const methodCount=$derived(data?.nodes.filter(n=>n.parent).length||0);
 const storageKey=$derived(data?'understanding:'+data.revision+':'+(data.modelHash||data.edition)+':recursive-v1':'');
 const contextUnits=$derived(roots.filter(r=>r.id!==expanded&&!scene?.context?.[r.id]).map(r=>({unit:r,links:data.edges.filter(e=>e.kind!=='composition'&&((e.source===expanded&&e.target===r.id)||(e.target===expanded&&e.source===r.id)))})));
 let saveTimer,transitionId=0;
 const duration=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?0:220;
 function saveScroll(){const key=readingKey();cache[key]={...(cache[key]||{}),scroll:reader?.scrollTop||0,claim:openClaim,...(showReading?{processScroll:processView?.scrollTop||0}:{})};}
 async function restoreReading(){const saved=cache[readingKey()];if(showProcess&&saved)openClaim=saved.claim??null;await tick();if(reader)reader.scrollTop=saved?.scroll||0;if(showReading&&processView)processView.scrollTop=saved?.processScroll||0;}
 function scheduleSave(){saveScroll();clearTimeout(saveTimer);saveTimer=setTimeout(persist,120);}
 function captureScene(){if(!showReading&&renderedScene&&!transitioning)scenes[renderedScene]={viewport:flow.getViewport(),positions:Object.fromEntries(nodes.map(n=>[n.id,{...n.position}]))};}
 function persist(capture=true){if(!ready)return;if(capture)captureScene();const p=new URLSearchParams();p.set('unit',selected);if(expanded)p.set('inside',expanded);if(showHistory&&historyUnit)p.set('duty',historyUnit);if(showComposition)p.set('composition','1');if(scenario!=='all')p.set('task',scenario);if(step!==null)p.set('step',String(step));if(materialFor)p.set('materials',materialFor);if(evidencePage)p.set('page',String(evidencePage));if(evidenceId)p.set('evidence',evidenceId);if(openClaim)p.set('claim',openClaim);history.replaceState(null,'','#'+p);sessionStorage.setItem(storageKey,JSON.stringify({scenes,cache,stack}));}
 function snapshot(){captureScene();return {selected,expanded,scenario,step,materialFor,evidenceId,evidencePage,openClaim,historyUnit,showComposition,viewport:{...flow.getViewport()}};}
 function rebuild(){
  if(!data||showReading)return false;captureScene();
  const next=focusScene(data,{expanded,materialFor,evidencePage,compact:graphStage?.clientWidth<540});
  if(materialFor)evidencePage=next.page;const changed=next.key!==renderedScene,positions=scenes[next.key]?.positions||{};
  const neighbors=new Set([selected]);
  next.edges.filter(e=>e.source===selected||e.target===selected).forEach(e=>{neighbors.add(e.source);neighbors.add(e.target);});
  nodes=next.units.map(n=>{const context=next.context[n.id],size=context?CONTEXT_NODE_SIZE:126;return {id:n.id,type:'understanding',position:positions[n.id]||next.positions[n.id],width:size,height:size,selectable:false,connectable:false,ariaLabel:n.title,data:{...n,size,contextRole:context?.role,short:context?.caption||'',active:n.id===selected,dim:!context&&((reviewingScenario&&!participating.has(n.id))||(filter&&!listed.some(x=>x.id===n.id))||(expanded&&current?.parent===expanded&&n.parent&&!neighbors.has(n.id))),mark:n.parent?'↳':String(roots.findIndex(r=>r.id===n.id)+1).padStart(2,'0')}};});
  for(const id of next.evidence){const e=data.evidence[id],nid='ev:'+id;nodes.push({id:nid,type:'understanding',position:positions[nid]||next.positions[nid],width:126,height:126,selectable:false,connectable:false,ariaLabel:e.label,data:{title:e.path.split('/').at(-1),short:`L${e.start}–${e.end} · ${materialKind(e.kind)}`,material:true,materialKind:materialKind(e.kind),mark:'↗',active:evidenceId===id,dim:!!evidenceId&&evidenceId!==id}});}
  const actual=Object.fromEntries(nodes.map(n=>[n.id,n.position]));
  const routes=next.edges.map(e=>{const ports=expanded||materialFor?focusPorts(e,actual,next.context):[e.sourceHandle,e.targetHandle];return {...e,sourceHandle:ports[0],targetHandle:ports[1]};});
  const handles=distributePorts(nodes,routes);nodes=nodes.map(n=>({...n,data:{...n.data,handles:handles[n.id]||[]}}));
  const graphSelected=materialFor&&evidenceId?'ev:'+evidenceId:selected;
  const hasSelection=graphSelected!==next.owner&&(next.units.some(n=>n.id===graphSelected)||next.edges.some(e=>e.id===graphSelected)||next.evidence.some(id=>'ev:'+id===graphSelected));
  edges=routes.filter(e=>e.contextual||e.kind!=='composition'||showComposition).map(e=>{
   const support=e.kind==='evidence',chosen=e.id===graphSelected,incident=e.source===graphSelected||e.target===graphSelected,emphasized=chosen||incident,muted=(hasSelection&&!emphasized)||(reviewingScenario&&!(participating.has(e.source)&&participating.has(e.target)));
   const color=chosen?'#ae7849':support?'#ad9363':e.kind==='composition'?'#899eab':emphasized?'#356f5e':e.contextual?'#8d9e90':'#719384';
   const opacity=chosen?1:muted?.18:e.contextual?(incident?.8:.35):support?1:muted?.2:e.kind==='composition'?.65:.95;
   return {id:e.id,source:e.source,target:e.target,sourceHandle:e.sourceHandle,targetHandle:e.targetHandle,type:'relation',data:{fixedLabel:e.kind==='composition',contextual:e.contextual,muted,emphasized,read:id=>id.startsWith('support:')?showEvidence(id.slice(8)):select(id),outside:!e.contextual&&(e.kind==='composition'||support)&&actual[e.target].y>actual[e.source].y+350,routeX:actual[e.target].x<actual[e.source].x?Math.min(...nodes.filter(n=>!n.data.contextRole).map(n=>n.position.x))-55:Math.max(...nodes.filter(n=>!n.data.contextRole).map(n=>n.position.x))+181},label:e.kind==='composition'?(e.contextual?'所属单元':'组成'):e.label,selectable:false,style:`stroke:${color};stroke-width:${chosen?2.7:emphasized?2.1:1.25};${e.kind!=='cooperation'?'stroke-dasharray:4 5;':''}opacity:${opacity}`,markerEnd:{type:MarkerType.ArrowClosed,color,width:14,height:14}};
  });
  renderedScene=next.key;scene=next;return changed;
 }
 function fitted(){if(!nodes.length)return {x:25,y:25,zoom:1};const w=graphStage?.clientWidth||800,h=graphStage?.clientHeight||600;const x0=Math.min(...nodes.map(n=>n.position.x))-30,y0=Math.min(...nodes.map(n=>n.position.y))-(scene?.edges.some(e=>e.contextual&&e.kind==='feedback')?60:20),x1=Math.max(...nodes.map(n=>n.position.x+(n.width||126)))+30,y1=Math.max(...nodes.map(n=>n.position.y+(n.height||126)))+12;const zoom=Math.min((w-30)/(x1-x0),(h-55)/(y1-y0),1.14);return {x:(w-(x1-x0)*zoom)/2-x0*zoom,y:(h-55-(y1-y0)*zoom)/2-y0*zoom,zoom};}
 async function settle(changed,override=null){persist(false);if(showReading){await tick();return;}if(!changed&&!override){await tick();persist();return;}const token=++transitionId;await tick();if(changed||override){const target=override||scenes[scene.key]?.viewport||fitted();transitioning=true;await flow.setViewport(target,{duration:ready?duration():0});if(token!==transitionId)return;transitioning=false;}persist();}
 async function select(id,{remember=true,show=true}={}){
  saveScroll();if(remember&&id!==selected)stack=[...stack,snapshot()];
  selected=id;if(id==='overview'){scenario='all';step=null;}evidenceId=null;sourceFull=false;openClaim=null;evidencePage=0;
  const node=data.nodes.find(n=>n.id===id);
  if(id==='overview'||id==='architecture')expanded=defaultScope();
  else if(node?.parent)expanded=node.parent;
  else if(node&&expanded)expanded=data.nodes.some(n=>n.parent===id)?id:null;
  const edge=data.edges.find(e=>e.id===id);if(edge){const owner=data.nodes.find(n=>n.id===edge.target)?.parent||data.nodes.find(n=>n.id===edge.source)?.parent;if(owner)expanded=owner;}
  if(!edge)materialFor=null;mobileRead=show&&id!=='overview';const changed=rebuild();await settle(changed);if(selected===id)await restoreReading();persist();
 }
 async function showEvidence(id,claimId=null){evidenceId=id;openClaim=claimId;sourceFull=false;fullLines=[];sourceError='';sourceLoading=false;if(materialFor){const refs=[...new Set(materialOwner.sections.flatMap(s=>s.evidence))],i=refs.indexOf(id);if(i>=0)evidencePage=Math.floor(i/EVIDENCE_PAGE_SIZE);}const changed=rebuild();await settle(changed);await tick();document.querySelector('.u-source')?.scrollIntoView({block:'nearest',behavior:'instant'});}
 async function fullSource(){if(!currentEvidence)return;const id=evidenceId,e=currentEvidence;sourceLoading=true;sourceError='';try{const r=await fetch(data.modelHash?e.text_file:'../atlas/'+e.text_file);if(!r.ok)throw Error('原文暂时不可用');const raw=new Uint8Array(await r.arrayBuffer());if(e.oid){const prefix=new TextEncoder().encode('blob '+raw.length+'\0'),payload=new Uint8Array(prefix.length+raw.length);payload.set(prefix);payload.set(raw,prefix.length);const digest=await crypto.subtle.digest(e.oid.length===64?'SHA-256':'SHA-1',payload),oid=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');if(oid!==e.oid)throw Error('原文与固定版本不一致，请重建材料');}const text=new TextDecoder().decode(raw);if(id!==evidenceId)return;fullLines=text.split('\n').map((text,i)=>({text,number:i+1}));sourceFull=true;await tick();if(!sourceDialog?.open)document.querySelector('.u-source-line.u-highlight')?.scrollIntoView({block:'center',behavior:'instant'});}catch(e){if(id===evidenceId)sourceError=e.message;}finally{if(id===evidenceId)sourceLoading=false;}}
 async function panTo(id){await tick();const n=nodes.find(n=>n.id===id);if(!n||!graphStage)return;const p=flow.getViewport(),h=graphStage.clientHeight,w=graphStage.clientWidth,x=n.position.x*p.zoom+p.x,y=n.position.y*p.zoom+p.y,size=160*p.zoom;const dx=x<25?25-x:x+size>w-25?w-25-x-size:0,dy=y<20?20-y:y+size>h-60?h-60-y-size:0;if(dx||dy)await flow.setViewport({...p,x:p.x+dx,y:p.y+dy});persist();}
 async function expand(owner=focusRoot?.id){if(!owner||!data.nodes.some(n=>n.parent===owner))return;saveScroll();stack=[...stack,snapshot()];const closing=expanded===owner&&!materialFor;expanded=closing?(data.nodes.find(n=>n.id===owner)?.parent||null):owner;materialFor=null;evidenceId=null;openClaim=null;evidencePage=0;if(closing&&current?.parent===owner)selected=owner;const changed=rebuild();await settle(changed);}
 async function materials(){saveScroll();stack=[...stack,snapshot()];materialFor=materialFor===selected?null:selected;if(materialFor)expanded=current.parent||current.id;evidencePage=0;const changed=rebuild();await settle(changed);}
 async function evidenceTurn(delta){evidencePage+=delta;evidenceId=null;const changed=rebuild();await settle(changed);}
 async function methodsView(){materialFor=null;evidencePage=0;const changed=rebuild();await settle(changed);}
 async function back(){if(!stack.length)return;saveScroll();captureScene();const s=stack.at(-1);stack=stack.slice(0,-1);({selected,expanded,scenario,materialFor,evidenceId}=s);step=s.step??null;historyUnit=s.historyUnit??null;evidencePage=s.evidencePage||0;showComposition=!!s.showComposition;openClaim=s.openClaim||null;const changed=rebuild();await settle(changed,s.viewport);await restoreReading();persist();}
 async function task(id,index=null){
  if(showProcess&&scenario===id&&step===index)return;
  if(id==='all'){await select('architecture');return;}
  saveScroll();stack=[...stack,snapshot()];
  scenario=id;step=index;selected=index===null?'scenario':'step';materialFor=null;evidenceId=null;openClaim=null;sourceFull=false;evidencePage=0;
  mobileRead=true;await tick();await restoreReading();persist();
 }
 async function openHistory(unit=null){await select('history');historyUnit=unit;await tick();await restoreReading();persist();}
 async function chooseHistoryEvent(id){const top=processView?.scrollTop||0;await select('history:'+id);if(processView)processView.scrollTop=top;persist();}
 async function chooseStep(index){const top=processView?.scrollTop||0;await task(scenario,index);if(processView){processView.scrollTop=top;processView.querySelector(`[data-process-step="${index}"]`)?.scrollIntoView({block:'nearest'});}persist();} 
 async function fit(){await tick();await settle(false,fitted());}
 function changeFilter(){rebuild();}
 function nodeClick({node}){if(node.id.startsWith('ev:')){mobileRead=true;showEvidence(node.id.slice(3));}else select(node.id);}
 onMount(()=>{
  const flush=()=>{saveScroll();persist();};window.addEventListener('pagehide',flush);document.body.classList.add('understanding-page');
  (async()=>{try{const r=await fetch('./understanding.json',{cache:'no-store'});if(!r.ok)throw Error('理解图数据读取失败');data=await r.json();document.title=(data.displayName||data.repo)+' · How This Works';const p=new URLSearchParams(location.hash.slice(1));showComposition=p.has('composition');selected=p.get('unit')||'overview';const requested=p.get('inside')==='1'?'delivery':p.get('inside');expanded=requested&&data.nodes.some(n=>n.parent===requested)?requested:(!p.has('inside')?defaultScope():null);const selectedNode=data.nodes.find(n=>n.id===selected);if(selectedNode?.parent&&selected!==expanded&&selectedNode.parent!==expanded)expanded=selectedNode.parent;scenario=data.scenarios.some(s=>s.id===p.get('task'))?p.get('task'):'all';
 const requestedStep=p.has('step')?Number(p.get('step')):null;step=Number.isInteger(requestedStep)&&requestedStep>=0&&requestedStep<(activeScenario?.steps?.length||0)?requestedStep:null;
 historyUnit=data.nodes.some(n=>n.id===p.get('duty'))?p.get('duty'):null;
 if(!['overview','coverage','scenario','step','architecture'].includes(selected)&&!(data.history&&(selected==='history'||data.history.events.some(e=>selected==='history:'+e.id)))&&!data.nodes.some(n=>n.id===selected)&&!data.edges.some(e=>e.id===selected))selected='overview';
 if(showProcess&&scenario==='all')selected='overview';if(selected==='step'&&step===null)selected='scenario';materialFor=data.nodes.some(n=>n.id===p.get('materials'))?p.get('materials'):null;if(materialFor){const owner=data.nodes.find(n=>n.id===materialFor);expanded=owner.parent||owner.id;selected=owner.id;}evidencePage=Math.max(0,Number(p.get('page'))||0);evidenceId=data.evidence[p.get('evidence')]?p.get('evidence'):null;openClaim=data.nodes.some(n=>n.sections.some(c=>c.id===p.get('claim')))?p.get('claim'):null;let restored=null;try{restored=JSON.parse(sessionStorage.getItem(storageKey));}catch{}cache=restored?.cache||{};scenes=restored?.scenes||{};stack=restored?.stack||[];await tick();const changed=rebuild();await settle(changed);await restoreReading();ready=true;persist();}catch(e){error=e.message;}})();
  return()=>{clearTimeout(saveTimer);window.removeEventListener('pagehide',flush);document.body.classList.remove('understanding-page');};
 });
</script>
<div class="u-app" class:u-reading={mobileRead} data-ready={ready} data-model-hash={data?.modelHash} data-scene={showHistory?selected:selected==='overview'?'introduction':showProcess?'scenario:'+scenario:selected==='architecture'?'architecture:'+scenario:scene?.key} data-transitioning={transitioning}>
 <header class="u-header"><a class="u-brand" href="?view=understand"><span class="u-logo">⌘</span><strong>{data?.displayName||data?.repo?.split('/').at(-1)||$t("项目")}</strong><span>{$t("How This Works · 独立解读")}</span></a><nav aria-label={$t("视图")}>{#if document.querySelector('meta[name="htw-home"]')}<a data-site-home href={document.querySelector('meta[name="htw-home"]').content}>{$t("← 项目主页")}</a>{/if}<a class="u-nav-active" href="?view=understand">{$t("理解图")}</a><a href="?view=materials">{$t("材料与覆盖 ↗")}</a></nav><LanguageToggle/><span class="u-revision">{$t("固定快照 · ")}{data?.revision.slice(0,8)||'…'}</span></header>
 {#if error}<div class="u-error" role="alert">{$t(error)}{$t("。请通过本地预览服务打开页面。")}<button onclick={()=>location.reload()}>{$t("重试")}</button></div>{:else if data}
 <div class="u-body">
  <aside class="u-sidebar" aria-label={$t("理解入口")}>
   <button class="u-intro-link" class:active={selected==='overview'} onclick={()=>select('overview')}>{$t("认识这个项目 ")}<span>↗</span></button>
   <section class="u-functions" aria-label={$t("功能与使用场景")}><h2>{$t("功能与使用场景")}</h2><p>{$t("选一件事，看它怎样完成")}</p>
    <div class="u-task-list">{#each data.scenarios.filter(s=>s.id!=='all') as s}<button aria-label={s.label} aria-pressed={scenario===s.id} data-scenario={s.id} onclick={()=>task(s.id)}><span class="u-feature-icon">{s.id==='assistant'?'⌘':s.id==='human'?'◎':'⚙'}</span><span><strong>{s.label}</strong><small>{scenarioHelp[s.id]||s.description}</small></span><span class="u-feature-arrow">›</span></button>{/each}</div>
   </section>
   <button class="u-all-scenario" data-architecture aria-pressed={selected==='architecture'} onclick={()=>select('architecture')}>{$t("回看整体架构 ")}<span>{$t("归纳与比较 ↗")}</span></button>
   {#if data.history}<button class="u-all-scenario" data-open-history onclick={()=>openHistory()}>{$t("设计演化 ")}<span>{$t("理解变化的来路 →")}</span></button>{/if}
   <details class="u-unit-index" open={selected!=='overview'&&!showProcess}><summary>{$t("按职责查阅")}</summary><div class="u-section-label"><span>{$t("职责索引")}</span><small>{data.nodes.length}{$t(" 个职责")}</small></div>
   <input class="u-search" aria-label={$t("搜索理解单元")} placeholder={$t("查找单元或解释…")} bind:value={filter} oninput={changeFilter}/>
   <div class="u-unit-list">{#each listed as n}<button data-index={n.id} class:active={selected===n.id} class:u-child={n.parent} style={`margin-left:${n.navLevel*10}px`} onclick={async()=>{await select(n.id);await panTo(n.id);}}><span class="u-index-dot" class:u-deep={!n.parent}></span><span>{n.title}<small>{data.nodes.some(c=>c.parent===n.id)?data.nodes.filter(c=>c.parent===n.id).length+$t(" 项内部职责"):(n.parent?$t("内部职责"):$t("独立职责"))}</small></span></button>{/each}{#if !listed.length}<p>{$t("没有匹配的单元。")}</p>{/if}</div>
   </details><div class="u-sidebar-foot"><span class="u-eyebrow">{$t("研究范围")}</span><p>{$t("整体与局部均可阅读")}<br><strong>{data.nodes.length}{$t(" 个职责 · ")}{data.scenarios.filter(s=>s.id!=='all').length}{$t(" 个场景")}</strong></p><button onclick={()=>select('coverage')}>{$t("研究覆盖与验证边界 →")}</button></div>
  </aside>
  <main class="u-map-column">
   <div class="u-map-heading"><details class="u-compact-functions"><summary>{$t("功能与使用场景 · ")}{scenario==='all'?$t('项目全貌'):activeScenario.label}</summary><div>{#each data.scenarios.filter(s=>s.id!=='all') as s}<button aria-label={s.label} aria-pressed={scenario===s.id} onclick={event=>{task(s.id);event.currentTarget.closest('details').open=false;}}><strong>{s.label}</strong><small>{scenarioHelp[s.id]||$t("从全部单元认识项目")}</small></button>{/each}{#if data.history}<button onclick={event=>{openHistory();event.currentTarget.closest('details').open=false;}}>{$t("设计演化 →")}</button>{/if}</div></details><span class="u-current-function">{showHistory?$t("设计演化"):selected==='overview'?$t("认识项目"):selected==='architecture'?$t("回看架构"):scenario==='all'?$t("职责与实现"):$t("功能场景 · ")+activeScenario.label}</span><button class="u-mobile-intro" onclick={()=>select('overview')}>{$t("认识项目 →")}</button><span class="u-eyebrow">{$t("理解图 / ")}{showHistory?$t("历史视角"):selected==='overview'?$t("学习起点"):selected==='architecture'?(reviewingScenario?$t("场景分工"):$t("整体职责")):showProcess?$t("场景过程")+(currentStep?$t(" / 第 ")+(step+1)+$t(" 步"):''):materialFor?expandedRoot?.title+$t(" / 材料依据"):expandedRoot?expandedRoot.title+$t(" / 内部职责"):$t("项目整体协作")}</span><h1>{showHistory?$t("为什么形成现在的设计"):selected==='overview'?data.intro.title:selected==='architecture'?$t("回看整体架构"):showProcess?activeScenario.label:materialFor?$t("哪些材料支撑这项解释？"):current?current.title:expandedRoot?expandedRoot.question:$t("这个项目怎样协同工作？")}</h1><p>{showHistory?$t("沿实际变化阅读旧问题、采用的办法与留下的代价；从事件返回当前职责。"):selected==='overview'?$t("先认识用途，再跟随一件具体的事，理解各部分怎样配合。"):selected==='architecture'?(reviewingScenario?$t("保留当前场景：突出实际参与的职责，右侧对照步骤与分工。"):$t("选择职责查看它的作用；从场景返回，可对照这件事怎样由各部分完成。")):showProcess?$t("沿过程认识职责；选一步读解释，选承担者看设计与源码。"):materialFor?$t("沿上层归属与同层协作理解当前解释，再核对原文依据。"):expanded?$t("当前内容居中，上层与直接相关同层节点在外围保留。"):$t("{0} 个项目单元。选择圆点读解释，按需展开，再核对具体依据。",roots.length)}</p></div>
   <div class="u-focus-path">{#if scenario!=='all'}<button onclick={()=>task(scenario)}>← {scenario==='all'?$t('项目全貌'):activeScenario.label}</button>{#if currentStep}<span>/</span><button onclick={()=>task(scenario,step)}>{currentStep.title}</button>{/if}{:else if expanded&&selected!=='overview'&&!showHistory}<button data-return-overview onclick={()=>select('architecture',{show:false})}>{$t("← 回看整体架构")}</button><span>/</span><button onclick={()=>materialFor?methodsView():select(expanded,{show:false})}>{expandedRoot?.title}</button>{#if materialFor}<span>/</span><span>{materialOwner?.title}{$t("的依据")}</span>{/if}{/if}</div>
   {#if showHistory}
    <section class="u-process u-history" aria-label={$t("设计演化时间轴")} bind:this={processView} onscroll={scheduleSave}>
     <p class="u-history-intro">{data.history.summary}</p>
     <label class="u-history-filter">{$t("查看相关职责 ")}<select aria-label={$t("历史职责筛选")} value={historyUnit||''} onchange={event=>openHistory(event.currentTarget.value||null)}><option value="">{$t("全部演化事件（含已退出的方案）")}</option>{#each data.nodes as n}<option value={n.id}>{n.title}</option>{/each}</select></label>
     <ol class="u-history-list">{#each historyEvents as event}<li class:u-history-active={historyEvent?.id===event.id}><button data-history-event={event.id} onclick={()=>chooseHistoryEvent(event.id)}><time>{historyDate(event.date)}</time><strong>{event.title}</strong><p>{event.summary}</p><span>{$t("看当时的问题与改变 →")}</span></button></li>{:else}<li>{$t("这项职责的历史尚未整理；这不表示它没有发生变化。")}<button onclick={()=>openHistory()}>{$t("查看全部事件 →")}</button></li>{/each}</ol>
     <p class="u-process-note">{$t("日期采用提交者时间，按北京时间显示；多提交事件按最早提交排序，不等同于发布日期。")}</p>
    </section>
    <div class="u-process-tools"><button disabled={!stack.length} onclick={back} aria-label={$t("退回上一步")}>{$t("↶ 返回阅读位置")}</button><button onclick={()=>select(historyUnit||'architecture')}>{$t("查看当前")}{historyUnit?$t("职责"):$t("架构")} →</button></div>
   {:else if selected==='overview'}
    <section class="u-process u-introduction" aria-label={$t("认识项目")} bind:this={processView} onscroll={scheduleSave}>
     <p class="u-intro-lead">{data.intro.text}</p>
     {#if data.intro.example}<div class="u-example"><span>{$t("从一个例子认识它")}</span><p>{data.intro.example}</p></div>{/if}
     <h2>{$t("选一件事，看看它怎样完成")}</h2>
     <div class="u-start-scenarios">{#each data.scenarios.filter(s=>s.id!=='all') as item,i}<button data-start-scenario={item.id} onclick={()=>task(item.id)}><span>{$t("场景 ")}{i+1}</span><strong>{item.label} →</strong><p>{item.description}</p></button>{/each}</div>
     <p class="u-intro-footnote">{$t("读过一个场景后，再回看整体架构，理解哪些职责共同完成了这件事。")}</p>
    </section>
   {:else if showProcess}
    <section class="u-process" aria-label={$t("场景过程")} bind:this={processView} onscroll={scheduleSave}>
     <div class="u-process-intro"><span class="u-eyebrow">{$t("从起点到结果")}</span><p>{activeScenario.start||activeScenario.description}</p></div>
     {#if activeScenario.steps?.length}
      <ol class="u-process-list">{#each activeScenario.steps as item,i}
       <li class:u-step-active={selected==='step'&&step===i} class:u-step-muted={selected==='step'&&step!==i} data-process-step={i}>
        <button class="u-step-title" aria-pressed={selected==='step'&&step===i} onclick={()=>chooseStep(i)}><span>{String(i+1).padStart(2,'0')}</span><strong>{item.title}</strong><span>→</span></button>
        <div class="u-step-units"><small>{$t("由谁承担")}</small>{#each item.nodes as id}<button data-step-unit={id} onclick={async()=>{await chooseStep(i);await select(id);}}>{data.nodes.find(n=>n.id===id)?.title} ↗</button>{/each}</div>
       </li>
      {/each}</ol>
      <div class="u-process-outcome"><strong>{$t("结果与边界")}</strong><p>{activeScenario.outcome}</p></div>
     {:else}<p>{$t("这个场景尚未整理过程。可以先查看已关联的职责。")}</p><div class="u-method-links">{#each activeScenario.nodes as id}<button onclick={()=>select(id)}>{data.nodes.find(n=>n.id===id)?.title} →</button>{/each}</div>{/if}
     <p class="u-process-note">{$t("按场景组织的过程说明。条件和例外见每一步，原文依据可在右侧核对。")}</p>
    </section>
    <div class="u-process-tools"><button disabled={!stack.length} onclick={back}>{$t("↶ 退回")}</button><button data-review-architecture onclick={()=>select('architecture')}>{$t("回看整体架构")}</button></div>
   {:else}<div class="u-graph" bind:this={graphStage} data-expanded={expanded}>
    <SvelteFlow ariaLabelConfig={{'controls.zoomIn.ariaLabel':$t('放大'),'controls.zoomOut.ariaLabel':$t('缩小'),'controls.ariaLabel':$t('图谱控制')}} bind:nodes bind:edges bind:viewport {nodeTypes} {edgeTypes} connectionMode={ConnectionMode.Loose} minZoom={.25} maxZoom={1.8} nodesConnectable={false} edgesReconnectable={false} elementsSelectable={false} nodesDraggable zoomOnDoubleClick={false} deleteKey={null} onnodeclick={nodeClick} onedgeclick={({edge})=>edge.id.startsWith('support:')?showEvidence(edge.id.slice(8)):select(edge.id)} onnodedragstop={persist} onmoveend={persist} proOptions={{hideAttribution:true}}>
     {#if methodGroup}<ViewportPortal target="back"><div class="u-method-region" style={`left:${methodGroup.x}px;top:${methodGroup.y}px;width:${methodGroup.width}px;height:${methodGroup.height}px`}><span>{expandedRoot.title} · {methodGroup.count}{$t(" 项内部职责")}</span><button class="nodrag nopan" aria-pressed={showComposition} onclick={()=>{showComposition=!showComposition;rebuild();persist();}}>{showComposition?$t("收起组成线"):$t("显示组成线")}</button></div></ViewportPortal>{/if}
     <Background color="#d9e1d9" gap={23} size={1}/><Controls showInteractive={false} showFitView={false}/>
    </SvelteFlow>
    <div class="u-map-tools"><button disabled={!stack.length} onclick={back} aria-label={$t("退回上一步")}>{$t("↶ 退回")}</button><button onclick={fit}>{$t("适应当前图")}</button><button class:u-on={expanded} disabled={!focusRoot} onclick={()=>materialFor?methodsView():expand()}>{materialFor?$t("返回职责图"):focusRoot&&expanded===focusRoot.id?$t("收起内部职责"):$t("展开内部职责")}</button></div>
   </div>{/if}
   {#if !showReading&&materialFor&&scene?.total>EVIDENCE_PAGE_SIZE}<div class="u-evidence-pager"><button disabled={scene.page===0} onclick={()=>evidenceTurn(-1)}>{$t("← 上一组")}</button><span>{$t("依据 ")}{scene.page*EVIDENCE_PAGE_SIZE+1}–{Math.min((scene.page+1)*EVIDENCE_PAGE_SIZE,scene.total)} / {scene.total}</span><button disabled={(scene.page+1)*EVIDENCE_PAGE_SIZE>=scene.total} onclick={()=>evidenceTurn(1)}>{$t("下一组 →")}</button></div>{/if}
   {#if !showReading&&expanded&&contextUnits.length}<section class="u-context-rail" aria-label={$t("其他项目单元")}><div class="u-context-caption"><span>{$t("项目上下文")}</span><small>{$t("其余单元 · 图内已保留直接关联")}</small></div><div class="u-context-items">{#each contextUnits as item}<button class:u-context-related={item.links.length>0} data-context={item.unit.id} onclick={()=>select(item.unit.id,{show:false})}><i></i><span>{item.unit.title}<small>{item.links[0]?.label||$t("其他项目职责")}</small></span></button>{/each}</div></section>{/if}
   {#if !showReading}<footer class="u-map-footer"><span><i></i>{$t(" 协作")}</span><span><i class="u-group-key"></i>{$t(" 分组表示组成")}</span><span><i class="dashed"></i>{$t(" 归属 / 后续参考")}</span><span><i class="evidence"></i>{$t(" 材料依据")}</span><small>{$t("连线可点读 · 拖动与缩放 · 研究归纳，非执行轨迹")}</small></footer>{/if}
  </main>
  <aside class="u-reader" aria-label={$t("项目解释与依据")} bind:this={reader} onscroll={scheduleSave}>
   <button class="u-mobile-close" onclick={()=>mobileRead=false}>← {showHistory?$t("回到时间轴"):selected==='overview'?$t("回到项目介绍"):showProcess?$t("回到过程"):$t("回到图谱")}</button>
   {#if data.research&&(selected==='overview'||selected==='coverage')}
    <details class="u-reader-note u-research-details" data-research-stage={data.research.stage}>
     <summary><strong>{data.research.stage==='complete'?(data.explanationCoverage?.gapFiles?$t("完整整理仍有缺口"):$t("完整解释已登记")):data.research.stage==='deepening'?$t("架构已形成 · 可继续深入"):$t("整体架构整理中")}</strong></summary>
     <p data-delivery-summary>{data.nodes.length}{$t(" 个单元 · ")}{data.nodes.reduce((sum,n)=>sum+n.sections.length,0)}{$t(" 条解释 · ")}{data.edges.length}{$t(" 条关系。")}{data.delivery?.status==='built'?(data.delivery.ui?$t("理解图已生成。"):$t("仅生成数据产物。")):$t("未记录页面构建结果。")}</p>
     <p>{$t("本次目标：")}{data.research.target==='architecture'?$t("架构理解"):$t("完整整理")}{$t("。进度由研究者记录，当前解释缺口仍以材料覆盖为准。")}</p>
     {#if data.research.summary}<p>{data.research.summary}</p>{/if}
     {#if data.research.remaining?.length}<details><summary>{$t("尚未深入的范围")}</summary><ul>{#each data.research.remaining as item}<li>{item}</li>{/each}</ul></details>{/if}
    </details>
   {/if}
   {#if !showHistory&&stack.at(-1)?.selected?.startsWith('history')}<div class="u-reader-origin"><span>{$t("从历史来到当前快照 · ")}{data.revision.slice(0,8)}</span><button data-return-history onclick={back}>{$t("← 返回")}{data.history?.events.find(e=>'history:'+e.id===stack.at(-1).selected)?.title||$t("设计演化")}</button></div>{/if}
   {#if scenario!=='all'&&!showProcess}<div class="u-reader-origin"><span>{$t("从场景来到这里")}</span><button onclick={()=>task(scenario,step)}>{scenario==='all'?$t('项目全貌'):activeScenario.label}{currentStep?' / '+currentStep.title:''} ↩</button></div>{/if}
   {#if showHistory}
    {@render historicalExplanation()}
   {:else if selected==='scenario'}
    <span class="u-eyebrow">{$t("理解一件事")}</span><h2>{scenario==='all'?$t('项目全貌'):activeScenario.label}</h2><p class="u-lead">{activeScenario.description}</p>
    {#if activeScenario.start}<h3>{$t("从什么情况开始")}</h3><p>{activeScenario.start}</p>{/if}
    <h3>{$t("事情怎样发生")}</h3><div class="u-scenario-index">{#each activeScenario.steps||[] as item,i}<button data-reader-step={i} onclick={()=>chooseStep(i)}><span>{i+1}</span>{item.title} →</button>{/each}</div>
    {#if activeScenario.outcome}<h3>{$t("最后得到什么")}</h3><p>{activeScenario.outcome}</p>{/if}
    <p>{activeScenario.steps?.length?$t("选择中间的一步，查看条件、分工和依据；再进入承担职责的单元，理解设计与实现。"):$t("这个场景尚未整理过程，可以先从中间列出的职责进入。")}</p>
   {:else if selected==='step'&&currentStep}
    <button class="u-text-button" onclick={()=>task(scenario)}>← {scenario==='all'?$t('项目全貌'):activeScenario.label}</button><span class="u-eyebrow">{$t("第 ")}{step+1}{$t(" 步 / ")}{activeScenario.steps.length}</span><h2>{currentStep.title}</h2><p class="u-lead">{currentStep.text}</p>
    <h3>{$t("这一步由谁承担")}</h3><div class="u-method-links">{#each currentStep.nodes as id}<button data-reader-unit={id} onclick={()=>select(id)}>{data.nodes.find(n=>n.id===id)?.title} →</button>{/each}</div>
    <h3>{$t("进一步理解这一步")}</h3>{#each stepClaims as claim (claim.id)}
     <details class="u-step-explanation" data-step-claim={claim.id} open={openClaim===claim.id} ontoggle={event=>{if(event.currentTarget.open)openClaim=claim.id;else if(openClaim===claim.id)openClaim=null;persist();}}>
      <summary><span class="u-claim-level">{levels[claim.level]}</span><strong>{claim.title}</strong><small>{$t("展开解释")}</small></summary>
      <p class="u-explanation-text">{claim.text}</p>
      <button class="u-text-button" data-claim-owner={claim.unit} onclick={()=>select(claim.unit)}>{$t("查看完整职责：")}{claim.unitTitle} →</button>
      <h4>{$t("核对这条解释的原文")}</h4><div class="u-evidence-buttons">{#each claim.evidence as id}<button title={data.evidence[id].path} onclick={()=>showEvidence(id,claim.id)}>{$t(materialKind(data.evidence[id].kind))} · {data.evidence[id].label} ↗</button>{/each}</div>
      {#if currentEvidence&&openClaim===claim.id&&claim.evidence.includes(evidenceId)}{@render source()}{/if}
     </details>
    {/each}
    <div class="u-step-pager"><button disabled={step===0} onclick={()=>chooseStep(step-1)}>{$t("← 上一步")}</button><button disabled={step===activeScenario.steps.length-1} onclick={()=>chooseStep(step+1)}>{$t("下一步 →")}</button></div>
   {:else if selected==='coverage'}
    {#if stack.length}<button class="u-text-button" onclick={back}>{$t("← 返回刚才阅读的位置")}</button>{/if}
    <span class="u-eyebrow">{$t("保持研究边界可见")}</span><h2>{$t("已覆盖什么，哪些尚未验证")}</h2><p>{$t("这是一份固定版本的研究解释，包含 ")}{roots.length}{$t(" 个项目单元和 ")}{methodCount}{$t(" 个内部职责。划分来自材料研究，具体覆盖与边界见各单元的说明。")}</p>
    {#if data.explanationCoverage}<div class="u-reader-note"><strong>{$t("解释归属覆盖")}</strong><p>{data.explanationCoverage.fullyExplainedFiles} / {data.explanationCoverage.files}{$t(" 份材料已全部关联解释，")}{data.explanationCoverage.gapFiles}{$t(" 份仍有缺口。关联覆盖不证明解释正确。")}</p></div>{/if}
    <h3>{$t("仍需另行验证和研究")}</h3><ul>{#each data.omitted as item}<li>{item}</li>{/each}</ul><p>{data.validationNote||$t("脚本校验出处和结构，运行验证范围由研究记录说明。引用测试文件不代表已经执行测试。")}</p><a href="?view=materials">{$t("查看全部材料与解释缺口 ↗")}</a>
   {:else if selected==='overview'}
    <span class="u-eyebrow">{$t("怎样开始学习")}</span><h2>{$t("先跟随一件具体的事")}</h2>
    <p>{$t("从中间选一个你关心的场景。先看事情从哪里开始、经过哪些步骤、最后得到什么，再进入承担这些步骤的职责。")}</p>
    <ol class="u-learning-guide"><li><strong>{$t("看过程")}</strong><p>{$t("选择一步，右侧说明它为什么发生、有什么条件、由谁承担。")}</p></li><li><strong>{$t("看设计与依据")}</strong><p>{$t("进入职责读它的机制和边界；需要核实时再打开源码。")}</p></li><li><strong>{$t("回看架构")}</strong><p>{$t("把刚才的步骤与职责对应起来，再看看这些职责还参与哪些场景。")}</p></li></ol>
    <p>{$t("学习中可以退回原步骤。研究覆盖与未验证范围始终保留，不要求先读完源码。")}</p><button class="u-text-button" onclick={()=>select('coverage')}>{$t("查看研究边界 →")}</button>
   {:else if selected==='architecture'}
    {#if data.history}<button class="u-history-entry" onclick={()=>openHistory()}>{$t("为什么形成现在的架构？查看设计演化 →")}</button>{/if}
    <span class="u-eyebrow">{$t("从具体过程归纳分工")}</span><h2>{reviewingScenario?$t("这个场景怎样分工"):$t("把职责放回具体场景")}</h2>
    {#if reviewingScenario}
     <p class="u-lead">{scenario==='all'?$t('项目全貌'):activeScenario.label}</p><p>{$t("图中突出本场景实际参与的职责。下面把同一职责承担的步骤放在一起，点击步骤可以回到过程。")}</p>
     {#each activeScenario.nodes.map(id=>data.nodes.find(n=>n.id===id)) as n}<section class="u-architecture-role" data-role-unit={n.id}><button class="u-claim-link" onclick={()=>select(n.id)}>{n.title} ↗</button><div>{#each activeScenario.steps||[] as item,i}{#if item.nodes.includes(n.id)}<button class="u-role-step" onclick={()=>task(scenario,i)}>{$t("第 ")}{i+1}{$t(" 步 · ")}{item.title} →</button>{/if}{/each}</div></section>{/each}
     <h3>{$t("继续理解另一个场景")}</h3><p>{$t("留意哪些职责继续出现，它们在另一件事里承担了什么。")}</p>
    {:else}<p>{$t("整体图用于回看职责与协作。读过一个场景后，从它的“回看整体架构”进入，就能同时看到参与职责和具体分工。")}</p>{/if}
    <div class="u-scenario-index">{#each data.scenarios.filter(s=>s.id!=='all'&&s.id!==scenario) as item}<button onclick={()=>task(item.id)}>{item.label} →</button>{/each}</div>
   {:else if current}
    <div class="u-breadcrumb"><button onclick={()=>select('architecture')}>{$t("回看架构")}</button>{#each currentAncestors as parent}<span>/</span><button onclick={()=>select(parent.id)}>{parent.title}</button>{/each}<span>/</span><span>{current.title}</span></div>
    <span class="u-status">{$t("职责说明 · ")}{current.parent?$t("所属职责的内部组成"):$t("项目总体职责")}</span><h2>{current.title}</h2><p class="u-lead">{current.summary}</p>
    {#if data.history}<button class="u-history-entry" data-duty-history onclick={()=>openHistory(current.id)}>{$t("这项职责怎样演变而来？ → ")}<small>{data.history.events.filter(e=>e.units.includes(current.id)).length}{$t(" 个已整理事件")}</small></button>{/if}
    {#if currentChildren.length}<button class="u-cta" onclick={()=>expand(current.id)}>{expanded===current.id?$t("收起图中的内部职责"):$t("在图中展开 ")+currentChildren.length+$t(" 项内部职责")} <span>{expanded===current.id?'−':'＋'}</span></button><div class="u-method-links">{#each data.nodes.filter(n=>n.parent===current.id) as method}<button onclick={async()=>{await select(method.id);await panTo(method.id);}}>{method.title} →</button>{/each}</div>{/if}
    <details class="u-used-in"><summary>{$t("这个职责在哪些场景中起作用")}</summary>{#each data.scenarios.filter(s=>s.id!=='all'&&s.nodes.includes(current.id)) as item}<div><strong>{item.label}</strong>{#each item.steps||[] as part,i}{#if part.nodes.includes(current.id)}<button onclick={()=>task(item.id,i)}>{$t("第 ")}{i+1}{$t(" 步 · ")}{part.title} →</button>{/if}{/each}</div>{/each}</details>
    {#each current.sections as c}
     <section class="u-claim" data-claim={c.id}><span class="u-claim-level" class:u-inferred={c.level==='inference'}>{levels[c.level]}</span><h3>{c.title}</h3><p>{c.text}</p><div class="u-evidence-buttons">{#each c.evidence as id}<button class:active={evidenceId===id} onclick={()=>showEvidence(id,c.id)} title={data.evidence[id].path}>{$t(materialKind(data.evidence[id].kind))} · {data.evidence[id].label} ↗</button>{#if c.support?.find(s=>s.evidence===id)}<small class="u-support">{$t(supportRole(c.support.find(s=>s.evidence===id).role))} · {c.support.find(s=>s.evidence===id).note}</small>{/if}{/each}</div></section>
     {#if currentEvidence&&openClaim===c.id}{@render source()}{/if}
    {/each}
    {#if currentEvidence&&!openClaim}{@render source()}{/if}
    <div class="u-reader-note"><strong>{$t("理解到哪里 · ")}{$t(studyDepth(current.study?.depth))}</strong><p>{current.study?.scope||current.boundary}</p>
     {#if current.study?.scope}<p>{current.boundary}</p>{/if}
     {#if current.study?.openQuestions?.length}<h3>{$t("尚未解决")}</h3>{#each current.study.openQuestions as q}<p><strong>{q.question}</strong><br/>{q.impact}</p>{/each}{/if}
     {#if current.study?.nextReads?.length}<h3>{$t("下一步补读")}</h3>{#each current.study.nextReads as r}<p><a href={'?view=materials&file='+encodeURIComponent(r.path)+'&start='+(r.start||1)}>{r.path} ↗</a><br/>{r.reason}</p>{/each}{/if}
    </div>
    <section class="u-ownership"><h3>{$t("对应代码与材料")}</h3>
     {#each current.ownership||[] as owned}<div><a href={'?view=materials&file='+encodeURIComponent(owned.path)+'&start='+(owned.start||1)}>{owned.path} · {owned.wholeFile?$t("文件级"):`L${owned.start}–${owned.end}`} ↗</a><small>{owned.status==='explained'?$t("已关联解释"):$t("待解释")}</small><p>{owned.note}</p></div>{:else}<p>{$t("尚未登记解释归属范围。上方证据引用不等于整个文件已被解释。")}</p>{/each}
    </section>

    <div class="u-related"><h3>{$t("与谁协作")}</h3>{#each data.edges.filter(e=>e.kind!=='composition'&&(e.source===selected||e.target===selected)) as e}<button onclick={()=>select(e.id)}>{data.nodes.find(n=>n.id===(e.source===selected?e.target:e.source))?.title}<small>{e.label} →</small></button>{/each}</div>
   {:else if relation}
    <span class="u-eyebrow">{$t("读懂一条关系")}</span><h2>{relation.kind==='composition'?$t(relation.label):relation.label}</h2><div class="u-relation-pair"><button onclick={()=>select(relation.source)}>{data.nodes.find(n=>n.id===relation.source)?.title}</button><span>↓</span><button onclick={()=>select(relation.target)}>{data.nodes.find(n=>n.id===relation.target)?.title}</button></div><span class="u-claim-level">{relation.kind==='composition'?$t("组成关系"):relation.kind==='feedback'?$t("跨调用参考"):$t("协作关系")}{$t(" · 研究归纳")}</span><p>{relation.text}</p><h3>{$t("这条关系依据什么")}</h3><div class="u-evidence-buttons">{#each relation.evidence as id}<button onclick={()=>showEvidence(id)}>{data.evidence[id].label} ↗</button>{/each}</div>{#if currentEvidence}{@render source()}{/if}
   {/if}
  </aside>
 </div>
 {:else}<div class="u-loading">{$t("正在连接理解与原文…")}</div>{/if}
 <SourceNotice source={data?.attribution}/>
</div>
{#snippet source()}
 <section class="u-source" aria-label={$t("固定版本原文")} data-evidence={currentEvidence.id}>
  <div class="u-source-head"><span>{$t(materialKind(currentEvidence.kind))+$t("原文")}</span><button aria-label={$t("收起原文")} onclick={()=>{evidenceId=null;if(!showProcess)openClaim=null;rebuild();persist();}}>×</button></div>
  <strong>{currentEvidence.label}</strong><p class="u-source-path">{currentEvidence.path}<br>L{currentEvidence.start}–{currentEvidence.end} · {data.revision.slice(0,8)}</p>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard access to horizontally and vertically scrolling source) -->
  <div class="u-source-code" role="region" aria-label={$t("可滚动原文")} tabindex="0">{#each sourceFull?fullLines:currentEvidence.lines as line}<div class="u-source-line" class:u-highlight={line.number>=currentEvidence.start&&line.number<=currentEvidence.end}><span>{line.number}</span><code>{line.text||' '}</code></div>{/each}</div>
  <div class="u-source-actions"><button data-wide-source onclick={()=>sourceDialog.showModal()}>{$t("宽屏阅读原文 ↗")}</button><button disabled={sourceLoading} onclick={()=>sourceFull?(sourceFull=false):fullSource()}>{sourceLoading?$t("加载中…"):sourceFull?$t("只看引用范围"):$t("阅读完整文件")}</button><a href={currentEvidence.url} target="_blank" rel="noreferrer">{$t("GitHub 固定版本 ↗")}</a><a href={'?view=materials&file='+encodeURIComponent(currentEvidence.path)+'&start='+currentEvidence.start} target="_blank" rel="noreferrer">{$t("文件归属与原文 ↗")}</a></div>{#if sourceError}<p role="alert">{$t(sourceError)}</p>{/if}
 </section>
{/snippet}

{#if currentEvidence}<dialog class="u-source-dialog" bind:this={sourceDialog} aria-label={$t("宽屏原文")}>
 <header><div><strong>{currentEvidence.path}</strong><small>L{currentEvidence.start}–{currentEvidence.end}{$t(" · 固定版本 ")}{data.revision.slice(0,8)}</small></div><button onclick={()=>sourceDialog.close()}>{$t("返回解释 ×")}</button></header>
 <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard access to scrolling source) -->
 <pre role="region" aria-label={$t("原文内容")} tabindex="0">{(sourceFull?fullLines:currentEvidence.lines).map(line=>`${line.number}: ${line.text}`).join('\n')}</pre>
 <footer><button disabled={sourceLoading} onclick={()=>sourceFull?(sourceFull=false):fullSource()}>{sourceLoading?$t("加载中…"):sourceFull?$t("只看引用范围"):$t("阅读完整文件")}</button><small>{$t("按 Esc 可返回解释，阅读位置保留。")}</small></footer>
</dialog>{/if}

{#snippet historicalExplanation()}
 {#if historyEvent}
  {#key historyEvent.id}
  <span class="u-eyebrow">{$t("历史事件 · ")}{historyDate(historyEvent.date)}</span><h2>{historyEvent.title}</h2><p class="u-lead">{historyEvent.summary}</p>
  <section class="u-history-change"><h3>{$t("当时面对什么")}</h3><p>{historyEvent.before}</p><h3>{$t("后来怎样改变")}</h3><p>{historyEvent.after}</p></section>
  {#if historyEvent.motivation}<h3>{$t("为何改变")}</h3><p>{historyEvent.motivation}</p>{/if}
  {#if historyEvent.tradeoff}<h3>{$t("得到什么，又付出什么")}</h3><p>{historyEvent.tradeoff}</p>{/if}
  <h3>{$t("与当前设计怎样联系")}</h3><div class="u-method-links">{#each historyEvent.units as id}<button data-history-unit={id} onclick={()=>select(id)}>{data.nodes.find(n=>n.id===id)?.title} →</button>{:else}<p>{$t("该历史对象未映射到现存职责，保留其退出记录。")}</p>{/each}</div>
  <h3>{$t("判断与原文依据")}</h3>
  {#each historyEvent.claims as claim}<section class="u-claim"><span class="u-claim-level">{claim.level==='fact'?$t("材料事实"):claim.level==='inference'?$t("研究推断"):$t("待验证假设")}</span><p>{claim.text}</p>
   {#each claim.evidence||[] as ev}<details class="u-history-source"><summary>{$t(ev.versionLabel)}{$t(" · 核对原文 · ")}{ev.path} · {ev.commit.slice(0,8)} · L{ev.start_line}–{ev.end_line}</summary><p>{$t("历史版本 ")}{ev.commit.slice(0,8)}{$t(" · 不属于当前快照的代码覆盖")}</p><!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard scrolling of historical source) --><pre role="region" aria-label={$t("历史版本原文")} tabindex="0">{ev.text.split('\n').map((line,i)=>`${ev.start_line+i}  ${line}`).join('\n')}</pre><a href={ev.url} target="_blank" rel="noreferrer">{$t("在 GitHub 查看该版本原文 ↗")}</a></details>{/each}
  </section>{/each}
  {#if historyEvent.missing_evidence}<div class="u-reader-note"><strong>{$t("尚不能下结论的部分")}</strong><p>{historyEvent.missing_evidence}</p></div>{/if}
  <details class="u-history-source"><summary>{$t("对应提交与时间（")}{historyEvent.commits.length}）</summary>{#each historyEvent.commits as commit}<p><a href={commit.url} target="_blank" rel="noreferrer">{commit.sha.slice(0,8)} · {historyDate(commit.date)} ↗</a><br/>{commit.subject}</p>{/each}</details>
  {/key}
 {:else}
  <span class="u-eyebrow">{$t("从当前分工回看设计变化")}</span><h2>{historyUnit?$t("这项职责的来路"):$t("怎样读这条演化线")}</h2>
  <p>{$t("从中间选择一个变化，先看原先怎样工作，再看为什么改变、改变了什么。需要核对时展开历史版本原文；查看当前职责后，可以退回原事件。")}</p>
  <p>{$t("这些事件是研究者从提交中整理的变化，不是完整更新日志。当前职责筛选只展示已建立的关联；已退出的方案仍保留在全部事件中。")}</p>
 {/if}
 <details class="u-history-scope"><summary>{$t("历史研究范围与边界")}</summary><p>{data.history.scope}</p><p>{$t("采集时间窗：")}{historyDate(data.history.since)}{$t(" 至 ")}{historyDate(data.history.until)}{$t("（不含末日）。采集 ")}{data.history.commitCount}{$t(" 条第一父链提交，整理 ")}{data.history.events.length}{$t(" 个事件。完整采集不等于逐条深入理解。")}</p>{#if data.history.dateInversions}<p>{$t("采集中发现 ")}{data.history.dateInversions}{$t(" 处提交时间倒序；先后判断应同时核对父链和差异。")}</p>{/if}</details>
{/snippet}
