<svelte:options customElement="cyphertap-button" />

<script lang="ts">
  import "@awesome.me/webawesome/dist/styles/webawesome.css";
  import "@awesome.me/webawesome/dist/components/button/button.js";
  import "@awesome.me/webawesome/dist/components/popover/popover.js";
  let count: number = $state(0);
  const increment = () => {
    count += 1;
  };
</script>

<wa-button variant="neutral" onclick={increment} id="popover__anchor-button">
  Cyphertap
</wa-button>

<wa-popover for="popover__anchor-button" placement="bottom">
  I'm anchored to a Web Awesome button.
</wa-popover>
