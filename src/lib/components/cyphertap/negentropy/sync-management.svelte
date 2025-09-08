<!-- src/lib/components/sync-management.svelte -->
<script lang="ts">
    import { AccordionItem, AccordionContent, AccordionTrigger } from '$lib/components/ui/accordion/index.js';
    import Button from '$lib/components/ui/button/button.svelte';
    import SyncList from './sync-list.svelte';
    import RefreshCw from '@lucide/svelte/icons/refresh-cw';
    import Database from '@lucide/svelte/icons/database';
	import { RelaySync } from '$lib/stores/relaySync.svelte.js';
    import { relays } from '$lib/stores/nostr.js';


    let relaySyncs = $state($relays.map(relay => new RelaySync(relay)));
    let isSyncing = $state(false);
    let isLoaded = $state(true);

    function handleSyncAll() {

        relaySyncs.forEach(async (relaySync) => {
            await relaySync.sync();
        })

        return
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
                    Status: {"synching... maybe...."}
                </p>
            </div>
            
            <SyncList {relaySyncs}/>
            
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