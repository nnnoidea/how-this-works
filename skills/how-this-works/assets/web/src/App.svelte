<script>
 import {SvelteFlowProvider} from '@xyflow/svelte';
 import Materials from './Materials.svelte';
 import Understanding from './Understanding.svelte';
 const materials=new URLSearchParams(location.search).get('view')==='materials';
</script>
{#if materials}<Materials/>{:else}<SvelteFlowProvider><Understanding/></SvelteFlowProvider>{/if}
