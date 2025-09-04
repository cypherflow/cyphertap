<!-- src/lib/components/nostr/LinkDeviceLoginView.svelte -->
<script lang="ts">
	import { navigateTo } from '$lib/stores/navigation.js';
	import { scanResult } from '$lib/stores/scan-store.js';
	import { login } from '$lib/stores/nostr.js';
	import {
		appState,
		InitStatus
	} from '$lib/services/init.svelte';
	import { decryptToSigner } from '$lib/utils/nip49.js';
	import { onMount } from 'svelte';
    import * as InputOTP from "$lib/components/ui/input-otp/index.js";
	import { REGEXP_ONLY_DIGITS } from 'bits-ui';
	import ViewContainer from './view-container.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
    import Link from '@lucide/svelte/icons/link'
    import Check from '@lucide/svelte/icons/check'
    import QrCode from '@lucide/svelte/icons/qr-code'

	// State
	let encryptedKey = '';
	let pin = '';
	let errorMessage = '';
	let isProcessing = false;

	// Check for scanned result on mount
	onMount(() => {
		// Check if we have a scanned ncrypt key
		if ($scanResult && $scanResult.type === 'link' && $scanResult.data) {
			// Extract ONLY the ncryptsec part - this is critical for bech32 decoding
			const match = $scanResult.data.match(/(ncryptsec1[a-zA-Z0-9]+)/);
			if (match && match[1]) {
				encryptedKey = match[1];
				console.log('Extracted encrypted key:', encryptedKey.substring(0, 20) + '...');
			} else {
				console.error('Could not extract ncryptsec key from QR data:', $scanResult.data);
			}

			// Clear the scan result from the store
			scanResult.clearResult();
		}
	});

	// Attempt to decrypt and login
	async function handleLinkDevice() {
		if (!encryptedKey || !pin) {
			errorMessage = 'Both QR code and PIN are required';
			return;
		}

		try {
			isProcessing = true;
			errorMessage = '';

			// Verify we have a valid ncryptsec key
			if (!encryptedKey.startsWith('ncryptsec1')) {
				throw new Error('Invalid encrypted key format. The key must start with ncryptsec1.');
			}

			try {
				console.log(`Attempting to decrypt key starting with: ${encryptedKey.substring(0, 20)}...`);

				// Decrypt the private key using the PIN
				const signer = decryptToSigner(encryptedKey, pin);

				// Get the hex-formatted private key
				const privateKey = signer.privateKey;

				if (!privateKey) {
					throw new Error('Failed to decrypt private key');
				}

				console.log('Successfully decrypted private key');

				await login({
					method: 'private-key',
					privateKey
				});
			} catch (decryptError: any) {
				console.error('Decryption error:', decryptError);

				// Provide more helpful error messages based on the error type
				if (decryptError.message.includes('checksum')) {
					errorMessage = 'Invalid QR code format. Please rescan.';
				} else if (
					decryptError.message.includes('tag mismatch') ||
					decryptError.message.includes('decryption failed')
				) {
					errorMessage = 'Incorrect PIN. Please try again.';
				} else {
					errorMessage = `Decryption failed: ${decryptError.message}`;
				}
			}
		} catch (error) {
			console.error('Link device error:', error);
			errorMessage =
				error instanceof Error
					? error.message
					: 'Failed to link device. Check your PIN and try again.';
		} finally {
			isProcessing = false;
		}
	}

	// Initiate QR code scanning
	function scanQRCode() {
		// Navigate to QR scanner view
		navigateTo('qr-scanner');
	}
</script>

<ViewContainer className="space-y-4 p-4">
	<div class="mb-4 flex items-center">
		<Button variant="ghost" size="icon" onclick={() => navigateTo('login')} class="mr-2">
			<ChevronLeft class="h-4 w-4" />
		</Button>
		<h3 class="text-lg font-medium">Link from another device</h3>
	</div>

	<!-- Error message display -->
	{#if errorMessage}
		<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
			<span class="block sm:inline">{errorMessage}</span>
		</div>
	{/if}

	<div class="space-y-4">
		<!-- Instructions -->
		<div class="text-sm text-muted-foreground">
			Scan the QR code displayed on your primary device, then enter the 4-digit PIN to complete the
			linking process.
		</div>

		<!-- QR Code Scanning Button -->
		<Button
			variant={encryptedKey ? 'outline' : 'default'}
			class="w-full justify-center"
			onclick={scanQRCode}
			disabled={!!encryptedKey || appState.status === InitStatus.INITIALIZING}
		>
			{#if !!encryptedKey}
				<Check class="mr-2 h-4 w-4" />
				QR Code Scanned
			{:else}
				<QrCode class="mr-2 h-4 w-4" />
				Scan QR Code
			{/if}
		</Button>

		<!-- PIN Input (only shown after QR code is scanned) -->
		{#if encryptedKey}
			<div class="flex flex-col items-center space-y-2 text-center">
				<label for="pin" class="text-xs text-foreground">Enter PIN from primary device</label>

				<InputOTP.Root maxlength={4} bind:value={pin} pattern={REGEXP_ONLY_DIGITS}>
					{#snippet children({ cells })}
						<InputOTP.Group>
							{#each cells as cell (cell)}
								<InputOTP.Slot {cell} />
							{/each}
						</InputOTP.Group>
					{/snippet}
				</InputOTP.Root>
			</div>

			<!-- Link Button -->
			<Button
				variant="default"
				class="w-full"
				disabled={isProcessing ||
					!pin ||
					pin.length !== 4 ||
					appState.status === InitStatus.INITIALIZING}
				onclick={handleLinkDevice}
			>
				<Link class="mr-2 h-4 w-4" />
				{isProcessing || appState.status === InitStatus.INITIALIZING ? 'Linking...' : 'Link Device'}
			</Button>
		{/if}
	</div>
</ViewContainer>
