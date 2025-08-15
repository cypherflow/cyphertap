<svelte:options customElement="cyphertap-button" />

<script lang="ts">
  import "@awesome.me/webawesome/dist/styles/webawesome.css";
  import "@awesome.me/webawesome/dist/components/button/button.js";
  import "@awesome.me/webawesome/dist/components/popover/popover.js";

  interface Props {
    type?: "button" | "floating";
  }

  let { type = "button" }: Props = $props();

  let isDragging = $state(false);
  let floatingButton: HTMLElement;
  let currentPosition = $state({ x: window.innerWidth - 120, y: 50 }); // Simple top-right position
  let dragOffset = { x: 0, y: 0 };

  // Mouse events
  const handleMouseDown = (e: MouseEvent) => {
    if (type !== "floating") return;

    isDragging = true;

    dragOffset = {
      x: e.clientX - currentPosition.x,
      y: e.clientY - currentPosition.y,
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    currentPosition = {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    };
  };

  const handleMouseUp = () => {
    if (!isDragging) return;

    isDragging = false;
    snapToSide();

    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const snapToSide = () => {
    const buttonWidth = 60;
    const padding = 20;

    // Check which side is closer
    const centerX = currentPosition.x + buttonWidth / 2;
    const snapLeft = centerX < window.innerWidth / 2;

    const newX = snapLeft ? padding : window.innerWidth - buttonWidth - padding;
    const newY = Math.max(
      20,
      Math.min(currentPosition.y, window.innerHeight - 80),
    );

    currentPosition = { x: newX, y: newY };
  };
</script>

{#if type === "button"}
  <wa-button variant="neutral" id="cyphertap-button">
    <slot name="start"><wa-icon name="stroopwafel"></wa-icon></slot>
    <slot name="trigger">CypherTap</slot>
  </wa-button>

  <!-- <wa-popover for="cyphertap-button" placement="bottom"> -->
  <!--   Default content -->
  <!-- </wa-popover> -->
{:else if type === "floating"}
  <wa-button
    pill
    variant="neutral"
    size="large"
    onmousedown={handleMouseDown}
    id="cyphertap-floating-button"
    style="position: fixed; left: {currentPosition.x}px; top: {currentPosition.y}px; z-index: 9999; width: 120px; height: 60px; border-radius: 50%;"
    bind:this={floatingButton}
  >
    <div style="font-size: 32px"></div>
    <wa-icon name="stroopwafel"></wa-icon>
  </wa-button>
{/if}
<wa-popover
  for={type === "button" ? "cyphertap-button" : "cyphertap-floating-button"}
  placement="bottom"
>
  <slot name="content">
    <div style="padding: 10px;">
      <p>CypherTap is a tool to help you with your coding tasks.</p>
      <p>Click the button to start using it!</p>
    </div>
  </slot>
</wa-popover>
