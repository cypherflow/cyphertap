// // src/lib/api/cyphertap-reactive.svelte.ts
// import { cyphertap } from './cyphertap-api.svelte.js';
// import { currentUser, ndkInstance } from '$lib/stores/nostr.js';
// import { walletBalance } from '$lib/stores/wallet.js';

// export function createReactiveCyphertap() {
//   // Convert only the safe stores to reactive state
//   let balance = $state(walletBalance);
//   let user = $state(currentUser);
//   let ndk = $state(ndkInstance);

//   // Update state when stores change
//   $effect(() => {
//     balance = $walletBalance;
//   });

//   $effect(() => {
//     user = $currentUser;
//   });

//   $effect(() => {
//     ndk = $ndkInstance;
//   });

//   // Derived reactive state
//   const isLoggedIn = $derived(Boolean(user && ndk));
//   const isReady = $derived(cyphertap.isReady);
//   const npub = $derived(user?.npub || null);

//   return {
//     // Safe reactive state only
//     get isLoggedIn() { return isLoggedIn; },
//     get isReady() { return isReady; },
//     get balance() { return balance; },
//     get npub() { return npub; },
    
//     // API methods (all the async functions)
//     getUserNpub: cyphertap.getUserNpub.bind(cyphertap),
//     getUserHex: cyphertap.getUserHex.bind(cyphertap),
//     createLightningInvoice: cyphertap.createLightningInvoice.bind(cyphertap),
//     sendLightningPayment: cyphertap.sendLightningPayment.bind(cyphertap),
//     generateEcashToken: cyphertap.generateEcashToken.bind(cyphertap),
//     receiveEcashToken: cyphertap.receiveEcashToken.bind(cyphertap),
//     publishTextNote: cyphertap.publishTextNote.bind(cyphertap),
//     publishEvent: cyphertap.publishEvent.bind(cyphertap),
//     subscribe: cyphertap.subscribe.bind(cyphertap),
//     signEvent: cyphertap.signEvent.bind(cyphertap),
//     encrypt: cyphertap.encrypt.bind(cyphertap),
//     decrypt: cyphertap.decrypt.bind(cyphertap),
//     getConnectionStatus: cyphertap.getConnectionStatus.bind(cyphertap),
//     getMints: cyphertap.getMints.bind(cyphertap),
//     getMainMint: cyphertap.getMainMint.bind(cyphertap),
//     getMintInfo: cyphertap.getMintInfo.bind(cyphertap),
//     subscribeToBalance: cyphertap.subscribeToBalance.bind(cyphertap),
//     subscribeToUser: cyphertap.subscribeToUser.bind(cyphertap),
//     subscribeToLoginStatus: cyphertap.subscribeToLoginStatus.bind(cyphertap)
//   };
// }