<!-- src/lib/components/cyphertap/cyphertap.svelte -->
<script lang="ts">
	import {
		initUserMenuNavigation,
		isUserMenuOpen,
		openMenuAtCurrentView
	} from '$lib/stores/navigation.js';
	import { MediaQuery } from 'svelte/reactivity';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import ViewRouter from './views/view-router.svelte';
	import CyphertapTrigger from './cyphertap-trigger.svelte';

	import * as Drawer from '$lib/components/ui/drawer/index.js';

	const isDesktop = new MediaQuery('(min-width: 768px)').current;
	// When popover opens, reset current view
	$: if ($isUserMenuOpen) {
		console.log(`[NostrUserMenu] user menu opened`);
		openMenuAtCurrentView();
	} else {
		console.log(`[NostrUserMenu] user menu closed`);
		initUserMenuNavigation();
	}
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
