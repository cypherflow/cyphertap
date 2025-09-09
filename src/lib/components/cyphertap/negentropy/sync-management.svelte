<!-- src/lib/components/sync-management.svelte -->
<script lang="ts">
	import {
		AccordionItem,
		AccordionContent,
		AccordionTrigger
	} from '$lib/components/ui/accordion/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import SyncList from './sync-list.svelte';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Database from '@lucide/svelte/icons/database';
	import { createWalletRelaySync, RelaySync } from '$lib/stores/relaySync.svelte.js';
	import { relays, getNDK, currentUser } from '$lib/stores/nostr.js';
	import { wallet } from '$lib/stores/wallet.js';
	import type { NDKRelay } from '@nostr-dev-kit/ndk';

    let relaySyncs = $state<RelaySync[]>($wallet?.relaySet?.relays.forEach((relay: NDKRelay) => createWalletRelaySync(relay, $currentUser?.pubkey!)) || [])


	// Reactive state
	let activeSyncs = $derived(relaySyncs.filter((rs) => rs.isSyncing).length);
	let completedSyncs = $derived(relaySyncs.filter((rs) => rs.status === 'complete').length);
	let errorSyncs = $derived(relaySyncs.filter((rs) => rs.status === 'error').length);
	let isSyncing = $derived(activeSyncs > 0);
	let isLoaded = $derived(!!window.Negentropy && !!window.NegentropyStorageVector);

	// Initialize relay syncs when relays change
	$effect(() => {
		const ndk = getNDK();
		const user = ndk.activeUser;

		if (user?.pubkey && $relays.length > 0) {
			relaySyncs = $relays.map((relay) => createWalletRelaySync(relay, user.pubkey));
		}
	});

	async function handleSyncAll() {
		if (isSyncing || !isLoaded) return;

		try {
			// Start all syncs in parallel
			await Promise.allSettled(relaySyncs.map((relaySync) => relaySync.sync()));
		} catch (error) {
			console.error('Sync failed:', error);
		}
	}

	function getSyncSummary() {
		if (!isLoaded) return 'Negentropy library not loaded';
		if (isSyncing) return `Syncing... (${activeSyncs} active)`;
		if (relaySyncs.length === 0) return 'No relays configured';
		if (errorSyncs > 0)
			return `Last sync: ${completedSyncs}/${relaySyncs.length} successful, ${errorSyncs} errors`;
		if (completedSyncs > 0)
			return `Last sync: ${completedSyncs}/${relaySyncs.length} relays completed`;
		return 'Ready to sync';
	}
</script>

<AccordionItem>
	<AccordionTrigger>
		<span class="flex w-full gap-2 text-left">
			<Database />
			Wallet Sync
			{#if isSyncing}
				<RefreshCw class="h-4 w-4 animate-spin" />
			{/if}
		</span>
	</AccordionTrigger>
	<AccordionContent>
		<div class="mt-4 space-y-4">
			<div class="space-y-2">
				<p class="text-sm text-muted-foreground">
					Sync your wallet events across relays using Negentropy for efficient reconciliation. This
					ensures your wallet state is consistent across all connected relays.
				</p>
				<p class="text-xs text-muted-foreground">
					Status: {getSyncSummary()}
				</p>
			</div>

			<SyncList {relaySyncs} />

			<Button
				onclick={handleSyncAll}
				disabled={isSyncing || !isLoaded || relaySyncs.length === 0}
				class="w-full"
			>
				{#if isSyncing}
					<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
					Syncing... ({activeSyncs}/{relaySyncs.length})
				{:else}
					<Database class="mr-2 h-4 w-4" />
					Sync All Relays
				{/if}
			</Button>
		</div>
	</AccordionContent>
</AccordionItem>
