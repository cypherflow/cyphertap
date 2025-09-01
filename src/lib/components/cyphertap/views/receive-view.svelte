<!-- src/lib/components/cyphertap/views/receive-view.svelte -->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { getDecodedToken } from '@cashu/cashu-ts';

	import { pasteFromClipboard, copyToClipboard } from '$lib/utils/clipboard.js';
	import { scanResult } from '$lib/stores/scan-store.js';
	import { navigateTo } from '$lib/stores/navigation.js';

    import * as Tabs from "$lib/components/ui/tabs/index.js";
	import { wallet, createDeposit, receiveToken, addMint } from '$lib/stores/wallet.js';

    import Copy from '@lucide/svelte/icons/copy';
    import LoaderCircle from '@lucide/svelte/icons/loader-circle';
    import CircleAlert from '@lucide/svelte/icons/circle-alert';
    import CircleCheck from '@lucide/svelte/icons/circle-check';
    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
    import Banknote from '@lucide/svelte/icons/banknote';
    import Zap from '@lucide/svelte/icons/zap';
    import QrCode from '@lucide/svelte/icons/qr-code';
    import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
    import ShieldCheck from '@lucide/svelte/icons/shield-check';
    import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import ViewContainer from './view-container.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import LnQrCode from '../wallet/ln-qr-code.svelte';

	// Common state
	let activeTab = 'lightning';
	let error: string | undefined;

	// Lightning state
	let amount = '100';
	let isProcessing = false;
	let isLoading = false;
	let bolt11: string | undefined;
	let isPaymentReceived = false;

	// Token state
	let tokenInput = '';
	let isReceivingToken = false;
	let isTokenReceived = false;
	let receivedAmount: number | undefined;
	let isTokenDecoded = false;
	let decodedToken: {
		mint: string;
		amount: number;
		memo?: string;
		isTrustedMint: boolean;
	} | null = null;
	let isAddingMint = false;

	// Clipboard state
	let canPasteFromClipboard =
		typeof navigator !== 'undefined' &&
		!!navigator.clipboard &&
		!!navigator.clipboard.readText &&
		window.isSecureContext;

	async function handleGenerateInvoice() {
		if (!$wallet || !amount) return;

		try {
			isLoading = true;
			error = undefined;
			isPaymentReceived = false;

			const result = await createDeposit(parseInt(amount));
			bolt11 = result.bolt11;

			// Set up success handler for this specific deposit
			result.deposit.on('success', () => {
				isPaymentReceived = true;
				toast.success(`Successfully received ${amount} sats!`);

				// Return to main menu after 2 seconds
				setTimeout(() => {
					navigateTo('main');
				}, 2000);
			});

			result.deposit.on('error', (errorMsg) => {
				error = `Deposit failed: ${errorMsg}`;
				toast.error('Deposit failed');
			});

			isLoading = false;
			isProcessing = true;
		} catch (e) {
			console.error('Invoice generation error:', e);
			error = e instanceof Error ? e.message : 'Failed to create invoice';
			isLoading = false;
			isProcessing = false;
		}
	}

	async function decodeToken(tokenStr: string) {
		try {
			if (!tokenStr) return null;

			// Reset states
			isTokenDecoded = false;
			error = undefined;

			// Decode token
			const decoded = getDecodedToken(tokenStr);

			if (!decoded || !decoded.proofs || !decoded.mint) {
				throw new Error('Invalid token format');
			}

			// Calculate total amount from proofs
			const tokenAmount = decoded.proofs.reduce((sum, proof) => {
				return sum + proof.amount;
			}, 0);

			// Check if mint is in user's trusted mints
			const isTrustedMint = $wallet?.mints.includes(decoded.mint) || false;

			// Set decoded token info
			decodedToken = {
				mint: decoded.mint,
				amount: tokenAmount,
				memo: decoded.memo || undefined,
				isTrustedMint
			};

			isTokenDecoded = true;
			return decodedToken;
		} catch (e) {
			console.error('Token decode error:', e);
			error = e instanceof Error ? e.message : 'Failed to decode token';
			decodedToken = null;
			isTokenDecoded = false;
			return null;
		}
	}

	async function handleAddMintAndReceiveToken() {
		if (!decodedToken || !tokenInput) return;

		try {
			isAddingMint = true;
			error = undefined;

			// First add the mint
			await addMint(decodedToken.mint);
			toast.success('New mint trusted successfully');

			// Then receive the token
			await handleReceiveToken();
		} catch (e) {
			console.error('Add mint error:', e);
			error = e instanceof Error ? e.message : 'Failed to trust mint';
			isAddingMint = false;
		}
	}

	async function handleReceiveToken() {
		if (!$wallet || !tokenInput) return;

		try {
			isReceivingToken = true;
			isTokenReceived = false;
			error = undefined;

			const tokenEvent = await receiveToken(tokenInput);

			// Extract amount from token event if available
			if (tokenEvent) {
				try {
					// Attempt to extract amount from token or event
					receivedAmount =
						tokenEvent.amount ||
						tokenEvent.proofs?.reduce((sum, proof) => sum + proof.amount, 0) ||
						undefined;
				} catch (error) {
					console.log('Could not determine token amount:', error);
				}
			}

			isTokenReceived = true;
			toast.success('Successfully received token!');

			// Return to main menu after 2 seconds
			setTimeout(() => {
				navigateTo('main');
			}, 2000);

			// Reset the form (but keep the success state visible)
			tokenInput = '';
			isReceivingToken = false;
			isAddingMint = false;
		} catch (e) {
			console.error('Token receive error:', e);
			error = e instanceof Error ? e.message : 'Failed to receive token';
			isReceivingToken = false;
			isAddingMint = false;
		}
	}

	const presetAmounts = [
		{ label: '100 sats', value: 100 },
		{ label: '1K sats', value: 1000 },
		{ label: '5K sats', value: 5000 }
	];

	function reset() {
		// Reset Lightning state
		amount = '100';
		isProcessing = false;
		isLoading = false;
		bolt11 = undefined;
		isPaymentReceived = false;

		// Reset Token state
		tokenInput = '';
		isReceivingToken = false;
		isTokenReceived = false;
		receivedAmount = undefined;
		isTokenDecoded = false;
		decodedToken = null;
		isAddingMint = false;

		// Reset common state
		error = undefined;
	}

	// Handle paste from clipboard for token input
	async function handlePaste() {
		const text = await pasteFromClipboard();
		if (text) {
			// Handle potential protocol prefixes
			let tokenData = text;
			if (text.toLowerCase().startsWith('cashu:')) {
				tokenData = text.substring(6); // Remove 'cashu:' prefix
			}

			tokenInput = tokenData;
			toast.success('Token pasted from clipboard');
		} else {
			toast.error('Failed to read from clipboard');
		}
	}

	function clearDecodedInfo() {
		isTokenDecoded = false;
		decodedToken = null;
	}

	$: if (tokenInput) {
		decodeToken(tokenInput);
	} else {
		clearDecodedInfo();
	}

	// Check for scanned token on mount
	onMount(() => {
		// Check if we have a scanned ecash token from the stores
		if ($scanResult && $scanResult.type === 'ecash') {
			//console.log('Found scaned ecash token in store');

			// Set the token value
			tokenInput = $scanResult.data;

			// Clear scan result from store
			scanResult.clearResult();

			// Focus token tab
			activeTab = 'token';

			//// Add a slight delay to ensure the component is fully mounted
			//setTimeout(() => {
			//	// Auto-decode the token if it appears valid
			//	if (tokenInput && tokenInput.length > 20) {
			//		console.log('Auto-decoding token');
			//		handleDecodeToken();
			//	}
			//}, 100);
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
		<h3 class="text-lg font-medium">Receive Sats</h3>
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
				<Tabs.Content value="lightning" class="space-y-4">
					{#if !isProcessing}
						<div class="grid gap-2">
							<Label for="amount">Amount (sats)</Label>
							<Input
								id="amount"
								type="number"
								bind:value={amount}
								min="1"
								placeholder="Enter amount in sats"
							/>
							<div class="flex flex-wrap gap-2">
								{#each presetAmounts as preset}
									<Button
										variant="outline"
										size="sm"
										onclick={() => (amount = preset.value.toString())}
									>
										{preset.label}
									</Button>
								{/each}
							</div>
						</div>
					{:else if bolt11}
						<div class="grid place-items-center gap-4">
							<p class="text-lg font-semibold">
								{amount}
								{parseInt(amount) === 1 ? 'sat' : 'sats'}
							</p>

							{#if isPaymentReceived}
								<div class="rounded-lg bg-green-50 p-4 text-center">
									<CircleCheck class="mx-auto mb-2 h-10 w-10 text-green-500" />
									<p class="font-medium text-green-700">Payment received!</p>
								</div>
							{:else}
								<LnQrCode invoice={bolt11} />

								<div class="mt-6 text-center">
									<div
										class="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800"
									>
										<LoaderCircle class="mr-1 h-3 w-3 animate-spin" />
										Waiting for payment...
									</div>
								</div>

								<Button class="w-full" onclick={() => copyToClipboard(bolt11!, 'Invoice')}>
									<Copy class="mr-2 h-4 w-4" />
									Copy Invoice
								</Button>
							{/if}
						</div>
					{/if}

					<div class="flex flex-col gap-2">
						{#if !isProcessing}
							<Button
								disabled={!amount || parseInt(amount) < 1 || isLoading}
								onclick={handleGenerateInvoice}
								class="w-full"
							>
								{#if isLoading}
									<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
								{/if}

                <Zap class="h-4 w-4" />
								Generate Invoice
							</Button>
						{/if}
					</div>
				</Tabs.Content>

				<Tabs.Content value="token" class="space-y-4">
					{#if !isTokenReceived}
						{#if !decodedToken}
							<div class="grid gap-2">
								<Label for="token">Ecash Token</Label>
								<Input id="token" bind:value={tokenInput} placeholder="Paste or scan Cashu token" />
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

						{#if isTokenDecoded && decodedToken}
							<div class="rounded-lg border p-4">
								<h4 class="mb-2 text-lg font-medium">Token Details</h4>
								<div class="grid gap-2 text-sm">
									<div class="flex justify-between">
										<span class="font-medium">Amount:</span>
										<span>{decodedToken.amount} sats</span>
									</div>

									<div class="flex items-start justify-between">
										<span class="font-medium">Mint:</span>
										<div class="flex max-w-[80%] flex-col items-end text-right">
											<span class="break-all text-xs">{decodedToken.mint}</span>
											<div class="flex items-center gap-1">
												{#if decodedToken.isTrustedMint}
													<ShieldCheck class="h-4 w-4 text-green-500" />
													<span class="text-green-600">Trusted</span>
												{:else}
													<ShieldAlert class="h-4 w-4 text-amber-500" />
													<span class="text-amber-600">Untrusted</span>
												{/if}
											</div>
										</div>
									</div>

									{#if decodedToken.memo}
										<div class="flex items-start justify-between">
											<span class="font-medium">Description:</span>
											<span class="max-w-[70%] text-right">{decodedToken.memo}</span>
										</div>
									{/if}
								</div>
							</div>

							{#if decodedToken.isTrustedMint}
								<Button class="w-full" disabled={isReceivingToken} onclick={handleReceiveToken}>
									{#if isReceivingToken}
										<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
										Receiving token...
									{:else}
										Receive Token
									{/if}
								</Button>
							{:else}
								<div class="grid gap-2">
									<Button
										class="w-full"
										variant="default"
										disabled={isAddingMint || isReceivingToken}
										onclick={handleAddMintAndReceiveToken}
									>
										{#if isAddingMint || isReceivingToken}
											<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
											{isAddingMint ? 'Adding mint...' : 'Receiving token...'}
										{:else}
											Trust Mint and Receive Token
										{/if}
									</Button>
									<Button class="w-full" variant="destructive" onclick={() => navigateTo('main')}>
										Cancel
									</Button>
								</div>
							{/if}
						{/if}
					{:else}
						<div class="rounded-lg bg-green-50 p-4 text-center">
							<CircleCheck class="mx-auto mb-2 h-10 w-10 text-green-500" />
							<p class="font-medium text-green-700">Token received!</p>
							{#if receivedAmount !== undefined}
								<p class="mt-1 text-green-600">
									{receivedAmount}
									{receivedAmount === 1 ? 'sat' : 'sats'}
								</p>
							{/if}
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
