<!-- src/lib/components/qr-codes/token-qr-code.svelte -->
<script lang="ts">
	import QRCode from '@castlenine/svelte-qrcode';
	import AnimatedTokenQrCode from './animated-token-qr-code.svelte';

	export let token: string | undefined;
	export let size = 275;

	// This is a simple check to determine if we need animation
	// The actual animation logic is handled in the AnimatedTokenQRCode component
	const MAX_QR_LENGTH = 500;
	$: needsAnimation = token ? token.length > MAX_QR_LENGTH : false;
</script>

{#if needsAnimation}
	<AnimatedTokenQrCode {token} {size} />
{:else}
	<QRCode data={token} haveBackgroundRoundedEdges padding={2} {size} />
{/if}
