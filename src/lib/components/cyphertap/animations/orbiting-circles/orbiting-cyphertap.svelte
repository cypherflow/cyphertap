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
		><svg
			viewBox="0 0 944.88189 944.88185"
			shape-rendering="geometricPrecision"
			text-rendering="geometricPrecision"
			image-rendering="optimizeQuality"
			fill-rule="evenodd"
			clip-rule="evenodd"
			version="1.1"
			id="svg2"
			sodipodi:docname="Bitcoin-icon-Lightning Network-Inkscape.svg"
			inkscape:version="1.3.2 (091e20e, 2023-11-25, custom)"
			xml:space="preserve"
			width="250mm"
			height="250mm"
			inkscape:export-filename="Bitcoin icon Lightning Network.pdf"
			inkscape:export-xdpi="26.0096"
			inkscape:export-ydpi="26.0096"
			xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
			xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
			xmlns="http://www.w3.org/2000/svg"
			xmlns:svg="http://www.w3.org/2000/svg"
			><defs id="defs2" /><sodipodi:namedview
				id="namedview2"
				pagecolor="#ffffff"
				bordercolor="#000000"
				borderopacity="0.25"
				inkscape:showpageshadow="2"
				inkscape:pageopacity="0.0"
				inkscape:pagecheckerboard="0"
				inkscape:deskcolor="#d1d1d1"
				inkscape:zoom="0.59326259"
				inkscape:cx="165.18823"
				inkscape:cy="558.77449"
				inkscape:window-width="1920"
				inkscape:window-height="1017"
				inkscape:window-x="1912"
				inkscape:window-y="-8"
				inkscape:window-maximized="1"
				inkscape:current-layer="svg2"
				inkscape:document-units="mm"
			/><g
				inkscape:groupmode="layer"
				id="layer1"
				inkscape:label="icon Lightning"
				style="display:inline"
				><g
					transform="matrix(8.5727987,0,0,8.2276115,-2760.2653,-3003.3283)"
					id="bitcoin and bolt"
					style="display:inline;opacity:1"
					><path
						d="m 396.52772,450.42357 c -1.115,-0.645 4.436,-8.302 10.161,-16.575 5.722,-8.275 9.591,-14.534 10.796,-16.386 1.205,-1.852 1.31693,-1.64491 0.66447,-4.65085 -4.0095,-18.47207 -22.7294,-37.82779 -48.31055,-32.9575 -25.5072,4.43281 -39.97419,32.69528 -32.4151,55.87864 9.20154,28.22067 37.51935,35.73348 55.80214,27.513 10.66445,-5.11841 12.81872,-10.84521 12.545,-11.04629 -0.426,-0.322 -5.819,0.204 -9.243,-1.776 z"
						fill="#f7931a"
						id="path5"
						sodipodi:nodetypes="ccsscscccc"><title id="ball">B ball Zapped</title></path
					><path
						d="m 417.763,421.42 c 0,0 1.69628,-2.94654 1.411,1.197 -0.144,1.023 -4.077,18.911 -4.077,18.911 0,0.005 7.622,0.484 7.622,0.484 1.382,-0.014 0.712,1.04 0.712,1.04 l -20.327,27.405 c -2.923,4.144 -1.539,-0.727 -1.5,-1.439 3.555,-10.656 5.681,-16.693 6.384,-18.095 0,0 -8.98,-1.189 -8.93,-1.947 v -0.136 c 0.029,-0.35 2.306,-3.702 6.847,-10.048 6.854,-9.972 0.016,0.028 11.858,-17.372 z"
						style="fill:#ffba00;fill-opacity:1"
						id="path6"
						sodipodi:nodetypes="cccccccccccc"><title id="bolt">Lightning bolt</title></path
					><path
						fill="white"
						fill-rule="nonzero"
						d="m 2947.77,1754.38 c 40.72,-272.26 -166.56,-418.61 -450,-516.24 l 91.95,-368.8 -224.5,-55.94 -89.51,359.09 c -59.02,-14.72 -119.63,-28.59 -179.87,-42.34 l 90.16,-361.46 -224.36,-55.94 -92,368.68 c -48.84,-11.12 -96.81,-22.11 -143.35,-33.69 l 0.26,-1.16 -309.59,-77.31 -59.72,239.78 c 0,0 166.56,38.18 163.05,40.53 90.91,22.69 107.35,82.87 104.62,130.57 l -251.94,1010.34 c -11.11,27.62 -39.31,69.07 -102.87,53.33 2.25,3.26 -163.17,-40.72 -163.17,-40.72 l -111.46,256.98 292.15,72.83 c 54.35,13.63 107.61,27.89 160.06,41.3 l -92.9,373.03 224.24,55.94 92,-369.07 c 61.26,16.63 120.71,31.97 178.91,46.43 l -91.69,367.33 224.51,55.94 92.89,-372.33 c 382.82,72.45 670.67,43.24 791.83,-303.02 97.63,-278.78 -4.86,-439.58 -206.26,-544.44 146.69,-33.83 257.18,-130.31 286.64,-329.61 l -0.07,-0.05 z m -512.93,719.26 c -69.38,278.78 -538.76,128.08 -690.94,90.29 l 123.28,-494.2 c 152.17,37.99 640.17,113.17 567.67,403.91 z m 69.43,-723.3 c -63.29,253.58 -453.96,124.75 -580.69,93.16 l 111.77,-448.21 c 126.73,31.59 534.85,90.55 468.94,355.05 z"
						id="path2"
						style="display:inline;opacity:1;fill:#ffffff;fill-opacity:1"
						transform="matrix(0.02399203,0,0,0.02482302,328.14558,372.00896)"
					/></g
				><rect
					style="display:none;fill:#ff0000;fill-opacity:0;stroke:#ff0000;stroke-width:0.140244"
					id="rect2"
					width="1.6855859"
					height="983.15735"
					x="471.59814"
					y="9.9150181"
					inkscape:label="AIm Horizontal"
				/><rect
					style="display:none;fill:#ff0000;fill-opacity:0;stroke:#ff0000;stroke-width:0.209818"
					id="rect1"
					width="990.91046"
					height="3.7432735"
					x="2.9973774"
					y="470.56931"
					inkscape:label="Aim Vertical"
				/><circle
					style="display:none;opacity:0.634921;fill:#fafafa;stroke:#ff0000"
					id="path1"
					cx="472.44095"
					cy="472.44095"
					inkscape:label="Aim Ball"
					r="395.70917"
				/></g
			></svg
		>
	</OrbitingCircles>
</div>
