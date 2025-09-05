<!-- src/lib/components/cyphertap/cyphertap.svelte -->
<script lang="ts">
	import {
		initNavigation,
		isUserMenuOpen,
		openMenu,
	} from '$lib/stores/navigation.js';
	import { MediaQuery } from 'svelte/reactivity';
	import { Popover, PopoverTrigger, PopoverContent }  from '$lib/components/ui/popover/index.js';
	import ViewRouter from './views/view-router.svelte';
	import CyphertapTrigger from './cyphertap-trigger.svelte';

	import { Drawer, DrawerTrigger, DrawerContent }  from '$lib/components/ui/drawer/index.js';
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
		<Popover bind:open={$isUserMenuOpen}>
			<PopoverTrigger>
				<CyphertapTrigger />
			</PopoverTrigger>
			<PopoverContent align="end" class="w-80 overflow-hidden p-0">
				<ViewRouter {isDesktop} />
			</PopoverContent>
		</Popover>
	</div>
{:else}
	<Drawer bind:open={$isUserMenuOpen} shouldScaleBackground>
		<DrawerTrigger>
			<CyphertapTrigger />
		</DrawerTrigger>
		<DrawerContent class="pt-0">
			<ViewRouter {isDesktop} />
		</DrawerContent>
	</Drawer>
{/if}
