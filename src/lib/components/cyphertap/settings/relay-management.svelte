<!-- src/lib/components/relay-management.svelte -->
<script lang="ts">
    import Router from '@lucide/svelte/icons/router';
	import { AccordionItem, AccordionContent, AccordionTrigger}  from '$lib/components/ui/accordion/index.js';
	import RelayList from './relay-list.svelte';
</script>

<AccordionItem>
	<AccordionTrigger>
		<span class="flex w-full gap-2 text-left">
			<Router />
			Relay Management
		</span>
	</AccordionTrigger>
	<AccordionContent>
		<div class="mt-4 space-y-3">
			<p class="text-sm text-muted-foreground">
				Relays store your encrypted conversations and wallet data. Adding multiple reliable relays
				improves your experience and helps maintain access to your data across devices.
			</p>
			<RelayList />
		</div>
	</AccordionContent>
</AccordionItem>
