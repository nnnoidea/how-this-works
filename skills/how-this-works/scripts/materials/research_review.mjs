const roles=['declaration','implementation','test','observation'];
const depths=['located','explained','traced'];
const kinds=['code','document','instruction','skill','config','test','asset'];
const requireValue=(value,message)=>{if(!value)throw new Error(message);};

export function validateScenarios(model){
 const units=new Map(model.nodes.map(n=>[n.id,n])),claims=new Map(model.nodes.flatMap(n=>n.sections.map(c=>[c.id,n.id])));
 const seen=new Set();
 for(const s of model.scenarios||[]){
  requireValue(s.id&&s.label&&s.description&&Array.isArray(s.nodes)&&s.nodes.every(id=>units.has(id)),'invalid scenario');
  requireValue(!seen.has(s.id),'duplicate scenario');seen.add(s.id);
  if(s.steps===undefined)continue;
  requireValue(s.id!=='all'&&s.start&&s.outcome&&Array.isArray(s.steps)&&s.steps.length,'scenario needs start, outcome and steps: '+s.id);
  for(const [i,step] of s.steps.entries()){
   const at=`scenario ${s.id} step ${i+1}`;
   requireValue(step&&step.title&&step.text&&Array.isArray(step.nodes)&&step.nodes.length&&step.nodes.every(id=>units.has(id)),at+': title, text and existing units required');
   requireValue(Array.isArray(step.claims)&&step.claims.length&&step.claims.every(id=>step.nodes.includes(claims.get(id))),at+': explanations must belong to participating units');
  }
  const participating=new Set(s.steps.flatMap(step=>step.nodes));
  requireValue(s.nodes.length===participating.size&&s.nodes.every(id=>participating.has(id)),'scenario participants differ from steps: '+s.id);
 }
}

export function validateResearch(model,files,{draft=false}={}) {
 if(model.schema_version!==3)return; // Archived v2 remains readable, with review gaps.
 requireValue(model.repo&&model.intro?.title&&model.intro?.text,'v3 needs project identity and introduction');
 for(const e of Object.values(model.evidence))requireValue(kinds.includes(e.kind),'invalid evidence kind: '+e.id);
 const edgeIds=new Set(model.edges.map(e=>e.id));
 for(const n of model.nodes){
  requireValue(n.id&&n.title&&n.summary&&n.boundary&&Array.isArray(n.sections)&&(draft||n.sections.length)&&!edgeIds.has(n.id),'v3 unit needs identity, explanation, boundary and claims');
  const study=n.study;
  requireValue(study&&depths.includes(study.depth)&&study.scope&&Array.isArray(study.reviewedEvidence)&&Array.isArray(study.openQuestions)&&Array.isArray(study.nextReads),'missing unit study record: '+n.id);
  requireValue(study.reviewedEvidence.every(id=>model.evidence[id]),'unknown reviewed evidence: '+n.id);
  requireValue(study.depth==='located'||study.reviewedEvidence.length,'explained/traced unit needs reviewed evidence');
  for(const q of study.openQuestions)requireValue(q.question&&q.impact,'open question needs question and impact');
  for(const r of study.nextReads){
   requireValue(files.has(r.path)&&r.reason,'next read needs an existing path and reason');
   if(r.start!==undefined||r.end!==undefined)requireValue(Number.isInteger(r.start)&&Number.isInteger(r.end)&&r.start>=1&&r.end>=r.start&&r.end<=files.get(r.path).lines,'invalid next read range');
  }
  for(const c of n.sections){
   requireValue(c.id&&c.title&&c.text&&Array.isArray(c.support),'v3 claim needs text and support mapping');
   requireValue(c.support.length===c.evidence.length&&new Set(c.support.map(s=>s.evidence)).size===c.support.length,'support must map each claim evidence once');
   for(const s of c.support)requireValue(c.evidence.includes(s.evidence)&&roles.includes(s.role)&&s.note,'invalid support mapping');
  }
 }
 for(const e of model.edges){
  requireValue(['composition','cooperation','feedback'].includes(e.kind)&&e.text&&(e.label||e.kind==='composition'),'invalid explained relation');
  if(e.kind==='composition')requireValue(model.nodes.find(n=>n.id===e.target)?.parent===e.source,'composition differs from parent');
 }
 for(const n of model.nodes.filter(n=>n.parent))requireValue(model.edges.some(e=>e.kind==='composition'&&e.source===n.parent&&e.target===n.id),'child needs evidenced composition relation');
}

// Review candidates are not truth judgments. No text classifier certifies claims.
export function reviewModel(model) {
 const candidates=[];
 for(const n of model.nodes){
  if(!n.study)candidates.push({unit:n.id,reason:'missing-study-record'});
  else if(n.study.depth==='traced'&&!n.sections.some(c=>c.support?.some(s=>s.role==='implementation')))candidates.push({unit:n.id,reason:'traced-without-implementation-support'});
  for(const c of n.sections){
   if(!c.support)candidates.push({unit:n.id,claim:c.id,reason:'missing-support-mapping'});
   else if(c.level==='fact'&&c.support.every(s=>s.role==='declaration'))candidates.push({unit:n.id,claim:c.id,reason:'fact-backed-only-by-declarations',question:'Is this a fact about a declaration, or an unsupported claim about enforced behavior?'});
  }
 }
 return {semanticTruthChecked:false,candidates,units:model.nodes.map(n=>({id:n.id,title:n.title,depth:n.study?.depth||'unrecorded',scope:n.study?.scope||null,openQuestions:n.study?.openQuestions||[],nextReads:n.study?.nextReads||[]})),
  agentReview:['Compare each summary with its detailed conditions and exceptions.',
   'Check the cited lines prove this precise claim, including consumers and failure paths where relevant.',
   'Read the explanation without repository background; explain unfamiliar terms through a concrete supported task.']};
}
