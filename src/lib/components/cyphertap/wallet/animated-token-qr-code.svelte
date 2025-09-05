<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import QRCode from '@castlenine/svelte-qrcode';

	import {Accordion, AccordionItem, AccordionContent, AccordionTrigger}  from '$lib/components/ui/accordion/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
    import LoaderCircle from '@lucide/svelte/icons/loader-circle';
    import Grid2X2 from '@lucide/svelte/icons/grid-2x2';
    import Grid3X3 from '@lucide/svelte/icons/grid-3x3';
    import CircleAlert from '@lucide/svelte/icons/circle-alert';
    import Snail from '@lucide/svelte/icons/snail';
    import Rabbit from '@lucide/svelte/icons/rabbit';

	export let token: string | undefined;
	export let size = 275;
	export let padding = 4;

	// Animation state
	let isAnimating = false;
	let qrValue = '';
	let frameCounter = 0;
	let totalFragments = 0;
	let progress = 0;
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let urEncoder: any = null;

	// Animation settings
	type AnimationSpeed = 'slow' | 'fast';
	let animationSpeed: AnimationSpeed = 'fast';
	const speedValues = {
		slow: 400,
		fast: 200
	};

	type QRDensity = 'simple' | 'detailed';
	let qrDensity: QRDensity = 'detailed';
	const densityValues = {
		simple: 60, // Simpler QR code with less information per frame
		detailed: 100 // More detailed QR code with more information per frame
	};

	async function setupUREncoder() {
		if (!token) return;

		try {
			// Dynamically import bc-ur
			const bcUrModule = await import('@gandlaf21/bc-ur');

			// Create a buffer from the token string directly
			const messageBuffer = new TextEncoder().encode(token);

			// Create a UR object using fromBuffer method like in the React example
			const ur = bcUrModule.UR.fromBuffer(messageBuffer);

			// Create the encoder with the configured density value
			urEncoder = new bcUrModule.UREncoder(ur, densityValues[qrDensity], 0);

			totalFragments = urEncoder.fragmentsLength;
			frameCounter = 0;
			progress = 0;
			isAnimating = true;

			// Clear any existing interval
			if (intervalId) clearInterval(intervalId);

			// Simply set QR value to the next part each interval
			// Don't worry about sequence resets - let the library handle it
			intervalId = setInterval(() => {
				qrValue = urEncoder.nextPart();

				// Update the progress (this is just for UI)
				frameCounter = (frameCounter + 1) % totalFragments;
				progress = Math.round(((frameCounter + 1) / totalFragments) * 100);
			}, speedValues[animationSpeed]);

			// Set initial QR value
			qrValue = urEncoder.nextPart();
			//console.log("First QR value:", qrValue);
		} catch (error) {
			console.error('Error setting up UR encoder:', error);
			isAnimating = false;

			// Fallback to using the token directly for the QR code
			if (token) {
				qrValue = token;
			}
		}
	}

	function changeSpeed(speed: AnimationSpeed) {
		// Update the speed state
		animationSpeed = speed;
		//console.log('Speed changed to:', speed);

		// Restart animation with new speed if already animating
		if (isAnimating && urEncoder && intervalId) {
			clearInterval(intervalId);

			// Restart interval with new speed but keep the same encoder
			intervalId = setInterval(() => {
				qrValue = urEncoder.nextPart();
				frameCounter = (frameCounter + 1) % totalFragments;
				progress = Math.round(((frameCounter + 1) / totalFragments) * 100);
			}, speedValues[animationSpeed]);

			// Force an immediate update to get a new QR value
			qrValue = urEncoder.nextPart();
		}
	}

	async function changeDensity(density: QRDensity) {
		// Update QR density state
		qrDensity = density;
		//console.log('QR density changed to:', density);

		// Need to recreate the encoder with new density value
		if (isAnimating) {
			// Clear existing animation
			if (intervalId) clearInterval(intervalId);

			// Re-setup the encoder with new density setting
			await setupUREncoder();
		}
	}

	// Initialize animation when token is available
	$: if (token) {
		setupUREncoder();
	}

	onMount(() => {
		if (token) {
			setupUREncoder();
		}
	});

	onDestroy(() => {
		if (intervalId) clearInterval(intervalId);
	});
</script>

{#if token}
	<div class="flex flex-col items-center gap-4">
		<div class="relative">
			{#if qrValue}
				<!-- Use a keyed each block to force re-rendering -->
				{#key qrValue}
					<QRCode haveBackgroundRoundedEdges data={qrValue} {size} {padding} />
				{/key}
			{:else}
				<div style="height: {size}px; width: {size}px;" class="grid place-items-center">
					<LoaderCircle class="h-8 w-8 animate-spin text-primary" />
				</div>
			{/if}
		</div>

		{#if isAnimating}
			<Accordion type="single" class="w-full max-w-md">
				<AccordionItem value="qr-settings">
					<AccordionTrigger class="flex items-center gap-2">
						<CircleAlert class="h-4 w-4" />
						<span>Problems scanning QR?</span>
					</AccordionTrigger>
					<AccordionContent>
						<div class="space-y-6 pt-2">
							<!-- Animation Speed Controls -->
							<div class="space-y-2">
								<div class="flex items-center">
									<label for="speed-control" class="text-sm font-medium"> Speed </label>
								</div>

								<div class="grid grid-cols-2 gap-2">
									<!-- Wrap each button in a key block to ensure reactive updates -->
									{#key animationSpeed}
										<Button
											variant={animationSpeed === 'slow' ? 'default' : 'outline'}
											size="sm"
											onclick={() => changeSpeed('slow')}
										>
											<Snail class="mr-2 h-4 w-4" />
											Slow
										</Button>
									{/key}

									{#key animationSpeed}
										<Button
											variant={animationSpeed === 'fast' ? 'default' : 'outline'}
											size="sm"
											onclick={() => changeSpeed('fast')}
										>
											<Rabbit class="mr-2 h-4 w-4" />
											Fast
										</Button>
									{/key}
								</div>
							</div>

							<!-- QR Code Density Controls -->
							<div class="space-y-2">
								<div class="flex items-center">
									<label for="density-control" class="text-sm font-medium"> QR Complexity </label>
								</div>

								<div class="grid grid-cols-2 gap-2">
									<!-- Wrap each button in a key block to ensure reactive updates -->
									{#key qrDensity}
										<Button
											variant={qrDensity === 'simple' ? 'default' : 'outline'}
											size="sm"
											onclick={() => changeDensity('simple')}
										>
											<Grid2X2 class="mr-2 h-4 w-4" />
											Simple
										</Button>
									{/key}

									{#key qrDensity}
										<Button
											variant={qrDensity === 'detailed' ? 'default' : 'outline'}
											size="sm"
											onclick={() => changeDensity('detailed')}
										>
											<Grid3X3 class="mr-2 h-4 w-4" />
											Detailed
										</Button>
									{/key}
								</div>
							</div>
						</div>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		{/if}
	</div>
{/if}
