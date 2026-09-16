// Spread independent relations over distinct ports. Node identity and edge direction stay unchanged.
export function distributePorts(nodes,edges){
 const byId=new Map(nodes.map(n=>[n.id,n])),groups=new Map(),handles={};
 for(const edge of edges)for(const end of ['source','target']){
  const nodeId=edge[end],side=edge[end+'Handle'],other=byId.get(edge[end==='source'?'target':'source']);
  const key=nodeId+'|'+side,entry={edge,end,nodeId,side,other,id:side+':'+edge.id+':'+end};
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(entry);
 }
 for(const entries of groups.values()){
  entries.sort((a,b)=>{const axis=a.side==='l'||a.side==='r'?'y':'x';return a.other.position[axis]-b.other.position[axis]||a.edge.id.localeCompare(b.edge.id)||a.end.localeCompare(b.end);});
  entries.forEach((e,i)=>{
   const offset=entries.length===1?.5:.28+.44*i/(entries.length-1),radius=(byId.get(e.nodeId).width||126)/2,delta=(offset-.5)*radius*2;
   const inset=radius-Math.sqrt(Math.max(0,radius*radius-delta*delta));
   (handles[e.nodeId]??=[]).push({id:e.id,side:e.side,offset,inset});e.edge[e.end+'Handle']=e.id;
  });
 }
 return handles;
}
export function orderLowerRows(items,positions,edges){
 const rows=[...new Set(items.map(id=>positions[id].y))].sort((a,b)=>a-b);
 const permutation=xs=>xs.length<=1?[xs]:xs.flatMap((x,i)=>permutation(xs.filter((_,j)=>i!==j)).map(p=>[x,...p]));
 for(const y of rows.slice(1)){
  const ids=items.filter(id=>positions[id].y===y);if(ids.length>6)continue;
  const slots=ids.map(id=>positions[id]);let best=ids,score=Infinity;
  for(const order of permutation(ids)){
   const candidate={...positions};order.forEach((id,i)=>candidate[id]=slots[i]);let cost=0;
   for(const e of edges){const a=candidate[e.source],b=candidate[e.target];if(!a||!b||a.y===b.y)continue;if(a.y===y||b.y===y)cost+=Math.abs(a.x-b.x);}
   if(cost<score){score=cost;best=order;}
  }
  best.forEach((id,i)=>positions[id]=slots[i]);
 }
}
