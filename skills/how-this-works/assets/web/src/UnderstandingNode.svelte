<script>
 import {t} from '../../ui-language.js';
 import {Handle,Position} from '@xyflow/svelte';
 let {id,data}=$props();
</script>
{#each data.handles||[] as handle (handle.id)}
 <Handle id={handle.id} type="source" position={{l:Position.Left,r:Position.Right,t:Position.Top,b:Position.Bottom}[handle.side]} isConnectable={false} style={`opacity:0;pointer-events:none;${handle.side==='l'||handle.side==='r'?`top:${handle.offset*100}%;${handle.side==='l'?'left':'right'}:${handle.inset}px`:`left:${handle.offset*100}%;${handle.side==='t'?'top':'bottom'}:${handle.inset}px`}`}/>
{/each}
<div class="u-orbit" class:u-chosen={data.active} class:u-muted={data.dim} class:u-material={data.material} class:u-orbit-context={!!data.contextRole} data-context-role={data.contextRole||undefined} style={`width:${data.size||126}px;height:${data.size||126}px`} data-unit={id} title={data.title}>
 <span class="u-orbit-kind">{data.contextRole==='parent'?$t("上层单元"):data.contextRole==='peer'?$t("同层关联"):data.contextRole==='related'?$t("关联单元"):data.material?$t("依据"):data.parent?$t("内部职责"):$t("总体职责")}</span>
 <strong>{#if data.diagramLabel}{#each data.diagramLabel as line}<span style="display:block">{line}</span>{/each}{:else}{data.title}{/if}</strong>
 <span class="u-orbit-number">{data.mark}</span>
</div>
{#if data.short}<div class="u-orbit-caption" class:u-context-caption-node={!!data.contextRole} title={data.contextRole==='parent'?$t(data.short):data.material?data.short.replace(data.materialKind,$t(data.materialKind)):data.short} class:u-muted={data.dim}>{data.contextRole==='parent'?$t(data.short):data.material?data.short.replace(data.materialKind,$t(data.materialKind)):data.short}</div>{/if}
