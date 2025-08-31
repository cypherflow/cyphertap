<!-- src/lib/components/cyphertap/settings/nostr-keys.svelte -->
<script lang="ts">
	import { currentUser, ndkInstance } from '$lib/stores/nostr.js';
	import { copyToClipboard } from '$lib/utils/clipboard.js';
    import { Alert, AlertDescription } from '$lib/components/ui/alert/index.js'
	import * as Accordion from '$lib/components/ui/accordion/index.js';
    import Copy from '@lucide/svelte/icons/copy';
    import Eye from '@lucide/svelte/icons/eye';
    import EyeOff from '@lucide/svelte/icons/eye-off';
    import Key from '@lucide/svelte/icons/key';
	import Button from '$lib/components/ui/button/button.svelte';

	let showPrivateKey = false;
	let privateKey = '';
	let npub = '';

	// Fetch the pubkey from current user
	$: if ($currentUser) {
		npub = $currentUser.npub || '';
	}

	// Get private key from NDK signer if available
	$: if ($ndkInstance && $ndkInstance.signer && 'privateKey' in $ndkInstance.signer) {
		privateKey = $ndkInstance.signer.privateKey || '';
	}

	function togglePrivateKeyVisibility() {
		showPrivateKey = !showPrivateKey;
	}
</script>

<Accordion.Item>
	<!-- Nostr Keys Section (now collapsible) -->
	<Accordion.Trigger>
		<span class="flex w-full gap-2 text-left">
			<Key />
			Nostr Keys
		</span>
	</Accordion.Trigger>
	<Accordion.Content>
		<div class="mt-4 space-y-3 px-1">
			<!-- Public Key Display -->
			<div>
				<div class="mb-1 text-xs text-muted-foreground">Public Key (npub)</div>
				<div class="flex">
					<code
						class="flex-1 overflow-hidden overflow-ellipsis whitespace-nowrap rounded bg-muted p-2 text-xs"
					>
						{npub || 'Not available'}
					</code>
					<Button
						variant="ghost"
						size="icon"
						class="ml-2 h-8 w-8"
						disabled={!npub}
						onclick={() => copyToClipboard(npub, 'Public key')}
					>
						<Copy class="h-3 w-3" />
					</Button>
				</div>
			</div>

			<!-- Private Key Display -->
			{#if privateKey}
				<div>
					<Alert variant="destructive" class="mb-2 py-2 text-xs">
						<AlertDescription>
							Your private key is sensitive information. Never share it with anyone.
						</AlertDescription>
					</Alert>

					<div>
						<div class="mb-1 text-xs text-muted-foreground">Private Key (nsec)</div>
						<div class="flex">
							<code
								class="flex-1 overflow-hidden overflow-ellipsis whitespace-nowrap rounded bg-muted p-2 text-xs"
							>
								{showPrivateKey ? privateKey : '••••••••••••••••••••••••••••••••'}
							</code>
							<Button
								variant="ghost"
								size="icon"
								class="ml-2 h-8 w-8"
								onclick={togglePrivateKeyVisibility}
							>
								{#if showPrivateKey}
									<EyeOff class="h-3 w-3" />
								{:else}
									<Eye class="h-3 w-3" />
								{/if}
							</Button>
							<Button
								variant="ghost"
								size="icon"
								class="ml-2 h-8 w-8"
								onclick={() => copyToClipboard(privateKey, 'Private key')}
							>
								<Copy class="h-3 w-3" />
							</Button>
						</div>
					</div>
				</div>
			{:else}
				<div class="text-xs text-muted-foreground">
					Private key not available. You may be using a browser extension for authentication.
				</div>
			{/if}
		</div>
	</Accordion.Content>
</Accordion.Item>
