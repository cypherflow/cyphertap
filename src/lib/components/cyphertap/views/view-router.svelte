<!-- src/lib/components/cyphertap/views/view-router.svelte -->
<script lang="ts">
	import { currentView, initNavigation, inTransition } from '$lib/stores/navigation.js';
	import { MediaQuery } from 'svelte/reactivity';
	import LoginGenerateKeyView from './login-generate-key-view.svelte';
	import LoginLinkDeviceView from './login-link-device-view.svelte';
	import LoginNip_07View from './login-nip-07-view.svelte';
	import LoginNsecView from './login-nsec-view.svelte';
	import LoginView from './login-view.svelte';
	import MainView from './main-view.svelte';
	import ReceiveView from './receive-view.svelte';
	import ScannerView from './scanner-view.svelte';
	import SendView from './send-view.svelte';
	import SettingsView from './settings-view.svelte';
	import TransactionDetailsView from './transaction-details-view.svelte';
	import TransactionHistoryView from './transaction-history-view.svelte';
	import OnboardingView from './onboarding-view.svelte';
	
	export let isDesktop = new MediaQuery('(min-width: 768px)').current;
	export let fullScreen = false;


	initNavigation();

	// Component mapping
	const viewComponents = {
		'onboarding': OnboardingView,
		'login': LoginView,
		'login-private-key': LoginNsecView,
		'login-link-device': LoginLinkDeviceView,
		'login-nip-07': LoginNip_07View,
		'login-generate-key': LoginGenerateKeyView,
		'main': MainView,
		'receive': ReceiveView,
		'send': SendView,
		'transaction-history': TransactionHistoryView,
		'transaction-details': TransactionDetailsView,
		'settings': SettingsView,
		'qr-scanner': ScannerView
	};
</script>

<!-- Different wrapper based on container type -->
{#if isDesktop}
	<!-- For popover: original adaptive height behavior -->
	<div class={`min-h-32 border border-yellow-500 ${$inTransition ? 'relative' : 'h-full '}`}>
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
	<div class="flex min-h-[70vh] max-h-full justify-center overflow-y-auto border">
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
