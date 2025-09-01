<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { Cyphertap, cyphertap } from '$lib/index.js';
  import { toast } from 'svelte-sonner';

  // Demo state
  let results = $state({
    npub: '',
    invoice: '',
    token: '',
    signedEvent: '',
    encryptedMessage: '',
    decryptedMessage: '',
    connectionStatus: '',
    userHex: '',
    mints: [] as string[],
    publishedEventId: ''
  });

  let inputs = $state({
    invoiceAmount: '1',
    tokenAmount: '1',
    textNote: 'Hello Nostr from CypherTap!',
    messageToEncrypt: 'Secret message',
    recipientPubkey: '',
    encryptedToDecrypt: '',
    senderPubkey: '',
    bolt11ToPay: ''
  });

  // Helper function to handle async operations with error handling
  async function handleAsync(operation: () => Promise<void>, errorMessage: string) {
    try {
      await operation();
    } catch (error) {
      console.error(errorMessage, error);
      toast.error(`${errorMessage}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // User info functions
  function getNpub() {
    const npub = cyphertap.getUserNpub();
    results.npub = npub || 'Not available';
    toast.success('NPub retrieved!');
  }

  function getUserHex() {
    const hex = cyphertap.getUserHex();
    results.userHex = hex || 'Not available';
    toast.success('User hex retrieved!');
  }

  function getConnectionStatus() {
    const status = cyphertap.getConnectionStatus();
    results.connectionStatus = `${status.connected}/${status.total} relays connected`;
    toast.success('Connection status retrieved!');
  }

  function getMints() {
    const mints = cyphertap.getMints();
    results.mints = mints;
    toast.success(`Retrieved ${mints.length} mints`);
  }

  // Lightning functions
  async function generateInvoice() {
    await handleAsync(async () => {
      const amount = parseInt(inputs.invoiceAmount);
      const result = await cyphertap.createLightningInvoice(amount, `${amount} sat invoice from CypherTap demo`);
      results.invoice = result.bolt11;
      toast.success(`${amount} sat invoice generated!`);
    }, 'Failed to generate invoice');
  }

  async function payInvoice() {
    await handleAsync(async () => {
      if (!inputs.bolt11ToPay.trim()) {
        toast.error('Please enter a BOLT11 invoice');
        return;
      }
      const result = await cyphertap.sendLightningPayment(inputs.bolt11ToPay);
      if (result.success) {
        toast.success('Payment sent successfully!');
        inputs.bolt11ToPay = '';
      }
    }, 'Failed to send payment');
  }

  // Ecash functions
  async function generateToken() {
    await handleAsync(async () => {
      const amount = parseInt(inputs.tokenAmount);
      const result = await cyphertap.generateEcashToken(amount, `${amount} sat token from CypherTap demo`);
      results.token = result.token;
      toast.success(`${amount} sat ecash token generated!`);
    }, 'Failed to generate token');
  }

  // Nostr functions
  async function publishNote() {
    await handleAsync(async () => {
      if (!inputs.textNote.trim()) {
        toast.error('Please enter some text');
        return;
      }
      const event = await cyphertap.publishTextNote(inputs.textNote);
      results.publishedEventId = event.id;
      toast.success('Note published to Nostr!');
    }, 'Failed to publish note');
  }

  async function signEvent() {
    await handleAsync(async () => {
      const event = await cyphertap.signEvent({
        kind: 1,
        content: 'This is a signed event from CypherTap demo'
      });
      results.signedEvent = JSON.stringify({
        id: event.id,
        pubkey: event.pubkey,
        signature: event.signature.substring(0, 20) + '...'
      }, null, 2);
      toast.success('Event signed!');
    }, 'Failed to sign event');
  }

  // Encryption functions
  async function encryptMessage() {
    await handleAsync(async () => {
      if (!inputs.messageToEncrypt.trim() || !inputs.recipientPubkey.trim()) {
        toast.error('Please enter message and recipient pubkey');
        return;
      }
      
      let recipientHex = inputs.recipientPubkey;
      if (recipientHex.startsWith('npub')) {
        toast.error('Please use hex pubkey (not npub) for now');
        return;
      }

      const encrypted = await cyphertap.encrypt(inputs.messageToEncrypt, recipientHex);
      results.encryptedMessage = encrypted;
      toast.success('Message encrypted!');
    }, 'Failed to encrypt message');
  }

  async function decryptMessage() {
    await handleAsync(async () => {
      if (!inputs.encryptedToDecrypt.trim() || !inputs.senderPubkey.trim()) {
        toast.error('Please enter encrypted content and sender pubkey');
        return;
      }

      const decrypted = await cyphertap.decrypt(inputs.encryptedToDecrypt, inputs.senderPubkey);
      results.decryptedMessage = decrypted;
      toast.success('Message decrypted!');
    }, 'Failed to decrypt message');
  }

  // Helper to copy text to clipboard
  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  }

  // Debug logging to see reactive changes
  $effect(() => {
    console.log('🔄 Reactive state changed:', {
      isLoggedIn: cyphertap.isLoggedIn,
      isReady: cyphertap.isReady,
      balance: cyphertap.balance,
      npub: cyphertap.npub
    });
  });
</script>

<div class="container mx-auto max-w-4xl p-6">
  <header class="mb-8 text-center">
    <h1 class="mb-4 text-4xl font-bold">CypherTap Component Library</h1>
    <p class="text-lg text-muted-foreground">
      Nostr, Lightning and Ecash in a single button component
    </p>
  </header>

  <!-- Component Demo -->
  <div class="mb-8 rounded-lg border p-6">
    <h2 class="mb-4 text-2xl font-semibold">Component</h2>
    <div class="flex flex-col items-center gap-4">
      <Cyphertap />
      <div class="text-center text-sm text-muted-foreground">
        {#if cyphertap.isReady}
          <p>✅ Ready - Balance: {cyphertap.balance} sats</p>
          <p class="text-xs">Logged in as: {cyphertap.npub?.slice(0, 12)}...</p>
        {:else if cyphertap.isLoggedIn}
          <p>🔄 Logged in, initializing wallet...</p>
        {:else}
          <p>⏳ Click the button above to get started</p>
        {/if}
      </div>
    </div>
  </div>

  <!-- Debug info to help troubleshoot -->
  <div class="mb-4 rounded bg-gray-100 p-3 text-xs">
    <strong>Debug Info:</strong>
    isLoggedIn: {cyphertap.isLoggedIn},
    isReady: {cyphertap.isReady},
    balance: {cyphertap.balance},
    npub: {cyphertap.npub || 'null'}
  </div>

  {#if cyphertap.isReady}
    <!-- API Demo -->
    <div class="grid gap-6 md:grid-cols-2">
      
      <!-- User Info -->
      <div class="rounded-lg border p-6">
        <h3 class="mb-4 text-xl font-semibold">User Information</h3>
        <div class="space-y-3">
          <button class="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600" onclick={getNpub}>
            Get NPub
          </button>
          {#if results.npub}
            <div class="rounded bg-gray-100 p-2">
              <p class="text-xs font-mono break-all">{results.npub}</p>
              <button class="mt-1 text-xs text-blue-500" onclick={() => copyToClipboard(results.npub, 'NPub')}>
                Copy
              </button>
            </div>
          {/if}

          <button class="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600" onclick={getUserHex}>
            Get User Hex
          </button>
          {#if results.userHex}
            <div class="rounded bg-gray-100 p-2">
              <p class="text-xs font-mono break-all">{results.userHex}</p>
              <button class="mt-1 text-xs text-blue-500" onclick={() => copyToClipboard(results.userHex, 'Hex')}>
                Copy
              </button>
            </div>
          {/if}

          <button class="w-full rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600" onclick={getConnectionStatus}>
            Get Connection Status
          </button>
          {#if results.connectionStatus}
            <p class="text-sm">{results.connectionStatus}</p>
          {/if}

          <button class="w-full rounded bg-purple-500 px-4 py-2 text-white hover:bg-purple-600" onclick={getMints}>
            Get Mints
          </button>
          {#if results.mints.length > 0}
            <div class="space-y-1">
              {#each results.mints as mint, i}
                <p class="text-xs font-mono break-all">{i + 1}. {mint}</p>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Lightning -->
      <div class="rounded-lg border p-6">
        <h3 class="mb-4 text-xl font-semibold">Lightning</h3>
        <div class="space-y-3">
          <div class="flex gap-2">
            <input 
              type="number" 
              bind:value={inputs.invoiceAmount} 
              class="flex-1 rounded border px-2 py-1" 
              placeholder="Amount in sats"
            />
            <button class="rounded bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600" onclick={generateInvoice}>
              Generate Invoice
            </button>
          </div>
          {#if results.invoice}
            <div class="rounded bg-gray-100 p-2">
              <p class="text-xs font-mono break-all">{results.invoice}</p>
              <button class="mt-1 text-xs text-blue-500" onclick={() => copyToClipboard(results.invoice, 'Invoice')}>
                Copy Invoice
              </button>
            </div>
          {/if}

          <div class="border-t pt-3">
            <input 
              type="text" 
              bind:value={inputs.bolt11ToPay} 
              class="w-full rounded border px-2 py-1 mb-2" 
              placeholder="Paste BOLT11 invoice to pay"
            />
            <button class="w-full rounded bg-orange-500 px-4 py-2 text-white hover:bg-orange-600" onclick={payInvoice}>
              Pay Invoice
            </button>
          </div>
        </div>
      </div>

      <!-- Ecash -->
      <div class="rounded-lg border p-6">
        <h3 class="mb-4 text-xl font-semibold">Ecash</h3>
        <div class="space-y-3">
          <div class="flex gap-2">
            <input 
              type="number" 
              bind:value={inputs.tokenAmount} 
              class="flex-1 rounded border px-2 py-1" 
              placeholder="Amount in sats"
            />
            <button class="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600" onclick={generateToken}>
              Generate Token
            </button>
          </div>
          {#if results.token}
            <div class="rounded bg-gray-100 p-2">
              <p class="text-xs font-mono break-all">{results.token}</p>
              <button class="mt-1 text-xs text-blue-500" onclick={() => copyToClipboard(results.token, 'Token')}>
                Copy Token
              </button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Nostr -->
      <div class="rounded-lg border p-6">
        <h3 class="mb-4 text-xl font-semibold">Nostr</h3>
        <div class="space-y-3">
          <div>
            <input 
              type="text" 
              bind:value={inputs.textNote} 
              class="w-full rounded border px-2 py-1 mb-2" 
              placeholder="Text to publish"
            />
            <button class="w-full rounded bg-purple-500 px-4 py-2 text-white hover:bg-purple-600" onclick={publishNote}>
              Publish Note
            </button>
          </div>

          <button class="w-full rounded bg-indigo-500 px-4 py-2 text-white hover:bg-indigo-600" onclick={signEvent}>
            Sign Demo Event
          </button>
          {#if results.signedEvent}
            <div class="rounded bg-gray-100 p-2">
              <pre class="text-xs">{results.signedEvent}</pre>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Real-time Status -->
    <div class="mt-6 rounded-lg border p-4 bg-gray-50">
      <h3 class="mb-2 text-lg font-semibold">Real-time Status</h3>
      <div class="grid gap-2 text-sm md:grid-cols-3">
        <p><strong>Balance:</strong> {cyphertap.balance} sats</p>
        <p><strong>Logged In:</strong> {cyphertap.isLoggedIn ? '✅' : '❌'}</p>
        <p><strong>Ready:</strong> {cyphertap.isReady ? '✅' : '❌'}</p>
      </div>
      <div class="mt-2 text-xs text-muted-foreground">
        <p><strong>NPub:</strong> {cyphertap.npub || 'Not available'}</p>
      </div>
    </div>

  {:else}
    <!-- Login Required -->
    <div class="rounded-lg border p-8 text-center">
      <h3 class="mb-4 text-xl font-semibold">
        {cyphertap.isLoggedIn ? 'Initializing Wallet...' : 'Login Required'}
      </h3>
      <p class="text-muted-foreground">
        {cyphertap.isLoggedIn 
          ? 'Please wait while we set up your wallet...'
          : 'Please click the CypherTap button above to login and access the API features.'
        }
      </p>
    </div>
  {/if}
</div>