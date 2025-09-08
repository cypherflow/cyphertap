<!-- src/lib/components/sync-management.svelte -->
<script lang="ts">
    import { AccordionItem, AccordionContent, AccordionTrigger } from '$lib/components/ui/accordion/index.js';
    import Button from '$lib/components/ui/button/button.svelte';
    import { negentropySync } from '$lib/stores/negentropySync.svelte.js';
    import SyncList from './sync-list.svelte';
    import RefreshCw from '@lucide/svelte/icons/refresh-cw';
    import Database from '@lucide/svelte/icons/database';

    async function handleSyncAll() {
        try {
            await negentropySync.startSync();
        } catch (error) {
            console.error('Sync failed:', error);
        }
    }

    // Get summary info for display
    $: totalRelays = negentropySync.progress.totalRelays;
    $: completedRelays = negentropySync.progress.completedRelays;
    $: errorCount = negentropySync.progress.errorCount;
    $: isSyncing = negentropySync.isSyncing;
    $: isLoaded = negentropySync.isLoaded;

    function getSyncSummary() {
        if (!isLoaded) return 'Negentropy library not loaded';
        if (isSyncing) return `Syncing... (${completedRelays}/${totalRelays} complete)`;
        if (totalRelays === 0) return 'No previous sync';
        if (errorCount > 0) return `Last sync: ${completedRelays}/${totalRelays} successful, ${errorCount} errors`;
        return `Last sync: ${completedRelays}/${totalRelays} relays completed`;
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
                    Sync your wallet events across relays using Negentropy for efficient reconciliation.
                    This ensures your wallet state is consistent across all connected relays.
                </p>
                <p class="text-xs text-muted-foreground">
                    Status: {getSyncSummary()}
                </p>
            </div>
            
            <SyncList />
            
            <Button 
                onclick={handleSyncAll} 
                disabled={isSyncing || !isLoaded}
                class="w-full"
            >
                {#if isSyncing}
                    <RefreshCw class="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                {:else}
                    <Database class="mr-2 h-4 w-4" />
                    Sync All Relays
                {/if}
            </Button>
        </div>
    </AccordionContent>
</AccordionItem>