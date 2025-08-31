<!-- src/lib/components/settings/SignOutButton.svelte -->
<script lang="ts">
	import { navigateTo } from '$lib/stores/navigation.js';
	import { logout } from '$lib/services/logout.js';

	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';

    import LogOut from '@lucide/svelte/icons/log-out';
    import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
    import Database from '@lucide/svelte/icons/database';
	import Button from '$lib/components/ui/button/button.svelte';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';

	export let variant: 'outline' | 'default' | 'destructive' = 'outline';
	export let size: 'sm' | 'default' | 'lg' | 'icon' = 'sm';
	export let className = 'w-full justify-start text-destructive hover:text-destructive';

	// Track clear database option
	let clearDatabase = true;

	// Handle the logout confirmation
	async function handleConfirmLogout() {
		// Call the centralized logout function
		await logout({ clearDatabase });

		// Navigate to login view
		navigateTo('login');
	}
</script>

<Dialog.Root>
	<Dialog.Trigger>
		<Button {variant} {size} class={className}>
			<LogOut class="mr-2 h-4 w-4" />
			Sign Out
		</Button>
	</Dialog.Trigger>

	<Dialog.Content class="sm:max-w-[425px]">
		<Dialog.Header>
			<Dialog.Title class="flex items-center">
				<LogOut class="mr-2 h-5 w-5 text-destructive" />
				Sign Out
			</Dialog.Title>
			<Dialog.Description>You're about to sign out of CypherFlow.</Dialog.Description>
		</Dialog.Header>

		<div class="grid gap-4 py-4">
			<!-- Using the Alert component instead of a custom div -->
			<Alert.Root variant="warning">
				<TriangleAlert class="h-4 w-4" />
				<Alert.Title>Remember your keys</Alert.Title>
				<Alert.Description>
					When you sign out, you'll need your private key or a Nostr extension to sign back in. Make
					sure you have saved your private key in a secure location.
				</Alert.Description>
			</Alert.Root>

			<div class="border-t pt-4">
				<div class="flex items-start space-x-2">
					<Checkbox id="clear-database" bind:checked={clearDatabase} />
					<div class="grid gap-1.5 leading-none">
						<label
							for="clear-database"
							class="flex items-center text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
						>
							<Database class="mr-1 h-4 w-4 text-muted-foreground" />
							Clear local chat database
						</label>
						<p class="text-xs text-muted-foreground">
							All chat data is encrypted and only accessible with your key. You can safely leave
							this unchecked if you plan to sign in again on this device.
						</p>
					</div>
				</div>
			</div>
		</div>

		<Dialog.Footer>
			<Dialog.Close>
				<Button variant="outline">Cancel</Button>
			</Dialog.Close>
			<Button variant="destructive" onclick={handleConfirmLogout}>Sign Out</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
