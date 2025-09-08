<script lang="ts">
    import { cn } from "$lib/utils.js";
    let className: any = "";
    export { className as class };
    export let cw: boolean = true; // clock-wise orbit
    export let duration: number = 20;
    export let theta: number = 0; //0-360 degrees
    export let radius: number = 50;
    export let path: boolean = true;
  </script>
  
  {#if path}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      class="pointer-events-none absolute inset-0 h-full w-full"
    >
      <circle
        class="stroke-black/10 stroke-1 dark:stroke-white/10"
        cx="50%"
        cy="50%"
        r={radius}
        fill="none"
        stroke-dasharray="4 4"
      />
    </svg>
    <div
      style:--theta={`${theta}deg`}
      style:--duration={duration}
      style:--radius={radius}
      class={cn(
        `absolute flex h-full w-full transform-gpu  items-center justify-center rounded-full border bg-black/10 dark:bg-white/10 ${cw ? 'animate-orbit-cw': 'animate-orbit-ccw'}`,
        className
      )}
    >
      <slot></slot>
    </div>
  {/if}
  