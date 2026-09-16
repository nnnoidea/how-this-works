<script>
 import {t} from '../../ui-language.js';
 import {BaseEdge,EdgeLabel,getSmoothStepPath} from '@xyflow/svelte';
 let {id,sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition,markerEnd,style,label,data}=$props();
 const points=$derived(data.outside?[`M ${sourceX} ${sourceY} L ${sourceX} ${sourceY+50} L ${data.routeX} ${sourceY+50} L ${data.routeX} ${targetY-40} L ${targetX} ${targetY-40} L ${targetX} ${targetY}`,targetX,targetY-40]:getSmoothStepPath({sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition,borderRadius:12,offset:24}));
</script>
<BaseEdge {id} path={points[0]} {markerEnd} {style} interactionWidth={22}/>
{#if label&&!data.muted}<EdgeLabel x={points[1]} y={points[2]} transparent><button class="u-edge-label nodrag nopan" class:u-context-edge-label={data.contextual} class:u-muted-edge-label={data.muted} class:u-active-edge-label={data.emphasized} data-read-edge={id} onclick={()=>data.read(id)}>{data.fixedLabel?$t(label):label}</button></EdgeLabel>{/if}
