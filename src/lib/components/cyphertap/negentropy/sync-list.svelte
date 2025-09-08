<!-- src/lib/components/sync-list.svelte -->
<script lang="ts">
    import { relays } from '$lib/stores/nostr.js';
    import SyncListItem from './sync-list-item.svelte';

    let { relaySyncs = $bindable()} = $props();

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
</div>