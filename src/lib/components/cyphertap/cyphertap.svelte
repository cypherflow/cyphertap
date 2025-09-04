<!-- src/lib/components/cyphertap/cyphertap.svelte -->
<script lang="ts">
	import {
		initNavigation,
		isUserMenuOpen,
		openMenu,
	} from '$lib/stores/navigation.js';
	import { MediaQuery } from 'svelte/reactivity';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import ViewRouter from './views/view-router.svelte';
	import CyphertapTrigger from './cyphertap-trigger.svelte';

	import * as Drawer from '$lib/components/ui/drawer/index.js';
	import { onMount } from 'svelte';
	import { autoLogin } from '$lib/stores/nostr.js';

	const isDesktop = new MediaQuery('(min-width: 768px)').current;
	// When popover opens, reset current view
	$: if ($isUserMenuOpen) {
		initNavigation();
		openMenu();
	}

	// Try auto login
	onMount(() => {
		autoLogin();
	})
</script>

{#if isDesktop}
	<div class="relative">
		<Popover.Root bind:open={$isUserMenuOpen}>
			<Popover.Trigger>
				<CyphertapTrigger />
			</Popover.Trigger>
			<Popover.Content align="end" class="w-80 overflow-hidden p-0">
				<ViewRouter {isDesktop} />
			</Popover.Content>
		</Popover.Root>
	</div>
{:else}
	<Drawer.Root bind:open={$isUserMenuOpen} shouldScaleBackground>
		<Drawer.Trigger>
			<CyphertapTrigger />
		</Drawer.Trigger>
		<Drawer.Content class="pt-0">
			<ViewRouter {isDesktop} />
		</Drawer.Content>
	</Drawer.Root>
{/if}
