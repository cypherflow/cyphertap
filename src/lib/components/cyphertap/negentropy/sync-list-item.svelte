<!-- src/lib/components/sync-list-item.svelte -->
<script lang="ts">
	import {
		DropdownMenu,
		DropdownMenuTrigger,
		DropdownMenuContent,
		DropdownMenuGroup,
		DropdownMenuItem
	} from '$lib/components/ui/dropdown-menu/index.js';
	import { copyToClipboard } from '$lib/utils/clipboard.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import type { RelaySync } from '$lib/stores/relaySync.svelte.js';

	// Use $props to receive the relay info and RelaySync instance
	let {
		relaySync
	}: {
		relaySync: RelaySync;
	} = $props();

	// let connectionColor = $derived.by(() => {
	// 	if (relaySync.) return 'bg-green-500';
	// 	return relay.status === 4 ? 'bg-yellow-500' : 'bg-red-500';
	// });

	let syncStatusColor = $derived.by(() => {
		if (!relaySync) return 'bg-gray-400';

		switch (relaySync.status) {
			case 'complete':
				return 'bg-green-500';
			case 'syncing':
			case 'uploading':
			case 'downloading':
				return 'bg-blue-500';
			case 'error':
				return 'bg-red-500';
			case 'connecting':
				return 'bg-yellow-500';
			default:
				return 'bg-gray-400';
		}
	});

	let syncStatusText = $derived.by(() => {
		if (!relaySync) return 'Never synced';

		const duration = relaySync.duration ? `${Math.round(relaySync.duration / 1000)}s` : '';

		switch (relaySync.status) {
			case 'complete':
				return `✓ Synced (${relaySync.progress.haveCount}↑ ${relaySync.progress.needCount}↓) ${duration}`;
			case 'syncing':
				return `Syncing round ${relaySync.progress.roundCount}`;
			case 'uploading':
				return `Uploading ${relaySync.progress.haveCount} events`;
			case 'downloading':
				return `Downloading ${relaySync.progress.needCount} events`;
			case 'connecting':
				return 'Connecting...';
			case 'error':
				return `Error: ${relaySync.error}`;
			default:
				return 'Idle';
		}
	});

	async function handleSyncRelay() {
		if (!relaySync) return;
		try {
			await relaySync.sync();
		} catch (error) {
			console.error('Failed to sync relay:', error);
		}
	}

	// async function handleCopyURL() {
	// 	try {
	// 		await copyToClipboard(relay.url, 'Relay URL');
	// 	} catch (error) {
	// 		console.error('Failed to copy URL:', error);
	// 	}
	// }

    let isSyncing = $derived(relaySync?.isSyncing ?? false);
    let canSync = $derived(true)//relaySync && !isSyncing && relay.connected)

</script>

<div
	class="flex items-center justify-between rounded-md border p-2 transition-colors hover:bg-secondary/10"
>
	<div class="flex min-w-0 flex-1 items-center gap-2">
		<!-- Connection status dot -->
		<!-- <div class="h-2 w-2 rounded-full {connectionColor}" title="Connection status"></div> -->

		<!-- Sync status dot -->
		<div class="h-2 w-2 rounded-full {syncStatusColor}" title="Sync status"></div>

		<!-- Relay URL -->
		<span class="max-w-[120px] truncate text-xs font-medium" title={relaySync.url}>
			{relaySync.url}
		</span>
	</div>

	<!-- Status text and controls -->
	<div class="flex items-center gap-2">
		<span class="max-w-[140px] truncate text-xs text-muted-foreground" title={syncStatusText}>
			{syncStatusText}
		</span>

		{#if isSyncing}
			<RefreshCw class="h-3 w-3 animate-spin text-blue-500" />
		{/if}

		<!-- Dropdown menu -->
		<DropdownMenu>
			<DropdownMenuTrigger>
				{#snippet child({ props })}
					<Button {...props} variant="ghost" size="icon" class="relative size-6 p-0">
						<span class="sr-only">Open menu</span>
						<Ellipsis class="h-3 w-3" />
					</Button>
				{/snippet}
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuGroup>
					<DropdownMenuItem onclick={handleSyncRelay} disabled={!canSync}>
						{#if isSyncing}
							<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
							Syncing...
						{:else}
							<RefreshCw class="mr-2 h-4 w-4" />
							Sync Relay
						{/if}
					</DropdownMenuItem>
					<!-- <DropdownMenuItem onclick={handleCopyURL}>Copy URL</DropdownMenuItem> -->
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	</div>
</div>
