<script lang="ts">
	import QRCode from '@castlenine/svelte-qrcode';

	export let invoice: string | undefined;
</script>

<QRCode data={invoice} haveBackgroundRoundedEdges padding={2} />
