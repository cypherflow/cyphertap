<!-- src/lib/components/cyphertap/views/onboarding-view.svelte -->
<script lang="ts">
	import ViewContainer from './view-container.svelte';
	import OrbitingCyphertap from '../animations/orbiting-circles/orbiting-cyphertap.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Carousel from '$lib/components/ui/carousel/index.js';
	import AnimatedBeamMultipleInputs from '../animations/animated-beam/animated-beam-multiple-inputs.svelte';
	import AnimatedBeamUnidirection from '../animations/animated-beam/animated-beam-unidirection.svelte';
</script>

<ViewContainer className="flex flex-col space-y-4 p-2">
	<!-- <AnimatedBeamMultipleInputs /> -->
	<h1>Welcome to Cyphertap</h1>
</ViewContainer>
