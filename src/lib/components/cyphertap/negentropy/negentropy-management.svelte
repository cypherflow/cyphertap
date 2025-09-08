<!-- src/lib/components/NegentropyManagement.svelte -->
<script lang="ts">
    import Zap from '@lucide/svelte/icons/zap';
    import { AccordionItem, AccordionContent, AccordionTrigger } from '$lib/components/ui/accordion/index.js';
    import NegentropyList from './negentropy-list.svelte';
</script>

<AccordionItem>
    <AccordionTrigger>
        <span class="flex w-full gap-2 text-left">
            <Zap />
            Negentropy Sync
        </span>
    </AccordionTrigger>
    <AccordionContent>
        <div class="mt-4 space-y-3">
            <p class="text-sm text-muted-foreground">
                Negentropy syncing efficiently reconciles your wallet data across relays, ensuring all your
                encrypted tokens and transaction history are available even when relays are offline.
            </p>
            <NegentropyList />
        </div>
    </AccordionContent>
</AccordionItem>