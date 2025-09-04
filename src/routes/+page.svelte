<!-- src/routes/+page.svelte -->
<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import { Cyphertap, cyphertap } from '$lib/index.js';
	import { copyToClipboard } from '$lib/utils/clipboard.js';
	import Copy from '@lucide/svelte/icons/copy';
	import { toast } from 'svelte-sonner';

	// Demo state
	let results = $state({
		npub: '',
		invoice: '',
		token: '',
		signedEvent: '',
		encryptedMessage: '',
		decryptedMessage: '',
		connectionStatus: '',
		userHex: '',
		mints: [] as string[],
		publishedEventId: ''
	});

	let inputs = $state({
		invoiceAmount: '',
		tokenAmount: '',
		cashuToken: '',
		textNote: 'Hello Nostr from CypherTap!',
		messageToEncrypt: 'Secret message',
		recipientPubkey: '',
		encryptedToDecrypt: '',
		senderPubkey: '',
		bolt11ToPay: ''
	});

	// Helper function to handle async operations with error handling
	async function handleAsync(operation: () => Promise<void>, errorMessage: string) {
		try {
			await operation();
		} catch (error) {
			console.error(errorMessage, error);
			toast.error(`${errorMessage}: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	// User info functions
	function getNpub() {
		const npub = cyphertap.getUserNpub();
		results.npub = npub || 'Not available';
		toast.success('NPub retrieved!');
	}

	function getUserHex() {
		const hex = cyphertap.getUserHex();
		results.userHex = hex || 'Not available';
		toast.success('User hex retrieved!');
	}

	function getConnectionStatus() {
		const status = cyphertap.getConnectionStatus();
		results.connectionStatus = `${status.connected}/${status.total} relays connected`;
		toast.success('Connection status retrieved!');
	}


	// Lightning functions
	async function generateInvoice() {
		await handleAsync(async () => {
			const amount = parseInt(inputs.invoiceAmount);
			const result = await cyphertap.createLightningInvoice(
				amount,
				`${amount} sat invoice from CypherTap demo`
			);
			results.invoice = result.bolt11;
			toast.success(`${amount} sat invoice generated!`);
		}, 'Failed to generate invoice');
	}

	async function payInvoice() {
		await handleAsync(async () => {
			if (!inputs.bolt11ToPay.trim()) {
				toast.error('Please enter a BOLT11 invoice');
				return;
			}
			const result = await cyphertap.sendLightningPayment(inputs.bolt11ToPay);
			if (result.success) {
				toast.success('Payment sent successfully!');
				inputs.bolt11ToPay = '';
			}
		}, 'Failed to send payment');
	}

	// Ecash functions
	async function generateToken() {
		await handleAsync(async () => {
			const amount = parseInt(inputs.tokenAmount);
			const result = await cyphertap.generateEcashToken(
				amount,
				`${amount} sat token from CypherTap demo`
			);
			results.token = result.token;
			toast.success(`${amount} sat ecash token generated!`);
		}, 'Failed to generate token');
	}

	async function receiveToken() {
		await handleAsync(async () => {
			const result = await cyphertap.receiveEcashToken(inputs.cashuToken);
			toast.success(`${result.amount} sat ecash token received!`);
		}, 'Failed to receive token');
	}

	// Nostr functions
	async function publishNote() {
		await handleAsync(async () => {
			if (!inputs.textNote.trim()) {
				toast.error('Please enter some text');
				return;
			}
			const event = await cyphertap.publishTextNote(inputs.textNote);
			results.publishedEventId = event.id;
			toast.success('Note published to Nostr!');
		}, 'Failed to publish note');
	}

	async function signEvent() {
		await handleAsync(async () => {
			const event = await cyphertap.signEvent({
				kind: 1,
				content: 'This is a signed event from CypherTap demo'
			});
			results.signedEvent = JSON.stringify(
				{
					id: event.id,
					pubkey: event.pubkey,
					signature: event.signature.substring(0, 20) + '...'
				},
				null,
				2
			);
			toast.success('Event signed!');
		}, 'Failed to sign event');
	}

	// Encryption functions
	async function encryptMessage() {
		await handleAsync(async () => {
			if (!inputs.messageToEncrypt.trim() || !inputs.recipientPubkey.trim()) {
				toast.error('Please enter message and recipient pubkey');
				return;
			}

			let recipientHex = inputs.recipientPubkey;
			if (recipientHex.startsWith('npub')) {
				toast.error('Please use hex pubkey (not npub) for now');
				return;
			}

			const encrypted = await cyphertap.encrypt(inputs.messageToEncrypt, recipientHex);
			results.encryptedMessage = encrypted;
			toast.success('Message encrypted!');
		}, 'Failed to encrypt message');
	}

	async function decryptMessage() {
		await handleAsync(async () => {
			if (!inputs.encryptedToDecrypt.trim() || !inputs.senderPubkey.trim()) {
				toast.error('Please enter encrypted content and sender pubkey');
				return;
			}

			const decrypted = await cyphertap.decrypt(inputs.encryptedToDecrypt, inputs.senderPubkey);
			results.decryptedMessage = decrypted;
			toast.success('Message decrypted!');
		}, 'Failed to decrypt message');
	}


	// Debug logging to see reactive changes
	$effect(() => {
		console.log('🔄 Reactive state changed:', {
			isLoggedIn: cyphertap.isLoggedIn,
			isReady: cyphertap.isReady,
			balance: cyphertap.balance,
			npub: cyphertap.npub
		});
	});
</script>

<div class="container mx-auto max-w-4xl p-4">
	<header class="mb-8 text-center">
		<h1 class="mb-4 text-4xl font-bold">CypherTap Component Library</h1>
		<p class="text-lg text-muted-foreground">
			Nostr, Lightning and Ecash in a single Button component
		</p>
	</header>

	<!-- Component Demo -->
	<div class="mb-2 rounded-lg border p-6">
		<h2 class="mb-4 text-2xl font-semibold">Component</h2>
		<div class="flex flex-col items-center gap-4">
			<Cyphertap />
		</div>
	</div>

	{#if cyphertap.isLoggedIn}
		<!-- Real-time Status -->
		<div class="my-6 rounded-lg border p-4">
			<h3 class="mb-2 text-lg font-semibold">Real-time Status</h3>
			<div class="grid gap-2 text-sm md:grid-cols-3">
				<p><strong>Logged In:</strong> {cyphertap.isLoggedIn ? '✅' : '❌'}</p>
				<p><strong>Wallet Ready:</strong> {cyphertap.isReady ? '✅' : '❌'}</p>
			</div>
			<div class="mt-2 text-xs break-all text-muted-foreground">
				<p><strong>npub:</strong> {cyphertap.npub || 'Not available'}</p>
			</div>
		</div>
	{/if}

	{#if cyphertap.isReady}
		<!-- API Demo -->
		<div class="flex flex-col gap-6">
			<!-- Nostr -->
			<div class="rounded-lg border p-6">
				<h3 class="mb-4 text-xl font-semibold">Nostr</h3>
				<div class="flex flex-col space-y-3">
					<Button onclick={getNpub}>Get NPub</Button>
					{#if results.npub}
						<div class="flex flex-row gap-2 p-2">
							<p class="font-mono text-xs break-all">{results.npub}</p>
							<Button
								size="icon"
								variant="outline"
								onclick={() => copyToClipboard(results.npub, 'NPub')}
							>
								<Copy />
							</Button>
						</div>
					{/if}

					<Button onclick={getUserHex}>Get User Hex</Button>
					{#if results.userHex}
						<div class="flex flex-row gap-2 p-2">
							<p class="font-mono text-xs break-all">{results.userHex}</p>
							<Button
								size="icon"
								variant="outline"
								onclick={() => copyToClipboard(results.userHex, 'Hex')}
							>
								<Copy />
							</Button>
						</div>
					{/if}

					<Button onclick={getConnectionStatus}>Get Connection Status</Button>
					{#if results.connectionStatus}
						<p class="text-sm">{results.connectionStatus}</p>
					{/if}

					<Button onclick={signEvent}>Sign Demo Event</Button>
					{#if results.signedEvent}
						<div class="rounded p-2">
							<pre class="text-xs break-all text-wrap">{results.signedEvent}</pre>
						</div>
					{/if}

					<div class="flex gap-2">
						<Button onclick={publishNote}>Publish Note</Button>
						<Input
							type="text"
							bind:value={inputs.textNote}
							placeholder="Text to publish"
						/>
					</div>


					
				</div>
			</div>

			<!-- Lightning -->
			<div class="rounded-lg border p-6">
				<h3 class="mb-4 text-xl font-semibold">NIP-60 Ecash Wallet</h3>
				<div class="space-y-3">
					<div class="flex gap-2">
						<Button onclick={generateInvoice} disabled={!inputs.invoiceAmount}
							>Generate Invoice</Button
						>
						<Input type="number" bind:value={inputs.invoiceAmount} placeholder="Amount in sats" />
						{#if results.invoice}
							<div class="rounded p-2">
								<p class="font-mono text-xs break-all">{results.invoice}</p>
								<Button onclick={() => copyToClipboard(results.invoice, 'Invoice')}>
									Copy Invoice
								</Button>
							</div>
						{/if}
					</div>

					<div class="flex gap-2">
						<Button onclick={payInvoice} disabled={!inputs.bolt11ToPay}>Pay Invoice</Button>
						<Input
							type="text"
							bind:value={inputs.bolt11ToPay}
							placeholder="Paste BOLT11 invoice to pay"
						/>
					</div>
				</div>
			</div>

			<!-- Ecash -->
			<div class="rounded-lg border p-6">
				<h3 class="mb-4 text-xl font-semibold">Ecash</h3>
				<div class="space-y-3">
					<div class="flex gap-2">
						<Button onclick={generateToken} disabled={!inputs.tokenAmount}>Generate Token</Button>
						<Input type="number" bind:value={inputs.tokenAmount} placeholder="Amount in sats" />
						{#if results.token}
							<div class="rounded p-2">
								<p class="font-mono text-xs break-all">{results.token}</p>
								<Button onclick={() => copyToClipboard(results.token, 'Token')}>Copy Token</Button>
							</div>
						{/if}
					</div>
					<div class="flex gap-2">
						<Button onclick={receiveToken} disabled={!inputs.cashuToken}>Receive Token</Button>
						<Input type="text" bind:value={inputs.cashuToken} placeholder="cashub123..." />
						{#if results.token}
							<div class="rounded p-2">
								<p class="font-mono text-xs break-all">{results.token}</p>
								<Button onclick={() => copyToClipboard(results.token, 'Token')}>Copy Token</Button>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Nostr -->
			<div class="rounded-lg border p-6">
				<h3 class="mb-4 text-xl font-semibold">Nostr</h3>
				<div class="space-y-3">
					<div>
						<input
							type="text"
							bind:value={inputs.textNote}
							class="mb-2 w-full rounded border px-2 py-1"
							placeholder="Text to publish"
						/>
						<Button onclick={publishNote}>Publish Note</Button>
					</div>

					<Button onclick={signEvent}>Sign Demo Event</Button>
					{#if results.signedEvent}
						<div class="rounded p-2">
							<pre class="text-xs">{results.signedEvent}</pre>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<!-- Login Required -->
		<div class="rounded-lg border p-8 text-center">
			<h3 class="mb-4 text-xl font-semibold">
				{cyphertap.isLoggedIn ? 'Initializing Wallet...' : 'Login Required'}
			</h3>
			<p class="text-muted-foreground">
				{cyphertap.isLoggedIn
					? 'Please wait while we set up your wallet...'
					: 'Please click the CypherTap Button above to login and access the API features.'}
			</p>
		</div>
	{/if}
</div>
