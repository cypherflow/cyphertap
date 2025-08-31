<!-- src/lib/components/settings/MintManagement.svelte -->
<script lang="ts">
	import { consolidateTokens } from '$lib/stores/wallet.js';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
    import { Alert, AlertDescription } from '$lib/components/ui/alert/index.js'

    import Banknote from '@lucide/svelte/icons/banknote';
    import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import MintList from './mint-list.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import Button from '$lib/components/ui/button/button.svelte';

	// Simple state for the consolidation process
	let isConsolidating: boolean = false;
	let consolidateError: string | null = '';

	async function handleConsolidate() {
		try {
			// Reset state
			isConsolidating = true;
			consolidateError = '';

			// Call the consolidateTokens function
			await consolidateTokens();
		} catch (error) {
			consolidateError =
				error instanceof Error ? error.message : 'Failed to consolidate your tokens.';
		} finally {
			isConsolidating = false;
		}
	}
</script>

<Accordion.Item>
	<Accordion.Trigger>
		<span class="flex w-full gap-2 text-left">
			<Banknote />
			Mint Management
		</span>
	</Accordion.Trigger>
	<Accordion.Content>
		<div class="mt-2 space-y-3">
			<p class="text-sm text-muted-foreground">
				Mints are servers that issue ecash tokens. Add trusted mints to send, receive, and manage
				your Cashu tokens.
			</p>
			<MintList />
			<Separator />
			<p class="text-sm text-muted-foreground">
				Consolidation combines your tokens and removes spent ones for better wallet performance.
			</p>

			<!-- Simple consolidation button with minimal feedback -->
			<Button
				disabled={isConsolidating}
				variant="outline"
				class="w-full"
				onclick={handleConsolidate}
			>
				<RefreshCw class={isConsolidating ? 'mr-2 animate-spin' : 'mr-2'} />
				{isConsolidating ? 'Consolidating tokens...' : 'Consolidate Tokens'}
			</Button>

			<!-- Error message -->
			{#if consolidateError}
				<Alert class="mt-2 border-red-200 bg-red-50">
					<AlertDescription class="text-red-700">
						{consolidateError}
					</AlertDescription>
				</Alert>
			{/if}
		</div>
	</Accordion.Content>
</Accordion.Item>
