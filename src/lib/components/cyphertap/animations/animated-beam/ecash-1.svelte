<script lang="ts">
	// Scroll down to see the original Component
	import { cn } from '$lib/utils.js';
	import Landmark from '@lucide/svelte/icons/landmark';
  import EyesOff from '@lucide/svelte/icons/eye-off'
	import AnimatedBeam from './animated-beam.svelte';
	import Circle from './circle.svelte';
	let containerRef;
	// Circles
	let div1Ref;
	let div2Ref;
	let div3Ref;
	let div4Ref;
	let div5Ref;
	let div6Ref;
	let div7Ref;
	let className: any = '';
	export { className as class };

  let mintIconSize = 30
  let mintCircleClass= "h-16 w-16 p-0"
</script>

<div
	bind:this={containerRef}
	class={cn(
		'relative flex w-full max-w-[500px] items-center justify-center overflow-hidden rounded-lg border bg-background p-10  md:shadow-xl dark:shadow-[#090909]',
		className
	)}
>
	<!--  Gradient Line -->
	<!-- <div
    class="absolute right-5 top-0 h-px w-1/2 bg-gradient-to-l from-transparent via-white/30 via-10% to-transparent"
  /> -->
	<!-- Main Component  -->

	<div class="flex h-full w-full max-w-lg flex-col items-center justify-between gap-10">
		<div class="flex justify-center gap-2">
			<!-- Div 1 -->
			<Circle class={mintCircleClass}>
				<div class="z-50 rounded rounded-full bg-background p-2" bind:this={div1Ref}>
					<Landmark size={mintIconSize} />
				</div>
			</Circle>
		</div>
		<div class="flex flex-col justify-center">
			<!-- Div 6 -->
			<Circle class={mintCircleClass}>
				<div class="z-50 rounded rounded-full bg-background p-2" bind:this={div6Ref}>
					<EyesOff size={mintIconSize} />
				</div>
			</Circle>
		</div>
		<div class="flec-col flex justify-center">
			<!-- Div 7 -->
			<Circle class={mintCircleClass}>
				<div class="z-50 rounded rounded-full bg-background p-2" bind:this={div7Ref}>
					<EyesOff size={mintIconSize} />
				</div>
			</Circle>
		</div>
	</div>

	<AnimatedBeam bind:containerRef bind:fromRef={div1Ref} bind:toRef={div6Ref} />
	<AnimatedBeam bind:containerRef bind:fromRef={div2Ref} bind:toRef={div6Ref} />
	<AnimatedBeam bind:containerRef bind:fromRef={div3Ref} bind:toRef={div6Ref} />
	<AnimatedBeam bind:containerRef bind:fromRef={div4Ref} bind:toRef={div6Ref} />
	<AnimatedBeam bind:containerRef bind:fromRef={div5Ref} bind:toRef={div6Ref} />
	<AnimatedBeam bind:containerRef bind:fromRef={div6Ref} bind:toRef={div7Ref} />
</div>
