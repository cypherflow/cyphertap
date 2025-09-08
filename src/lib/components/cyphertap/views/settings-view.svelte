<!-- src/lib/components/nostr/NostrSettingsView.svelte -->
<script lang="ts">
	import { mode, setMode } from 'mode-watcher';
	import { navigateTo } from '$lib/stores/navigation.js'

	import { Accordion }  from '$lib/components/ui/accordion/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import Switch from '$lib/components/ui/switch/switch.svelte';
    
	import ViewContainer from './view-container.svelte';
	import RelayManagement from '../settings/relay-management.svelte';
	import MintManagement from '../settings/mint-management.svelte';
	import NostrKeys from '../settings/nostr-keys.svelte';
	import SignOutButton from '../settings/sign-out-button.svelte';
	import LinkDevices from '../settings/link-devices.svelte';

    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
    import Moon from '@lucide/svelte/icons/moon';
    import Sun from '@lucide/svelte/icons/sun';
	import NegentropyManagement from '../negentropy/negentropy-management.svelte';

	function toggleTheme() {
		if (mode.current === 'dark') {
			setMode('light');
		} else {
			setMode('dark');
		}
	}
</script>

<ViewContainer className="p-0 max-h-[55vh] md:max-h-[60vh]">
	<div class="mb-2 flex items-center p-2">
		<Button variant="ghost" size="icon" onclick={() => navigateTo('main')} class="mr-2">
			<ChevronLeft class="h-4 w-4" />
		</Button>
		<h3 class="text-lg font-medium">Settings</h3>
	</div>

	<ScrollArea class="p-2">
		<!-- Settings content -->
		<div class="max-h-[60vh] px-2 md:max-h-[50vh]">
			<!-- Theme toggle -->
			<div class="flex items-center justify-between border-b pb-4">
				<div class="flex items-center space-x-2">
					{#if mode.current === 'dark'}
						<Moon />
					{:else}
						<Sun />
					{/if}
					<span class="text">Dark Mode</span>
				</div>
				<Switch checked={mode.current === 'dark'} onCheckedChange={toggleTheme} />
			</div>

			<Accordion type="multiple" class="">
				<LinkDevices />
				<NegentropyManagement />
				<MintManagement />
				<RelayManagement />
				<NostrKeys />
			</Accordion>

			<!-- Logout button - now using the SignOutButton component -->
			<div class="mt-2 w-full pt-4">
				<SignOutButton />
			</div>
		</div>
	</ScrollArea>
</ViewContainer>
