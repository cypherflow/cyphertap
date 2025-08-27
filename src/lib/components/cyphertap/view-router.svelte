<!-- src/lib/components/nostr/ViewRouter.svelte -->
<script lang="ts">
	import { currentView, inTransition } from '$lib/stores/navigation.js';
	import LoginView from './views/login-view.svelte';
	// Import all view components
	// import NostrMainView from './NostrMainView.svelte';
	// import NostrLoginView from './NostrLoginView.svelte';
	// import NostrPrivateKeyView from './NostrPrivateKeyView.svelte';
	// import NostrReceiveView from './NostrReceiveView.svelte';
	// import NostrSendView from './NostrSendView.svelte';
	// import NostrSettingsView from './NostrSettingsView.svelte';
	// import NostrTransactionsView from './NostrTransactionsView.svelte';
	// import NostrTransactionDetailView from './NostrTransactionDetailsView.svelte';
	// import QRScannerView from './QRScannerView.svelte';
	// import LinkDeviceLoginView from './LinkDeviceLoginView.svelte';
	// import NostrGenerateKeyView from './NostrGenerateKeyView.svelte';
	// import NostrExtensionView from './NostrExtensionView.svelte';
	// New prop to determine if we're in a drawer or popover
	export let isDesktop = true;
	// Component mapping
	const viewComponents = {
		// main: NostrMainView,
		login: LoginView
		// 'link-device': LinkDeviceLoginView,
		// 'private-key': NostrPrivateKeyView,
		// receive: NostrReceiveView,
		// send: NostrSendView,
		// settings: NostrSettingsView,
		// transactions: NostrTransactionsView,
		// 'transaction-detail': NostrTransactionDetailView,
		// 'qr-scanner': QRScannerView,
		//   'generate-key': NostrGenerateKeyView,
		//   'extension-login': NostrExtensionView
	};
</script>

<!-- Different wrapper based on container type -->
{#if isDesktop}
	<!-- For popover: original adaptive height behavior -->
	<div class={`min-h-32 ${$inTransition ? 'relative' : 'h-full '}`}>
		{#each Object.entries(viewComponents) as [name, Component]}
			{#if $currentView === name}
				<div class={$inTransition ? 'absolute inset-0' : ''}>
					<svelte:component this={Component} />
				</div>
			{/if}
		{/each}
	</div>
{:else}
	<!-- For drawer: fixed height container with scrolling content and max width -->
	<div class="flex h-[70vh] justify-center overflow-y-auto">
		<div class="mx-auto w-full max-w-md">
			<div class={$inTransition ? 'relative' : 'h-full'}>
				{#each Object.entries(viewComponents) as [name, Component]}
					{#if $currentView === name}
						<!-- Fixed top position when in drawer -->
						<div class={$inTransition ? 'absolute inset-0' : ''}>
							<svelte:component this={Component} />
						</div>
					{/if}
				{/each}
			</div>
		</div>
	</div>
{/if}
