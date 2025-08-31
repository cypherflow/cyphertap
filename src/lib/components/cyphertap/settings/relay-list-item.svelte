<!-- src/lib/components/settings/RelayListItem.svelte -->
<script lang="ts">
	import { removeRelay } from '$lib/stores/nostr.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
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

	// Function placeholders for future actions
	async function handlePrimaryRelay() {
		// Placeholder for setting a relay as primary
		console.log('Set as primary relay:', relay.url);
		// Implement functionality when needed
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

	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="icon" class="relative size-8 p-0">
					<span class="sr-only">Open menu</span>
					<Ellipsis />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content>
			<DropdownMenu.Group>
				<!-- Placeholder actions - uncomment or modify as needed -->
				<DropdownMenu.Item onclick={handleCopyURL}>Copy URL</DropdownMenu.Item>
				<DropdownMenu.Item onclick={handlePrimaryRelay} disabled>Set as primary</DropdownMenu.Item>
				<!-- Additional actions can be added here -->
			</DropdownMenu.Group>
			<DropdownMenu.Separator />
			<DropdownMenu.Item class="text-destructive" onclick={handleRemove}>Remove</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>
