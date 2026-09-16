import {orderLowerRows} from './edge-layout.js';
// The authored graph stays complete. Display scopes preserve a bounded, real neighborhood.
export const EVIDENCE_PAGE_SIZE=6;
export const CONTEXT_NODE_SIZE=92;
export function focusScene(data,{expanded=null,materialFor=null,evidencePage=0,compact=false}={}){
 const index=new Map(data.nodes.map(n=>[n.id,n]));
 if(!expanded&&!materialFor)return {key:'overview',kind:'overview',units:data.nodes.filter(n=>!n.parent),context:{},evidence:[],positions:Object.fromEntries(data.nodes.filter(n=>!n.parent).map(n=>[n.id,n.position])),edges:data.edges.filter(e=>!index.get(e.source).parent&&!index.get(e.target).parent)};
 const owner=index.get(materialFor||expanded),items=materialFor?[...new Set(owner.sections.flatMap(s=>s.evidence))]:data.nodes.filter(n=>n.parent===expanded).map(n=>n.id);
 const page=materialFor?Math.min(evidencePage,Math.max(0,Math.ceil(items.length/EVIDENCE_PAGE_SIZE)-1)):0;
 const visible=materialFor?items.slice(page*EVIDENCE_PAGE_SIZE,(page+1)*EVIDENCE_PAGE_SIZE):items;
 const columns=compact?2:visible.length===4?2:3,gapX=compact?215:245,gapY=180;
 const fullRow=Math.min(columns,visible.length),center=(fullRow-1)*gapX/2;
 const positions={[owner.id]:{x:center,y:0}};
 visible.forEach((id,i)=>{const row=Math.floor(i/columns),count=Math.min(columns,visible.length-row*columns);positions[materialFor?'ev:'+id:id]={x:center-(count-1)*gapX/2+(i%columns)*gapX,y:180+row*gapY};});
 if(!materialFor)orderLowerRows(visible,positions,data.edges.filter(e=>e.kind!=='composition'));
 const primary=materialFor?[owner]:[owner,...visible.map(id=>index.get(id))];
 const primaryIds=new Set(primary.map(n=>n.id)),context={};
 if(owner.parent&&!primaryIds.has(owner.parent))context[owner.parent]={role:'parent',side:'left',caption:'所属单元'};
 // Keep direct peers only; position and adjacency do not invent semantic groupings.
 for(const e of data.edges){
  if(e.kind==='composition'||(!primaryIds.has(e.source)&&!primaryIds.has(e.target)))continue;
  const other=index.get(primaryIds.has(e.source)?e.target:e.source);
  if(!other||primaryIds.has(other.id)||context[other.id])continue;
  if(Object.values(context).filter(c=>c.role!=='parent').length>=3)break;
  context[other.id]={role:other.parent===owner.parent?'peer':'related',side:primaryIds.has(e.target)?'left':'right',caption:e.label};
 }
 const wingX={left:-165,right:(fullRow-1)*gapX+126+70},slots={left:0,right:0};
 const contextIds=Object.keys(context);
 contextIds.forEach((id,i)=>{
  const c=context[id];
  if(compact){
   // A narrow contextual band above the focal content avoids shrinking the primary graph to fit wide wings.
   const count=contextIds.length,step=count>3?116:132,start=center+63-(count-1)*step/2-CONTEXT_NODE_SIZE/2;
   positions[id]={x:start+i*step,y:-145};c.side='top';
  }else positions[id]={x:wingX[c.side],y:slots[c.side]++*165};
 });
 const units=[...primary,...contextIds.map(id=>index.get(id))],ids=new Set(units.map(n=>n.id));
 const edges=data.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)&&(primaryIds.has(e.source)||primaryIds.has(e.target))).map(e=>({...e,contextual:!!(context[e.source]||context[e.target])}));
 if(materialFor)edges.push(...visible.map(id=>({id:'support:'+id,source:owner.id,target:'ev:'+id,kind:'evidence',label:'',evidence:[id]})));
 return {key:materialFor?`evidence:${owner.id}:${page}${compact?':narrow':''}`:`methods:${owner.id}${compact?':narrow':''}`,kind:materialFor?'evidence':'methods',owner:owner.id,units,context,evidence:materialFor?visible:[],positions,edges,page,total:items.length};
}
export function focusPorts(edge,positions,context={}){
 const a=positions[edge.source],b=positions[edge.target],dx=b.x-a.x,dy=b.y-a.y;
 if(edge.contextual){
  if(edge.kind==='feedback')return ['t','t'];
  if(context[edge.source]?.side==='top'||context[edge.target]?.side==='top')return dy>0?['b','t']:['t','b'];
  return dx>0?['r','l']:['l','r'];
 }
 if(edge.kind==='composition'||edge.kind==='evidence')return ['b','t'];
 if(!dy&&Math.abs(dx)>260)return ['t','t'];
 if(dy)return dy>0?['b','t']:['t','b'];
 return dx>0?['r','l']:['l','r'];
}
