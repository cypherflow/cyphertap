<svelte:options customElement="cyphertap-button" />

<!-- <svelte:head> -->
<!-- <link rel="stylesheet" href="https://early.webawesome.com/webawesome@3.0.0-beta.4/dist/styles/themes/default.css" /> -->
<!-- </svelte:head> -->

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
