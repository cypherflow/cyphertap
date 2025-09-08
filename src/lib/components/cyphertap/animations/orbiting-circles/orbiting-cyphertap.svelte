<script lang="ts">
	import '$lib/styles.css';
	import { cn } from '$lib/utils.js';
    import KeyRound from '@lucide/svelte/icons/key-round';
    import Waypoints from '@lucide/svelte/icons/waypoints'
    import Landmark from '@lucide/svelte/icons/landmark'
	import OrbitingCircles from './orbiting-circles.svelte';
	let className: any = '';
	export { className as class };
</script>

<div
	class={cn(
		'relative flex h-[400px] w-full max-w-[26rem] items-center justify-center overflow-hidden rounded-xl border bg-background md:shadow-xl',
		className
	)}
>
	<span
		class="pointer-events-none bg-gradient-to-b from-black to-gray-300/80 bg-clip-text text-center text-6xl leading-none font-semibold whitespace-pre-wrap text-transparent dark:from-white dark:to-slate-900/10"
	>
		CypherTap Wallet
	</span>

	<!--  Inner Circles  -->
	<OrbitingCircles
		class="h-[30px] w-[30px] border-none bg-transparent"
		duration={15}
		radius={80}
		theta={0}
        cw={false}
	>
         <KeyRound size={40}/>
	</OrbitingCircles>
	<OrbitingCircles
		class="h-[30px] w-[30px] border-none bg-transparent"
		duration={15}
		radius={80}
		theta={120}
        cw={false}
	>
		<Landmark size={40}/>
	</OrbitingCircles>
	<OrbitingCircles
		class="h-[30px] w-[30px] border-none bg-transparent"
		duration={15}
		radius={80}
		theta={240}
        cw={false}
	>
		<Waypoints size={40}/>
	</OrbitingCircles>

	<!-- Outer Circles (reverse)  -->
	<OrbitingCircles
		class="h-[60px] w-[60px] border-none bg-transparent"
		radius={160}
		duration={20}
        theta={0}
	>
		<svg
			width="100"
			height="100"
			viewBox="0 0 1000 1000"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M810 460.227V787.655C810 799.968 800.081 809.961 787.859 809.961H522.161C509.938 809.961 500.02 799.968 500.02 787.655V726.678C501.23 651.931 509.079 580.332 525.558 547.759C535.438 528.168 551.722 517.506 570.427 511.802C605.768 501.102 667.779 508.419 694.099 507.16C694.099 507.16 773.605 510.346 773.605 464.987C773.605 428.48 738.07 431.352 738.07 431.352C698.902 432.374 669.068 429.699 649.738 422.028C617.365 409.203 616.272 385.678 616.155 377.81C614.554 286.934 481.549 276.037 364.359 298.579C236.235 323.127 365.765 508.143 365.765 755.121V788.088C365.531 800.204 355.807 810 343.702 810H212.141C199.919 810 190 800.008 190 787.694V221.393C190 209.08 199.919 199.088 212.141 199.088H335.813C348.036 199.088 357.955 209.08 357.955 221.393C357.955 239.687 378.378 249.876 393.139 239.214C437.617 207.113 494.709 190 558.595 190C701.714 190 809.922 274.03 809.922 460.227H810ZM572.419 393.782C572.419 367.424 551.214 346.062 525.051 346.062C498.887 346.062 477.683 367.424 477.683 393.782C477.683 420.14 498.887 441.501 525.051 441.501C551.214 441.501 572.419 420.14 572.419 393.782Z"
				fill="#662482"
			/>
		</svg>
	</OrbitingCircles>
	<OrbitingCircles
		class="h-[80px] w-[80px] border-none bg-transparent"
		radius={160}
		duration={20}
		theta={120}
	>
		<enhanced:img src="/static/cashu.png" alt="cashu nut" />
	</OrbitingCircles>
	<OrbitingCircles
		class="h-[80px] w-[80px] border-none bg-transparent"
		radius={160}
		duration={20}
        theta={240}
		>
		<enhanced:img src="/static/bitcoin_lightning.png" alt="bitcoin lightning icon" />
	</OrbitingCircles>
</div>
