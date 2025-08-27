<!-- src/lib/components/ui/ViewContainer.svelte -->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { startTransition, endTransition, direction } from '$lib/stores/navigation.js';

	// Allow passing additional classes
	export let className = '';
	// Allow customizing animation options
	export let animationDuration = 300;
	export let animationDistance = 300;
</script>

<div
	class="w-full {className}"
	in:fly={{ x: $direction * animationDistance, duration: animationDuration }}
	out:fly={{ x: $direction * -animationDistance, duration: animationDuration }}
	on:introstart={startTransition}
	on:outrostart={startTransition}
	on:introend={endTransition}
	on:outroend={endTransition}
>
	<slot />
</div>
