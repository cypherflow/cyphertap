<script lang="ts">
	import { ModeWatcher } from 'mode-watcher';
	import '../app.css';

	let { children } = $props();
</script>

<ModeWatcher />
<div data-vaul-drawer-wrapper>
	{@render children()}
</div>
