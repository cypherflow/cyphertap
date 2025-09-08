<!-- src/lib/components/sync-list-item.svelte -->
<script lang="ts">
    import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from '$lib/components/ui/dropdown-menu/index.js';
    import { negentropySync, type RelaySyncState } from '$lib/stores/negentropySync.svelte.js';
    import { copyToClipboard } from '$lib/utils/clipboard.js';
    import Button from '$lib/components/ui/button/button.svelte';
    import Ellipsis from '@lucide/svelte/icons/ellipsis';
    import RefreshCw from '@lucide/svelte/icons/refresh-cw';

    export let relay: {
        url: string;
        connected: boolean;
        status: number;
        syncState?: RelaySyncState;
    };

    async function handleSyncRelay() {
        try {
            await negentropySync.syncRelay(relay.url);
        } catch (error) {
            console.error('Failed to sync relay:', error);
        }
    }

    async function handleCopyURL() {
        try {
            await copyToClipboard(relay.url, 'Relay URL');
        } catch (error) {
            console.error('Failed to copy URL:', error);
        }
    }

    // Helper function to get connection status color
    function getConnectionColor() {
        if (relay.connected) return 'bg-green-500';
        return relay.status === 4 ? 'bg-yellow-500' : 'bg-red-500';
    }

    // Helper function to get sync status color
    function getSyncStatusColor() {
        if (!relay.syncState) return 'bg-gray-400';
        
        switch (relay.syncState.status) {
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
    }

    // Helper function to get sync status text
    function getSyncStatusText() {
        if (!relay.syncState) return 'Never synced';
        
        const state = relay.syncState;
        const duration = state.progress.endTime && state.progress.startTime 
            ? `${Math.round((state.progress.endTime - state.progress.startTime) / 1000)}s`
            : '';

        switch (state.status) {
            case 'complete':
                return `✓ Synced (${state.progress.haveCount}↑ ${state.progress.needCount}↓) ${duration}`;
            case 'syncing':
                return `Syncing round ${state.progress.roundCount}`;
            case 'uploading':
                return `Uploading ${state.progress.haveCount} events`;
            case 'downloading':
                return `Downloading ${state.progress.needCount} events`;
            case 'connecting':
                return 'Connecting...';
            case 'error':
                return `Error: ${state.error}`;
            default:
                return 'Idle';
        }
    }

    $: isCurrentlySyncing = relay.syncState?.status === 'syncing' || 
                           relay.syncState?.status === 'uploading' || 
                           relay.syncState?.status === 'downloading' ||
                           relay.syncState?.status === 'connecting';
</script>

<div class="flex items-center justify-between rounded-md border p-2 transition-colors hover:bg-secondary/10">
    <div class="flex items-center gap-2 flex-1 min-w-0">
        <!-- Connection status dot -->
        <div class="h-2 w-2 rounded-full {getConnectionColor()}" title="Connection status"></div>
        
        <!-- Sync status dot -->
        <div class="h-2 w-2 rounded-full {getSyncStatusColor()}" title="Sync status"></div>
        
        <!-- Relay URL -->
        <span class="max-w-[120px] truncate text-xs font-medium" title={relay.url}>
            {relay.url}
        </span>
    </div>

    <!-- Status text -->
    <div class="flex items-center gap-2">
        <span class="text-xs text-muted-foreground truncate max-w-[140px]" title={getSyncStatusText()}>
            {getSyncStatusText()}
        </span>
        
        {#if isCurrentlySyncing}
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
                    <DropdownMenuItem onclick={handleSyncRelay} disabled={isCurrentlySyncing || !relay.connected}>
                        {#if isCurrentlySyncing}
                            <RefreshCw class="mr-2 h-4 w-4 animate-spin" />
                            Syncing...
                        {:else}
                            <RefreshCw class="mr-2 h-4 w-4" />
                            Sync Relay
                        {/if}
                    </DropdownMenuItem>
                    <DropdownMenuItem onclick={handleCopyURL}>
                        Copy URL
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    </div>
</div>