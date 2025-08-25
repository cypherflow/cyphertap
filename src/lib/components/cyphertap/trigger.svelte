<script lang="ts">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '../ui/button/index.js';
</script>

<Popover.Root>
	<Popover.Trigger><Button>Test</Button></Popover.Trigger>
	<Popover.Content>Place content for the popover here.</Popover.Content>
</Popover.Root>
