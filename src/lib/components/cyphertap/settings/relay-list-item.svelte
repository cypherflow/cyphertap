<!-- src/lib/components/settings/RelayListItem.svelte -->
<script lang="ts">
	import { removeRelay } from '$lib/stores/nostr.js';
	import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator }  from '$lib/components/ui/dropdown-menu/index.js';
	import { copyToClipboard } from '$lib/utils/clipboard.js';
    import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Button from '$lib/components/ui/button/button.svelte';

	export let relay: {
		url: string;
		connected: boolean;
		status: number;
	};

	async function handleRemove() {
		try {
			await removeRelay(relay.url);
		} catch (error) {
			console.error('Failed to remove relay:', error);
			throw error;
		}
	}


	async function handleCopyURL() {
		// Placeholder for copying relay URL to clipboard
		try {
			await copyToClipboard(relay.url, 'Relay URL');
			console.log('Copied to clipboard:', relay.url);
		} catch (error) {
			console.error('Failed to copy URL:', error);
		}
	}

	// Helper function to get connection status color
	function getConnectionColor() {
		if (relay.connected) return 'bg-green-500';
		return relay.status === 4 ? 'bg-yellow-500' : 'bg-red-500';
	}
</script>

<div
	class="flex items-center justify-between rounded-md border p-2 transition-colors hover:bg-secondary/10"
>
	<div class="flex items-center gap-2">
		<div class="h-2 w-2 rounded-full {getConnectionColor()}"></div>
		<span class="max-w-[180px] truncate text-xs font-medium">{relay.url}</span>
	</div>

	<DropdownMenu>
		<DropdownMenuTrigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="icon" class="relative size-8 p-0">
					<span class="sr-only">Open menu</span>
					<Ellipsis />
				</Button>
			{/snippet}
		</DropdownMenuTrigger>
		<DropdownMenuContent>
			<DropdownMenuGroup>
				<!-- Placeholder actions - uncomment or modify as needed -->
				<DropdownMenuItem onclick={handleCopyURL}>Copy URL</DropdownMenuItem>
				<!-- Additional actions can be added here -->
			</DropdownMenuGroup>
			<DropdownMenuSeparator />
			<DropdownMenuItem class="text-destructive" onclick={handleRemove}>Remove</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
</div>
