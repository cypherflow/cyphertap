<script lang="ts">
	import { isConnecting, login } from '$lib/stores/nostr.js';
	import {
		initializeApp,
		appState,
		InitStatus
	} from '$lib/services/init.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { isUserMenuOpen, navigateTo } from '$lib/stores/navigation.js';
	import { onMount } from 'svelte';
	import ViewContainer from './view-container.svelte';
	
	let hasNostrExtension = $state<boolean>(false);
	let errorMessage = $state<string>('');
	let isLoading = $state<boolean>(false);
	
	// Auto-attempt login on mount
	onMount(async () => {
		// First check if Nostr extension exists
		hasNostrExtension = !!window.nostr;
		
		if (hasNostrExtension) {
			await handleExtensionLogin();
		} else {
			errorMessage = 'No Nostr extension found. Please install one and try again.';
		}
	});
	
	async function handleExtensionLogin() {
		try {
			errorMessage = '';
			isLoading = true;
			
			// Step 1: Login with extension
			const loginSuccess = await login({
				method: 'extension'
			});
			
			if (!loginSuccess) {
				errorMessage = 'Login failed. Please check your Nostr extension and try again.';
				return;
			}
			
			// Step 2: Initialize app with the logged in user
			const initResult = await initializeApp(false);
			
			if (initResult.initialized) {
				navigateTo('main');
				isUserMenuOpen.set(false);
			} else {
				errorMessage = appState.error || 'App initialization failed';
			}
		} catch (error) {
			if (error instanceof Error) {
				errorMessage = error.message;
			} else {
				errorMessage = 'Unknown error during login';
			}
			console.error('Login error:', error);
		} finally {
			isLoading = false;
		}
	}
	
	function checkForExtension() {
		hasNostrExtension = !!window.nostr;
		if (!hasNostrExtension) {
			errorMessage = 'No Nostr extension found. Please install one and try again.';
		} else {
			errorMessage = '';
			handleExtensionLogin();
		}
	}
</script>

<ViewContainer className="p-4">
	<div class="mb-4 flex items-center">
		<Button variant="ghost" size="icon" onclick={() => navigateTo('login')} class="mr-2">
			<ChevronLeft class="h-4 w-4" />
		</Button>
		<h3 class="text-lg font-medium">Nostr Extension Login</h3>
	</div>
	
	<!-- Error message display -->
	{#if errorMessage}
		<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
			<span class="block sm:inline">{errorMessage}</span>
		</div>
	{/if}
	
	<div class="space-y-4">
		<p class="text-sm text-muted-foreground">
			{hasNostrExtension
				? 'Connecting to your Nostr extension. Please approve the connection in your extension if prompted.'
				: 'No Nostr extension detected. Please install a Nostr extension and try again.'}
		</p>
		
		<div class="flex flex-col items-center justify-center py-8">
			{#if hasNostrExtension && !errorMessage && isLoading}
				<!-- Loading animation when attempting to connect -->
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
				<p class="text-sm font-medium">
					{$isConnecting || appState.status === InitStatus.INITIALIZING
						? 'Connecting to extension...'
						: 'Waiting for extension approval...'}
				</p>
			{:else if !hasNostrExtension}
				<!-- Extension not found icon -->
				<div class="text-amber-500 mb-4">
					<svg class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
				</div>
				<p class="text-sm font-medium">No Nostr extension found</p>
			{/if}
		</div>
		
		<!-- Retry button if there was an error or if extension wasn't found -->
		{#if errorMessage || !hasNostrExtension}
			<Button 
				class="w-full" 
				onclick={checkForExtension} 
				disabled={isLoading || $isConnecting || appState.status === InitStatus.INITIALIZING}
			>
				{hasNostrExtension ? 'Try Again' : 'Check Again for Extension'}
			</Button>
		{/if}
		
		<!-- Back to main login options -->
		<Button variant="outline" class="w-full" onclick={() => navigateTo('login')}>
			Choose Another Login Method
		</Button>
	</div>
</ViewContainer>
