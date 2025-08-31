<!-- src/lib/components/settings/MintList.svelte -->
<script lang="ts">
	import { mintInfo, addMint } from '$lib/stores/wallet.js';
    import Plus from '@lucide/svelte/icons/plus';
    import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import MintListItem from './mint-list-item.svelte';

	let mintUrl = '';
	let isProcessing = false;
	let error: string | null = null;

	// Derived property to count different mint types
	$: registeredMints = $mintInfo.filter((mint) => mint.isRegistered);
	$: unregisteredMints = $mintInfo.filter((mint) => !mint.isRegistered);

	async function handleAddMint() {
		if (!mintUrl.trim()) return;
		error = null;
		try {
			isProcessing = true;
			await addMint(mintUrl);
			mintUrl = '';
		} catch (err: any) {
			console.error('Error adding mint:', err);
			error = err.message || 'Failed to add mint';
		} finally {
			isProcessing = false;
		}
	}
</script>

<div class="space-y-3">
	<!-- Registered Mints Section -->
	<div class="space-y-2">
		<div class="flex items-center justify-between">
			<span class="text-xs font-medium text-muted-foreground">
				Your registered mints ({registeredMints.length})
			</span>
		</div>

		<div class="space-y-1 p-1">
			{#if registeredMints.length === 0}
				<div class="py-2 text-center text-xs text-muted-foreground">No registered mints</div>
			{:else}
				{#each registeredMints as mint (mint.url)}
					<MintListItem {mint} />
				{/each}
			{/if}
		</div>
	</div>

	<!-- Unregistered Mints Section (only show if there are any) -->
	{#if unregisteredMints.length > 0}
		<Separator />
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-amber-600">
					Unregistered mints with tokens ({unregisteredMints.length})
				</span>
			</div>

			<div class="space-y-1 p-1">
				{#each unregisteredMints as mint (mint.url)}
					<MintListItem {mint} />
				{/each}
			</div>
		</div>
	{/if}

	<!-- Add new mint section -->
	<Separator />
	<div class="space-y-2">
		<div class="flex items-center space-x-2">
			<Input placeholder="https://mint.example.com" bind:value={mintUrl} class="flex-1 text-xs" />
			<Button size="sm" onclick={handleAddMint} disabled={!mintUrl.trim() || isProcessing}>
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
