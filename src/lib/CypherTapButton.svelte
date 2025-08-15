<svelte:options customElement="cyphertap-button" />

<script lang="ts">
  import "@awesome.me/webawesome/dist/styles/webawesome.css";
  import "@awesome.me/webawesome/dist/components/button/button.js";
  let count: number = $state(0);
  const increment = () => {
    count += 1;
  };
</script>

<wa-button variant="neutral" onclick={increment}>
  Cyphertap: updated 0.0.5 {count}
</wa-button>
