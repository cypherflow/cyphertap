<!-- src/lib/components/nostr/NostrSendView.svelte -->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import {
		getBolt11Amount,
		getBolt11Description,
		getBolt11ExpiresAt
	} from '@nostr-dev-kit/ndk-wallet';

	import { wallet, walletBalance, sendLNPayment, generateToken } from '$lib/stores/wallet.js';
	import { scanResult } from '$lib/stores/scan-store.js';
	import { navigateTo } from '$lib/stores/navigation.js';
	import { copyToClipboard, pasteFromClipboard } from '$lib/utils/clipboard.js';


	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import TokenQrCode from '../wallet/token-qr-code.svelte';
	import ViewContainer from './view-container.svelte';

    import LoaderCircle from '@lucide/svelte/icons/loader-circle';
    import CircleAlert from '@lucide/svelte/icons/circle-alert';
    import CircleCheck from '@lucide/svelte/icons/circle-check';
    import Send from '@lucide/svelte/icons/send';
    import ArrowRight from '@lucide/svelte/icons/arrow-right';
    import Banknote from '@lucide/svelte/icons/banknote';
    import Info from '@lucide/svelte/icons/info';
    import Copy from '@lucide/svelte/icons/copy';
    import Share2 from '@lucide/svelte/icons/share-2';
    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
    import Zap from '@lucide/svelte/icons/zap';
    import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
	import QrCode from '@lucide/svelte/icons/qr-code';


	// Common state
	let activeTab = 'lightning';
	let error: string | undefined;
	// Lightning state
	let lnInvoice = '';
	let isSendingLn = false;
	let isLnPaymentSent = false;

	// Lightning fee reserve
	const LIGHTNING_FEE_RESERVE = 3; // 3 sats minimum fee reserve

	// Decoded invoice info
	let decodedAmount: number | undefined;
	let decodedDescription: string | undefined;
	let isExpired = false;

	// Token state
	let tokenAmount = '100';
	let isGeneratingToken = false;
	let isTokenGenerated = false;
	let generatedToken: string | undefined;
	let tokenMint: string | undefined;

	// Clipboard state
	let canPasteFromClipboard =
		typeof navigator !== 'undefined' &&
		!!navigator.clipboard &&
		!!navigator.clipboard.readText &&
		window.isSecureContext;

	const presetAmounts = [
		{ label: '100 sats', value: 100 },
		{ label: '1K sats', value: 1000 },
		{ label: '5K sats', value: 5000 }
	];

	// Function to decode bolt11 invoice and update UI
	function decodeInvoice() {
		if (!lnInvoice || lnInvoice.length < 10) {
			clearDecodedInfo();
			return;
		}

		try {
			// Get amount in sats (convert from msats)
			decodedAmount = getBolt11Amount(lnInvoice);
			if (decodedAmount) {
				decodedAmount = decodedAmount / 1000; // Convert from msats to sats
			}

			// Get description
			decodedDescription = getBolt11Description(lnInvoice);

			// Check if expired
			const expiryTimestamp = getBolt11ExpiresAt(lnInvoice);

			if (expiryTimestamp) {
				isExpired = expiryTimestamp < Date.now() / 1000;
			} else {
				isExpired = false;
			}

			// Clear error if we successfully decoded
			error = undefined;
		} catch (e) {
			console.error('Error decoding invoice:', e);
			clearDecodedInfo();
			error = 'Invalid Lightning invoice format';
		}
	}

	function clearDecodedInfo() {
		decodedAmount = undefined;
		decodedDescription = undefined;
		isExpired = false;
	}

	// Watch for changes to the invoice and decode it
	$: if (lnInvoice) {
		decodeInvoice();
	} else {
		clearDecodedInfo();
	}

	// Calculate total amount needed (payment + fee reserve)
	$: totalAmountNeeded = decodedAmount ? decodedAmount + LIGHTNING_FEE_RESERVE : 0;

	// Check if we have enough balance for payment + fee reserve
	$: hasEnoughBalanceForLn = totalAmountNeeded <= $walletBalance;

	async function handleSendLightning() {
		if (!$wallet || !lnInvoice) return;

		try {
			isSendingLn = true;
			error = undefined;

			// Check if invoice is expired
			if (isExpired) {
				throw new Error('This invoice has expired');
			}

			// Get payment amount
			if (!decodedAmount) {
				throw new Error('Invalid payment amount');
			}

			const paymentAmount = decodedAmount;

			// Check if we have enough balance for payment + fee reserve
			if (paymentAmount + LIGHTNING_FEE_RESERVE > $walletBalance) {
				throw new Error(
					`Insufficient balance. You need at least ${paymentAmount + LIGHTNING_FEE_RESERVE} sats (${paymentAmount} + ${LIGHTNING_FEE_RESERVE} fee reserve) but have ${$walletBalance} sats.`
				);
			}

			// Send payment with our new implementation
			const result = await sendLNPayment(lnInvoice);
			console.log('Payment result:', result);

			if (result?.success) {
				isLnPaymentSent = true;
				toast.success('Payment sent successfully!');

				// Return to main menu after 2 seconds if in popover
				setTimeout(() => {
					navigateTo('main');
				}, 2000);
			} else {
				throw new Error('Payment failed');
			}
		} catch (e) {
			console.error('Lightning payment error:', e);
			error = e instanceof Error ? e.message : 'Failed to send payment';
		} finally {
			isSendingLn = false;
		}
	}

	// Function to share token (if supported by browser)
	async function shareToken() {
		if (!generatedToken) return;

		if (navigator.share) {
			try {
				await navigator.share({
					title: `${tokenAmount} sats Cashu Token`,
					text: `Here's ${tokenAmount} sats for you!`,
					url: `cashu:${generatedToken}`
				});
				toast.success('Token shared successfully!');
			} catch (error) {
				console.error('Error sharing token:', error);
			}
		} else {
			await copyToClipboard(generatedToken, 'Token');
		}
	}

	// Update handleGenerateToken function
	async function handleGenerateToken() {
		if (!$wallet || !tokenAmount) return;

		try {
			isGeneratingToken = true;
			error = undefined;

			const amount = parseInt(tokenAmount);

			// Check if we have enough balance
			if (amount > $walletBalance) {
				throw new Error(
					`Insufficient balance. You need ${amount} sats but have ${$walletBalance} sats.`
				);
			}

			// Generate token using our wallet store function
			let { encodedToken, mint } = await generateToken(amount);
			generatedToken = encodedToken;
			tokenMint = mint;
			isTokenGenerated = true;
			//toast.success('Token generated successfully!');
		} catch (e) {
			console.error('Token generation error:', e);
			error = e instanceof Error ? e.message : 'Failed to generate token';
		} finally {
			isGeneratingToken = false;
		}
	}

	function reset() {
		// Reset Lightning state
		lnInvoice = '';
		isSendingLn = false;
		isLnPaymentSent = false;
		clearDecodedInfo();

		// Reset Token state
		tokenAmount = '100';
		isGeneratingToken = false;
		isTokenGenerated = false;
		generatedToken = undefined;

		// Reset common state
		error = undefined;
	}

	// Handle paste invoice from clipboard
	async function handlePaste() {
		const text = await pasteFromClipboard();
		if (text) {
			lnInvoice = text;
			toast.success('Invoice pasted from clipboard');
		} else {
			toast.error('Failed to read from clipboard');
		}
	}

	// Check for scanned result on mount
	onMount(() => {
		// Check if we have a scanned lightning invoice from the store
		if ($scanResult && $scanResult.type === 'lightning') {
			// Set the invoice value
			lnInvoice = $scanResult.data;

			// Clear the scan result from the store
			scanResult.clearResult();

			// Focus lightning tab
			activeTab = 'lightning';
		}
	});

	onDestroy(() => {
		reset();
	});
