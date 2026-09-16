// Navigation follows authored parent relations at any depth; layout is separate.
export function ancestors(data,id){
 const byId=new Map(data.nodes.map(n=>[n.id,n])),result=[],seen=new Set();let n=byId.get(id);
 while(n?.parent&&!seen.has(n.parent)){seen.add(n.parent);n=byId.get(n.parent);if(n)result.unshift(n);}
 return result;
}
export function navigation(data,expanded,filter=''){
 if(!data)return [];
 const children=new Map();for(const n of data.nodes){const key=n.parent||null;if(!children.has(key))children.set(key,[]);children.get(key).push(n);}
 const open=new Set([expanded,...ancestors(data,expanded).map(n=>n.id)]),visible=new Set();
 if(filter)for(const n of data.nodes)if([n.title,n.summary,...n.sections.map(c=>c.text)].join(' ').toLowerCase().includes(filter.toLowerCase())){visible.add(n.id);ancestors(data,n.id).forEach(p=>visible.add(p.id));}
 const out=[];function visit(parent,level){for(const n of children.get(parent)||[]){if(filter&&!visible.has(n.id))continue;out.push({...n,navLevel:level});if(filter||open.has(n.id))visit(n.id,level+1);}}
 visit(null,0);return out;
}
