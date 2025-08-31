<!-- src/lib/components/wallet/RecentTransactions.svelte -->
<script lang="ts">
	import {
		walletTransactions,
		formatTransaction,
		isLoadingTransactions
	} from '$lib/stores/wallet.js';
	import Separator from '$lib/components/ui/separator/separator.svelte';
    import ArrowDownLeft from '@lucide/svelte/icons/arrow-down-left'
    import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right'
    import LoaderCircle from '@lucide/svelte/icons/loader-circle'
    import ChevronRight from '@lucide/svelte/icons/chevron-right';

	import { formatDistanceToNow } from 'date-fns';
	import { navigateTo } from '$lib/stores/navigation.js';
	import { formatTransactionDescription } from '$lib/utils/tx.js';
	import Button from '$lib/components/ui/button/button.svelte';
	// Props
	export let limit: number = 3;
	// Format the timestamp for display
	function formatTime(timestamp: number): string {
		if (!timestamp) return 'Unknown time';
		try {
			return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
		} catch (error) {
			return 'Invalid time';
		}
	}
	// Get recent transactions based on the limit
	$: recentTransactions = $walletTransactions.slice(0, limit);
</script>

<div class="space-y-2">
	<div class="mb-1 flex items-center justify-between">
		<h3 class="text-sm font-medium">Recent Transactions</h3>
		{#if $walletTransactions.length > limit}
			<Button variant="ghost" class="text-xs" onclick={() => navigateTo('transaction-history')}>
				View all
				<ChevronRight class="ml-1 h-3 w-3" />
			</Button>
		{/if}
	</div>
	<Separator class="my-1" />
	<div class="space-y-1">
		{#if $isLoadingTransactions}
			<div class="flex items-center justify-center py-3">
				<LoaderCircle class="h-4 w-4 animate-spin text-primary" />
			</div>
		{:else if recentTransactions.length === 0}
			<div class="py-3 text-center text-xs text-muted-foreground">
				<p>No transactions yet</p>
			</div>
		{:else}
			{#each recentTransactions as tx}
				{#if tx}
					{@const formattedTx = formatTransaction(tx)}
					{@const displayDescription = formatTransactionDescription(formattedTx.description)}
					<button
						class="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
						onclick={() => navigateTo('transaction-details', { tx })}
					>
						<div class="flex items-center">
							<div
								class={`mr-2 flex h-6 w-6 items-center justify-center rounded-full ${formattedTx.direction === 'in' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}
							>
								{#if formattedTx.direction === 'in'}
									<ArrowDownLeft class="h-3 w-3" />
								{:else}
									<ArrowUpRight class="h-3 w-3" />
								{/if}
							</div>
							<div class="text-left">
								<p class="text-xs">
									{displayDescription.length > 15
										? displayDescription.substring(0, 15) + '...'
										: displayDescription}
								</p>
								<p class="text-xs text-muted-foreground">{formatTime(formattedTx.timestamp)}</p>
							</div>
						</div>
						<div class="text-right">
							<p
								class={`text-xs font-medium ${formattedTx.direction === 'in' ? 'text-green-600' : 'text-amber-600'}`}
							>
								{formattedTx.direction === 'in' ? '+' : '-'}{formattedTx.amount} sats
							</p>
						</div>
					</button>
				{/if}
			{/each}
		{/if}
	</div>
</div>
