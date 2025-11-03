<!-- src/lib/components/wallet/WalletBalance.svelte -->
<script lang="ts">
	import { wallet } from '$lib/stores/wallet.svelte.js';
    import LoaderCircle from '@lucide/svelte/icons/loader-circle'


	let compact = false;
	$effect(() => {
		console.log("updated balance: from wallet-balance.svelte ", wallet.balance)
	})
</script>

<div class={compact ? 'text-sm text-muted-foreground' : 'text-3xl font-bold'}>
	{#if wallet}
		{wallet.balance.total} sats
	{:else}
		<div class="flex items-center gap-2">
			<LoaderCircle class="h-4 w-4 animate-spin" />
			<span class="text-sm text-muted-foreground">Loading...</span>
		</div>
	{/if}
</div>
