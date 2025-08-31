<!-- src/lib/components/nostr/NostrTransactionDetailsView.svelte (updated) -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { formatDistanceToNow } from 'date-fns';
	import type { NDKCashuWalletTx } from '@nostr-dev-kit/ndk';
	import {
		canReclaimTransaction,
		formatTransaction,
		reclaimToken
	} from '$lib/stores/wallet.js';
	import { navigateTo, context } from '$lib/stores/navigation.js';
	import { formatTransactionDescription } from '$lib/utils/tx.js';
    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
    import ArrowDownLeft from '@lucide/svelte/icons/arrow-down-left';
    import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
    import Info from '@lucide/svelte/icons/info';
    import CalendarClock from '@lucide/svelte/icons/calendar-clock';
    import Undo from '@lucide/svelte/icons/undo';
	import ViewContainer from './view-container.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
    import { Alert, AlertDescription } from '$lib/components/ui/alert/index.js'

	// Props for transaction details
	let tx: NDKCashuWalletTx = $context.tx!;
	let transaction = formatTransaction(tx);
	let canReclaim = false;
	let nanoId: string | undefined;
	let isReclaiming = false;
	let reclaimError: string | null = null;
	let reclaimSuccess = false;
	let shouldShowButton = true;

	// Check if this transaction can be reclaimed
	async function checkReclaimStatus() {
		if (transaction?.direction === 'out' && transaction?.description) {
			const result = await canReclaimTransaction(transaction.description);
			canReclaim = result.canReclaim;
			nanoId = result.nanoId;
			shouldShowButton = canReclaim; // Initialize button visibility based on initial canReclaim value
		}
	}

	// Handle token reclaim
	async function handleReclaim() {
		if (!nanoId) return;

		isReclaiming = true;
		reclaimError = null;
		reclaimSuccess = false;

		try {
			await reclaimToken(nanoId);
			reclaimSuccess = true;
			canReclaim = false;
			shouldShowButton = false; // Hide button after successful reclaim
		} catch (error) {
			reclaimError = error instanceof Error ? error.message : 'Failed to reclaim token';
			// Hide the button regardless of error type
			shouldShowButton = false;
		} finally {
			isReclaiming = false;
		}
	}

	onMount(() => {
		checkReclaimStatus();
	});

	// Format the timestamp for display
	function formatTime(timestamp: number): string {
		if (!timestamp) return 'Unknown time';

		try {
			return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
		} catch (error) {
			return 'Invalid time';
		}
	}

	// Get display-friendly description
	$: displayDescription = formatTransactionDescription(transaction?.description || '');
</script>

<ViewContainer className="p-4">
	<!-- Transaction Detail View -->
	<div class="mb-4 flex items-center">
		<Button
			variant="ghost"
			size="icon"
			onclick={() => navigateTo($context.sourceView)}
			class="mr-2"
		>
			<ChevronLeft class="h-4 w-4" />
		</Button>
		<h3 class="text-lg font-medium">Transaction Details</h3>
	</div>

	<div class="space-y-4">
		{#if transaction}
			<!-- Header with transaction type and amount -->
			<div class="flex items-center justify-between">
				<div class="flex items-center">
					<div
						class={`mr-3 flex h-10 w-10 items-center justify-center rounded-full ${transaction.direction === 'in' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}
					>
						{#if transaction.direction === 'in'}
							<ArrowDownLeft class="h-5 w-5" />
						{:else}
							<ArrowUpRight class="h-5 w-5" />
						{/if}
					</div>
					<div>
						<p class="font-medium">{transaction.direction === 'in' ? 'Received' : 'Sent'}</p>
					</div>
				</div>
				<div class="text-right">
					<p
						class={`text-xl font-bold ${transaction.direction === 'in' ? 'text-green-600' : 'text-amber-600'}`}
					>
						{transaction.direction === 'in' ? '+' : '-'}{transaction.amount} sats
					</p>
				</div>
			</div>

			<Separator />

			<!-- Transaction details -->
			<div class="space-y-3">
				<!-- Description -->
				<div class="flex items-start justify-between">
					<div class="flex items-center text-muted-foreground">
						<Info class="mr-2 h-4 w-4" />
						<span>Description</span>
					</div>
					<div class="max-w-[65%] text-right">
						<p class="break-words">{displayDescription}</p>
					</div>
				</div>

				<!-- Date -->
				<div class="flex items-center justify-between">
					<div class="flex items-center text-muted-foreground">
						<CalendarClock class="mr-2 h-4 w-4" />
						<span>Date</span>
					</div>
					<div class="text-right">
						<p>{transaction.date.toLocaleString()}</p>
						<p class="text-xs text-muted-foreground">{formatTime(transaction.timestamp)}</p>
					</div>
				</div>

				<!-- Mint -->
				<div class="flex items-center justify-between">
					<div class="flex items-center text-muted-foreground">
						<span>Mint</span>
					</div>
					<div class="text-right">
						<p class="max-w-[180px] truncate text-sm">{transaction.mint}</p>
					</div>
				</div>

				<!-- Fee (if any) -->
				{#if transaction.fee > 0}
					<div class="flex items-center justify-between">
						<div class="flex items-center text-muted-foreground">
							<span>Fee</span>
						</div>
						<div class="text-right">
							<p>{transaction.fee} sats</p>
						</div>
					</div>
				{/if}

				<!-- ID (truncated) -->
				<div class="flex items-center justify-between">
					<div class="flex items-center text-muted-foreground">
						<span>ID</span>
					</div>
					<div class="text-right">
						<p class="max-w-[180px] truncate font-mono text-xs">{transaction.id}</p>
					</div>
				</div>

				<!-- Nutzap support -->
				{#if transaction.hasNutzapRedemption}
					<div class="mt-2 rounded-md bg-blue-50 p-2">
						<p class="text-xs text-blue-700">This transaction redeemed Nutzaps (NIP-61)</p>
					</div>
				{/if}
			</div>

			<!-- Reclaim button for sent tokens -->
			{#if transaction.direction === 'out'}
				{#if canReclaim && shouldShowButton}
					<div class="mt-4">
						<Button
							variant="outline"
							class="w-full"
							onclick={handleReclaim}
							disabled={isReclaiming}
						>
							<Undo class="mr-2 h-4 w-4" />
							{isReclaiming ? 'Reclaiming...' : 'Reclaim token'}
						</Button>
					</div>
				{/if}

				{#if reclaimSuccess}
					<Alert class="mt-2 border-green-200 bg-green-50">
						<AlertDescription class="text-green-700">
							Token successfully reclaimed! Your balance has been updated.
						</AlertDescription>
					</Alert>
				{/if}

				{#if reclaimError}
					<Alert class="mt-2 border-red-200 bg-red-50">
						<AlertDescription class="text-red-700">
							{#if reclaimError.includes('already been spent')}
								This token has already been spent elsewhere and cannot be reclaimed.
							{:else if reclaimError.includes('already been reclaimed')}
								This token has already been reclaimed.
							{:else}
								{reclaimError}
							{/if}
						</AlertDescription>
					</Alert>
				{/if}
			{/if}
		{:else}
			<div class="py-8 text-center text-muted-foreground">
				<p>Transaction details not available</p>
			</div>
		{/if}
	</div>
</ViewContainer>
