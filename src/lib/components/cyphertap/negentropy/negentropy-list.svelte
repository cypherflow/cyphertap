<!-- src/lib/components/NegentropyList.svelte -->
<script lang="ts">
    import Button from '$lib/components/ui/button/button.svelte';
    import { createNegentropySync } from '$lib/stores/negentropySync.svelte.js';
    import { relays } from '$lib/stores/nostr.js';
    import Play from '@lucide/svelte/icons/play';
    import NegentropyListItem from './negentropy-list-item.svelte';
    import { Progress } from '$lib/components/ui/progress/index.js';

    const negentropySync = createNegentropySync();

    // Example mint URLs - replace with your actual mint URLs
    let mintUrls: string[] = ['https://mint.minibits.cash', 'https://8333.space:3338'];

    async function startSync() {
        if (!$relays || $relays.length === 0) {
            console.error('No relays configured');
            return;
        }

        try {
            const results = await negentropySync.syncWithRelays(mintUrls);
            console.log('Sync completed:', results);
        } catch (error) {
            console.error('Sync failed:', error);
        }
    }

    function formatDuration(ms: number | null): string {
        if (!ms) return '';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    }
</script>

<div class="space-y-3">
    <!-- Sync Status Header -->
    <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-muted-foreground">
            {#if negentropySync.state.isRunning}
                Syncing ({negentropySync.state.completedRelays}/{negentropySync.state.totalRelays})
            {:else if negentropySync.state.totalRelays > 0}
                Last sync: {negentropySync.successfulRelays}/{negentropySync.state.totalRelays} successful
                {#if negentropySync.duration}
                    ({formatDuration(negentropySync.duration)})
                {/if}
            {:else}
                Ready to sync
            {/if}
        </span>
    </div>

    <!-- Overall Progress Bar -->
    {#if negentropySync.state.isRunning}
        <div class="space-y-2">
            <Progress value={negentropySync.progress} class="w-full" />
            {#if negentropySync.state.currentRelay}
                <p class="text-xs text-muted-foreground">
                    Current: {negentropySync.state.currentRelay}
                </p>
            {/if}
        </div>
    {/if}

    <!-- Summary Stats -->
    {#if negentropySync.state.totalEvents.have > 0 || negentropySync.state.totalEvents.need > 0}
        <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="rounded-md bg-green-50 p-2 text-center">
                <div class="font-medium text-green-700">{negentropySync.state.totalEvents.have}</div>
                <div class="text-green-600">Events to upload</div>
            </div>
            <div class="rounded-md bg-blue-50 p-2 text-center">
                <div class="font-medium text-blue-700">{negentropySync.state.totalEvents.need}</div>
                <div class="text-blue-600">Events to download</div>
            </div>
        </div>
    {/if}

    <!-- Relay List -->
    <div class="max-h-60 space-y-1 overflow-y-auto p-1">
        {#if negentropySync.state.relayStates.size === 0}
            <div class="py-2 text-center text-xs text-muted-foreground">
                No sync data available
            </div>
        {:else}
            {#each negentropySync.getAllRelayStates() as [url, state] (url)}
                <NegentropyListItem relayUrl={url} {state} />
            {/each}
        {/if}
    </div>
    
    <!-- Action Button -->
    <div class="flex justify-center">
        <Button 
            size="sm" 
            onclick={startSync} 
            disabled={negentropySync.state.isRunning || !$relays || $relays.length === 0}
            class="w-full"
        >
            <Play class="mr-2 h-3 w-3" />
            {negentropySync.state.isRunning ? 'Syncing...' : 'Start Sync'}
        </Button>
    </div>
</div>