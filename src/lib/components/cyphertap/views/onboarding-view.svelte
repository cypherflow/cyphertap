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
	<div class="flex justify-center border border-orange-700">
		<Carousel.Root class=" w-full max-w-sm">
			<Carousel.Content>
				<!-- <Carousel.Item>
					<div class="p-0">
						<Card.Root>
							<Card.Content
								class="flex aspect-square items-center justify-center border border-blue-500 p-0"
							>
								<OrbitingCyphertap />
							</Card.Content>
						</Card.Root>
					</div>
				</Carousel.Item> -->
				<Carousel.Item>
					<div class="p-0">
						<Card.Root>
							<Card.Content
								class="flex aspect-square items-center justify-center border border-yellow-500 p-0"
							>
								<AnimatedBeamMultipleInputs />
                                 <!-- <AnimatedBeamUnidirection /> -->
							</Card.Content>
						</Card.Root>
					</div>
				</Carousel.Item>
			</Carousel.Content>
		</Carousel.Root>
	</div>
</ViewContainer>
