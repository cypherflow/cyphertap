<!-- src/lib/components/qr-codes/qr-scanner.svelte -->
<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import QrScanner from 'qr-scanner';
	import { toast } from 'svelte-sonner';

	// For UR decoder (required for animated QR codes)
	let URDecoder: any;
	let urDecoder: any;
	let urDecoderProgress: number = 0;

	const dispatch = createEventDispatcher();

	let videoElement: HTMLVideoElement;
	let qrScanner: QrScanner | null = null;
	let hasCamera = true;

	onMount(async () => {
		try {
			// Check if camera is available
			const cameraAvailable = await QrScanner.hasCamera();

			if (!cameraAvailable) {
				toast.error('No camera found on this device');
				hasCamera = false;
				return;
			}

			// Import URDecoder for multi-part QR codes (required for animated ecash tokens)
			try {
				const module = await import('@gandlaf21/bc-ur');
				URDecoder = module.URDecoder;
				urDecoder = new URDecoder();
			} catch (e) {
				//console.log('URDecoder not available, multi-part QR codes not supported');
			}

			// Create QR scanner instance
			qrScanner = new QrScanner(videoElement, (result) => handleScanResult(result), {
				highlightScanRegion: true,
				highlightCodeOutline: true,
				returnDetailedScanResult: true
			});

			// Start the scanner
			await qrScanner.start();
		} catch (error) {
			console.error('QR Scanner error:', error);
			toast.error('Failed to access camera. Please check permissions.');
		}
	});

	function handleScanResult(result: any) {
		const data = result.data;

		// Debug log
		//console.log('QR scan result:', data);

		// Check if it's a UR code (used for animated QR codes as per NUT-16)
		if (urDecoder && data.toLowerCase().startsWith('ur:')) {
			try {
				urDecoder.receivePart(data);
				urDecoderProgress = urDecoder.estimatedPercentComplete() || 0;

				// If complete, dispatch the result
				if (urDecoder.isComplete() && urDecoder.isSuccess()) {
					const ur = urDecoder.resultUR();
					let decoded;

					try {
						// First try to decode as CBOR
						decoded = ur.decodeCBOR().toString();
					} catch (e) {
						// If that fails, just use the raw bytes as string
						//console.log("CBOR decode failed, using raw string");
						decoded = ur.toString();
					}

					// For ecash tokens, we need the decoded string
					dispatch('scanned', decoded);

					// Stop scanning after a successful scan
					pauseScanner();
				}
			} catch (error) {
				console.error('Error decoding UR format:', error);
				// Don't close scanner - allow user to try again
			}
		} else {
			// Process normal QR codes

			// Check for cashu protocol prefix and handle it
			let tokenData = data;

			// Handle potential protocol prefixes (cashu:)
			if (data.toLowerCase().startsWith('cashu:')) {
				tokenData = data.substring(6); // Remove 'cashu:' prefix
			}

			// Handle lightning prefixes
			if (data.toLowerCase().startsWith('lightning:')) {
				tokenData = data.substring(10);
			}

			// Normal QR code, dispatch the result directly
			dispatch('scanned', tokenData);

			// Stop scanning after a successful scan
			pauseScanner();
		}
	}

	// Pause the scanner temporarily after a successful scan
	function pauseScanner() {
		if (qrScanner) {
			qrScanner.stop();
		}
	}

	onDestroy(() => {
		// Clean up resources when component is destroyed
		if (qrScanner) {
			qrScanner.stop();
			qrScanner.destroy();
		}
	});
</script>

<!-- Camera view -->
<div class="relative h-full w-full">
	{#if !hasCamera}
		<div class="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
			No camera available
		</div>
	{/if}

	<video bind:this={videoElement} class="h-full w-full object-cover">
		<track kind="captions" src="" label="Captions" />
	</video>

	{#if urDecoderProgress > 0}
		<div class="absolute bottom-0 left-0 right-0 bg-background/80 p-2">
			<div class="h-2 w-full rounded-full bg-muted">
				<div class="h-2 rounded-full bg-primary" style="width: {urDecoderProgress * 100}%"></div>
			</div>
			<div class="mt-1 text-center text-xs">
				{Math.round(urDecoderProgress * 100)}%
				{urDecoderProgress > 0.9 ? '- Keep scanning...' : ''}
			</div>
		</div>
	{/if}
</div>
