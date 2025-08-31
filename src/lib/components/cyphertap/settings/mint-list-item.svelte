<!-- src/lib/components/cyphertap/settings/mint-list-item.svelte -->
<script lang="ts">
	import { removeMint, setAsMainMint, addMint } from '$lib/stores/wallet.js';
    import * as Dialog from "$lib/components/ui/dialog/index.js";
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';

    import Ellipsis from '@lucide/svelte/icons/ellipsis';
    import TriangleAlert from '@lucide/svelte/icons/triangle-alert'
	import Button from '$lib/components/ui/button/button.svelte';
	import Badge from '$lib/components/ui/badge/badge.svelte';

	export let mint: {
		url: string;
		balance: number;
		isMain: boolean;
		isRegistered: boolean;
	};

	let showConfirmDialog = false;
	let isProcessing = false;
	let error: string | null = null;

	async function handleRemove() {
		try {
			if (mint.balance > 0) {
				showConfirmDialog = true;
			} else {
				await removeMint(mint.url);
			}
		} catch (error: any) {
			console.error('Failed to remove mint:', error);
			alert(error.message || 'Failed to remove mint');
		}
	}

	async function confirmRemove() {
		try {
			isProcessing = true;
			await removeMint(mint.url);
			showConfirmDialog = false;
		} catch (error: any) {
			console.error('Failed to remove mint:', error);
			alert(error.message || 'Failed to remove mint');
		} finally {
			isProcessing = false;
		}
	}

	async function handleSetAsMain() {
		if (mint.isMain) return; // Already main mint
		try {
			isProcessing = true;
			await setAsMainMint(mint.url);
		} catch (error: any) {
			console.error('Failed to set as main mint:', error);
			alert(error.message || 'Failed to set as main mint');
		} finally {
			isProcessing = false;
		}
	}

	async function handleTrustMint() {
		if (mint.isRegistered) return; // Already registered
		try {
			isProcessing = true;
			await addMint(mint.url);
		} catch (error: any) {
			console.error('Failed to trust mint:', error);
			alert(error.message || 'Failed to trust mint');
		} finally {
			isProcessing = false;
		}
	}
</script>

<div
	class="flex items-center justify-between rounded-md border p-2 transition-colors hover:bg-secondary/10"
>
	<div class="flex items-center gap-2 overflow-hidden">
		{#if !mint.isRegistered}
			<TriangleAlert class="h-4 w-4 flex-shrink-0 text-amber-500" />
		{/if}
		<div class="flex flex-col overflow-hidden">
			<span class="truncate text-xs font-medium">
				{mint.url}
			</span>
			<span class="flex items-center gap-2 text-xs text-muted-foreground">
				Balance: {mint.balance} sats
				{#if !mint.isRegistered}
					<span class="text-xs text-amber-600">(Unregistered)</span>
				{/if}
			</span>
		</div>
	</div>

	<!-- Action buttons -->
	{#if mint.isMain}
		<Badge>Main</Badge>
	{:else}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						size="icon"
						class="relative size-8 p-0"
						disabled={isProcessing}
					>
						<span class="sr-only">Open menu</span>
						<Ellipsis />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content>
				<!-- Only show Set as main for registered mints -->
				{#if mint.isRegistered}
					<DropdownMenu.Group>
						<DropdownMenu.Item onclick={handleSetAsMain}>Set as main</DropdownMenu.Item>
						<DropdownMenu.Item disabled>Transfer balance to main</DropdownMenu.Item>
					</DropdownMenu.Group>
					<DropdownMenu.Separator />
				{/if}

				<!-- Show Trust action for unregistered mints -->
				{#if !mint.isRegistered}
					<DropdownMenu.Label class="max-w-48 whitespace-normal px-2 py-1.5 text-xs">
						Your wallet has tokens from a mint outside of your registered mints
					</DropdownMenu.Label>
					<DropdownMenu.Separator />
					<DropdownMenu.Item onclick={handleTrustMint} class="text-amber-600">
						Trust mint
					</DropdownMenu.Item>
					<DropdownMenu.Item disabled>Transfer balance to main</DropdownMenu.Item>
				{/if}

				<!-- Remove option (only available for registered mints) -->
				{#if mint.isRegistered}
					<DropdownMenu.Item class="text-destructive" onclick={handleRemove}>
						Remove
					</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{/if}
</div>

<!-- Confirmation Dialog for removing a mint with balance -->
<Dialog.Root bind:open={showConfirmDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Remove Mint with Balance</Dialog.Title>
			<Dialog.Description>
				This mint has a balance of {mint.balance} sats. Removing it will make those funds inaccessible
				from this wallet. Are you sure you want to continue?
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showConfirmDialog = false)} disabled={isProcessing}
				>Cancel</Button
			>
			<Button variant="destructive" onclick={confirmRemove} disabled={isProcessing}>
				{isProcessing ? 'Removing...' : 'Remove Anyway'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
