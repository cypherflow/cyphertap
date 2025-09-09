<!-- src/lib/components/sync-list.svelte -->
<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
    import { relays } from '$lib/stores/nostr.js';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
    import SyncListItem from './sync-list-item.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import { addWalletRelay } from '$lib/stores/wallet.js';

    let { relaySyncs = $bindable()} = $props();

    let relayUrl = $state("wss://relay.example.com");
    let isProcessing = $state(false);
    let error = $state("");

    async function handleAddWalletRelay(){
        isProcessing = true;
        try{
            await addWalletRelay(relayUrl);
        } catch(e) {
            error = e.message;
            console.error("there was an error adding the wallet relay...", e.message)
        } finally {
            isProcessing = false;
        }

    }

</script>

<div class="space-y-3">
    <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-muted-foreground">
            Relay Sync Status ({$relays.length})
        </span>
    </div>
    
    <div class="max-h-48 space-y-1 overflow-y-auto p-1">
        {#if $relays.length === 0}
            <div class="py-2 text-center text-xs text-muted-foreground">
                No relays configured
            </div>
        {:else}
            {#each relaySyncs as relaySync (relaySync.url)}
                <SyncListItem {relaySync} />
            {/each}
        {/if}
    </div>
    <!-- Add new mint section -->
	<Separator />
	<div class="space-y-2">
		<div class="flex items-center space-x-2">
			<Input placeholder="https://mint.example.com" bind:value={relayUrl} class="flex-1 text-xs" />
			<Button size="sm" onclick={handleAddWalletRelay} disabled={!relayUrl.trim() || isProcessing}>
				{#if isProcessing}
					<LoaderCircle class="animate-spin" />
				{:else}
					<Plus />
					Add
				{/if}
			</Button>
		</div>
		{#if error}
			<div class="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-500">
				{error}
			</div>
		{/if}
	</div>
</div>