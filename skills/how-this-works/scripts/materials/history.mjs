/** Historical versions stay separate from current-snapshot evidence and coverage. */
export const historyBrief=h=>h?{...h,events:h.events.map(({id,title,summary,date,units})=>({id,title,summary,date,units}))}:null;
export function validateHistory(history,model){
 if(!history)return;
 const require=(v,message)=>{if(!v)throw Error('history: '+message);};
 require(history.revision===model.revision&&history.repo===model.repo,'collection must match the current fixed revision and repository');
 require(typeof history.summary==='string'&&history.summary&&typeof history.scope==='string'&&history.scope,'summary and scope required');
 require(Array.isArray(history.events),'events required');
 const ids=new Set(),units=new Set(model.nodes.map(n=>n.id));
 for(const e of history.events){
  require(/^[A-Za-z0-9_-]+$/.test(e.id)&&!ids.has(e.id),'invalid or duplicate event id');ids.add(e.id);
  require(e.title&&e.summary&&e.before&&e.after,'event needs title, summary, before and after: '+e.id);
  require(Number.isFinite(Date.parse(e.date))&&e.commits?.length,'event needs dated commits: '+e.id);
  require(Array.isArray(e.units)&&e.units.every(id=>units.has(id)),'unknown current duty in '+e.id);
  require(e.claims?.length,'event needs claims: '+e.id);
  for(const c of e.claims){
   require(['fact','inference','hypothesis'].includes(c.level)&&c.text,'invalid claim in '+e.id);
   require(c.level==='hypothesis'||c.evidence?.length,'claim needs evidence: '+e.id);
   for(const ev of c.evidence||[])require(/^[a-f0-9]{40,64}$/.test(ev.commit)&&ev.path&&Number.isInteger(ev.start_line)&&ev.start_line>0&&Number.isInteger(ev.end_line)&&ev.end_line>=ev.start_line&&typeof ev.text==='string','invalid source excerpt in '+e.id);
  }
 }
}
