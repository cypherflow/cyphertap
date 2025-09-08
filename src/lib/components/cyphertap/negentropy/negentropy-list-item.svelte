<!-- src/lib/components/NegentropyListItem.svelte -->
<script lang="ts">
    import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from '$lib/components/ui/dropdown-menu/index.js';
    import { copyToClipboard } from '$lib/utils/clipboard.js';
    import { Progress } from '$lib/components/ui/progress/index.js';
    import Ellipsis from '@lucide/svelte/icons/ellipsis';
    import Button from '$lib/components/ui/button/button.svelte';
    import type { RelayState } from '$lib/stores/negentropySync.svelte.js';
    import { RelayStatus } from '$lib/stores/negentropySync.svelte.js';

    export let relayUrl: string;
    export let state: RelayState;

    async function handleCopyURL() {
        try {
            await copyToClipboard(relayUrl, 'Relay URL');
            console.log('Copied to clipboard:', relayUrl);
        } catch (error) {
            console.error('Failed to copy URL:', error);
        }
    }

    // Helper function to get connection status color
    function getStatusColor(): string {
        switch (state.status) {
            case RelayStatus.PENDING:
                return 'bg-gray-500';
            case RelayStatus.CONNECTING:
                return 'bg-yellow-500';
            case RelayStatus.SYNCING:
                return 'bg-blue-500';
            case RelayStatus.COMPLETED:
                return 'bg-green-500';
            case RelayStatus.ERROR:
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
        }
    }

    function getStatusText(): string {
        switch (state.status) {
            case RelayStatus.PENDING:
                return 'Pending';
            case RelayStatus.CONNECTING:
                return 'Connecting';
            case RelayStatus.SYNCING:
                return `Syncing (${state.progress}%)`;
            case RelayStatus.COMPLETED:
                return 'Complete';
            case RelayStatus.ERROR:
                return 'Error';
            default:
                return 'Unknown';
        }
    }

    function formatDuration(): string {
        if (!state.startTime) return '';
        const endTime = state.endTime || Date.now();
        const duration = endTime - state.startTime;
        if (duration < 1000) return `${duration}ms`;
        return `${(duration / 1000).toFixed(1)}s`;
    }
</script>

<div class="rounded-md border p-3 transition-colors hover:bg-secondary/10">
    <!-- Header Row -->
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
            <div class="h-2 w-2 rounded-full {getStatusColor()}"></div>
            <span class="max-w-[160px] truncate text-xs font-medium">{relayUrl}</span>
        </div>
        <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground">{getStatusText()}</span>
            <DropdownMenu>
                <DropdownMenuTrigger>
                    {#snippet child({ props })}
                        <Button {...props} variant="ghost" size="icon" class="relative size-6 p-0">
                            <span class="sr-only">Open menu</span>
                            <Ellipsis class="h-3 w-3" />
                        </Button>
                    {/snippet}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                        <DropdownMenuItem onclick={handleCopyURL}>Copy URL</DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    </div>

    <!-- Progress Bar (only during syncing) -->
    {#if state.status === RelayStatus.SYNCING}
        <div class="mt-2">
            <Progress value={state.progress} class="h-1" />
        </div>
    {/if}

    <!-- Details Row -->
    <div class="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <div class="flex gap-3">
            {#if state.status === RelayStatus.SYNCING || state.status === RelayStatus.COMPLETED}
                <span>Round trips: {state.roundTrips}</span>
            {/if}
            {#if state.haveCount > 0 || state.needCount > 0}
                <span>Have: {state.haveCount}</span>
                <span>Need: {state.needCount}</span>
            {/if}
        </div>
        {#if state.startTime}
            <span>{formatDuration()}</span>
        {/if}
    </div>

    <!-- Error Display -->
    {#if state.error}
        <div class="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">
            {state.error}
        </div>
    {/if}
</div>