</script>

<ViewContainer className="p-4">
	<div class="mb-4 flex items-center">
		<Button variant="ghost" size="icon" onclick={() => navigateTo('main')} class="mr-2">
			<ChevronLeft class="h-4 w-4" />
		</Button>
		<h3 class="text-lg font-medium">Send Sats</h3>
	</div>
	<div class="space-y-4">
		<Tabs.Root value={activeTab} onValueChange={(value) => (activeTab = value)} class="w-full">
			<Tabs.List class="grid w-full grid-cols-2">
				<Tabs.Trigger value="lightning" class="flex items-center justify-center">
					<Zap class="mr-1 h-4 w-4" />
					Lightning
				</Tabs.Trigger>
				<Tabs.Trigger value="token" class="flex items-center justify-center">
					<Banknote class="mr-1 h-4 w-4" />
					Ecash
				</Tabs.Trigger>
			</Tabs.List>

			<div class="mt-4">
				<Tabs.Content value="lightning" class="mx-1 space-y-4">
					<!-- Lightning content with fee reserve info -->
					{#if !isLnPaymentSent}
						{#if !decodedAmount}
							<div class="grid gap-2">
								<Label for="invoice">Lightning Invoice</Label>
								<Input
									id="invoice"
									bind:value={lnInvoice}
									placeholder="Paste Lightning invoice (BOLT11)"
									class="w-full"
								/>
								<div class="flex w-full gap-2">
									<Button
										variant="outline"
										class="flex-1"
										onclick={handlePaste}
										disabled={!canPasteFromClipboard}
									>
										<ClipboardPaste class="mr-2 h-4 w-4" />
										Paste
									</Button>
									<Button variant="outline" class="flex-1" onclick={() => navigateTo('qr-scanner')}>
										<QrCode class="mr-2 h-4 w-4" />
										Scan QR
									</Button>
								</div>
							</div>
						{/if}

						{#if lnInvoice && (decodedAmount || decodedDescription || isExpired)}
							<div class="bg-background-50 rounded-lg p-3">
								<h3 class="mb-2 flex items-center gap-1 text-sm font-medium">
									<Info class="h-3.5 w-3.5" />
									Invoice Details
								</h3>

								{#if decodedDescription}
									<div class="mb-1 flex justify-between text-sm">
										<span>Description:</span>
										<span class="max-w-[60%] text-right">{decodedDescription}</span>
									</div>
								{/if}

								{#if decodedAmount}
									<div class="flex justify-between text-sm">
										<span>Amount:</span>
										<span class="font-medium">{decodedAmount} sats</span>
									</div>

									<!-- Only show fee reserve and total when there's not enough balance -->
									{#if !hasEnoughBalanceForLn}
										<div class="mt-1 flex justify-between text-sm text-muted-foreground">
											<span>Fee reserve:</span>
											<span>{LIGHTNING_FEE_RESERVE} sats</span>
										</div>

										<div class="mt-1 flex justify-between text-sm font-medium">
											<span>Total required:</span>
											<span class="text-primary">{decodedAmount + LIGHTNING_FEE_RESERVE} sats</span>
										</div>
									{/if}
								{/if}

								{#if isExpired}
									<div class="mt-2 flex items-center text-sm font-medium text-destructive">
										<CircleAlert class="mr-1 h-3.5 w-3.5" />
										This invoice has expired
									</div>
								{/if}
							</div>
						{/if}

						<div class="pt-2">
							<div class="mb-2 text-sm">
								<span class="font-medium">Available balance:</span>
								<span class="text-primary">{$walletBalance} sats</span>
							</div>

							<!-- Display warning if balance is insufficient for payment + fee -->
							{#if decodedAmount && !hasEnoughBalanceForLn && !error}
								<div
									class="mb-2 flex items-center gap-2 rounded border bg-amber-50 p-2 text-amber-600"
								>
									<CircleAlert class="h-4 w-4 flex-shrink-0" />
									<p class="text-xs">
										Insufficient balance for lightning payment. You need {totalAmountNeeded} sats but
										have {$walletBalance} sats.
									</p>
								</div>
							{/if}

							<Button
								class="w-full"
								disabled={!lnInvoice ||
									isSendingLn ||
									isExpired ||
									!decodedAmount ||
									!hasEnoughBalanceForLn}
								onclick={handleSendLightning}
							>
								{#if isSendingLn}
									<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
									Sending payment...
								{:else}
									<Send class="mr-2 h-4 w-4" />
									Send Payment
								{/if}
							</Button>
						</div>
					{:else}
						<div class="rounded-lg bg-green-50 p-4 text-center">
							<CircleCheck class="mx-auto mb-2 h-10 w-10 text-green-500" />
							<p class="font-medium text-green-700">Payment sent successfully!</p>

							{#if decodedAmount}
								<p class="mt-2 text-green-600">{decodedAmount} sats</p>
							{/if}

							{#if decodedDescription}
								<p class="mt-1 text-sm text-green-600">{decodedDescription}</p>
							{/if}
						</div>
					{/if}
				</Tabs.Content>

				<Tabs.Content value="token" class="mx-1 space-y-4">
					{#if !isTokenGenerated}
						<div class="grid gap-2">
							<Label for="tokenAmount">Amount (sats)</Label>
							<Input
								id="tokenAmount"
								type="number"
								bind:value={tokenAmount}
								min="1"
								placeholder="Enter amount in sats"
							/>

							<div class="flex flex-wrap gap-2">
								{#each presetAmounts as preset}
									<Button
										variant="outline"
										size="sm"
										onclick={() => (tokenAmount = preset.value.toString())}
									>
										{preset.label}
									</Button>
								{/each}
							</div>
						</div>

						<div class="pt-2">
							<div class="mb-2 text-sm">
								<span class="font-medium">Available balance:</span>
								<span class="text-primary">{$walletBalance} sats</span>
							</div>

							<Button
								class="w-full"
								disabled={!tokenAmount ||
									parseInt(tokenAmount) < 1 ||
									parseInt(tokenAmount) > $walletBalance ||
									isGeneratingToken}
								onclick={handleGenerateToken}
							>
								{#if isGeneratingToken}
									<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
									Generating token...
								{:else}
									<ArrowRight class="mr-2 h-4 w-4" />
									Generate Token
								{/if}
							</Button>
						</div>
					{:else}
						<div class="grid place-items-center gap-4">
							<p class="text-lg font-semibold">
								{tokenAmount}
								{parseInt(tokenAmount) === 1 ? 'sat' : 'sats'}
							</p>

							<TokenQrCode token={generatedToken} />

							<div class="bg-background-50 flex w-full justify-center rounded-lg p-3">
								<p class="font-mono text-xs">
									{#if generatedToken}
										{generatedToken.substring(0, 10)}...{generatedToken.substring(
											generatedToken.length - 10
										)}
									{/if}
								</p>
							</div>

							<div class="flex w-full gap-2">
								<Button
									variant="outline"
									class="flex-1"
									onclick={() => copyToClipboard(generatedToken!, 'Token')}
								>
									<Copy class="mr-2 h-4 w-4" />
									Copy
								</Button>

								<Button variant="outline" class="flex-1" onclick={shareToken}>
									<Share2 class="mr-2 h-4 w-4" />
									Share
								</Button>
							</div>
						</div>
					{/if}
				</Tabs.Content>
			</div>
		</Tabs.Root>

		{#if error}
			<div class="flex items-center gap-2 rounded border bg-destructive/10 p-3 text-destructive">
				<CircleAlert class="h-4 w-4" />
				<p class="text-sm">{error}</p>
			</div>
		{/if}
	</div>
</ViewContainer>
