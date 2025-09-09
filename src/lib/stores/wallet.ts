
// src/lib/client/stores/wallet.ts
import { writable, get, derived } from 'svelte/store';
import {
  consolidateMintTokens,
  type NDKCashuDeposit,
  NDKCashuWallet,
  type MintUrl
} from '@nostr-dev-kit/ndk-wallet';
import { NDKCashuMintList, NDKRelay } from '@nostr-dev-kit/ndk';
import {
  NDKRelaySet,
  NDKSubscriptionCacheUsage,
  NDKCashuWalletTx,
  NDKKind,
  NDKEvent,
  type LnPaymentInfo,
  type NDKSubscription
} from '@nostr-dev-kit/ndk';
import { getEncodedTokenV4 } from '@cashu/cashu-ts';
import { getNDK, ndkInstance } from './nostr.js';
import { validateMint } from '../utils/validateMint.js';
import { createDebug } from '$lib/utils/debug.js';

// Create a debug logger for the wallet module
const d = createDebug('wallet');
const debug = createDebug('wallet')
// Create specific loggers for sub-components
const dTx = d.extend('tx');
const dMint = d.extend('mint');
const dToken = d.extend('token');

// Wallet state
export const wallet = writable<NDKCashuWallet | undefined>(undefined);
export const walletBalance = writable<number>(0);
export const walletTransactions = writable<NDKCashuWalletTx[]>([]);
export const isWalletReady = writable<boolean>(false);
export const isInitializingWallet = writable<boolean>(false);
export const isLoadingTransactions = writable<boolean>(false);

export const DEFAULT_MINTS = ['https://mint.cypherflow.ai'];
export const REQUIRED_DEPOSIT_AMOUNT = 1; // in sats

// Keep track of transaction IDs to avoid duplicates
let knownTransactionIds = new Set<string>();
let txSubscription: NDKSubscription | null = null;
// Initialize wallet for the current user
export async function initWallet(isNewUser: boolean = false) {
  const d = debug.extend('initWallet')
  const dEvent = debug.extend('event');
  let ndk = getNDK();

  d.log('Starting NIP-60 wallet...');
  isInitializingWallet.set(true);
  let userWallet: NDKCashuWallet | undefined;
  const poolRelaySet = new NDKRelaySet(
    new Set(ndk.pool.relays.values()), 
    ndk
  )
  // const explicitRelaySet = NDKRelaySet.fromRelayUrls(ndk.explicitRelayUrls, ndk)
  try {
    if (isNewUser){
      // For new quick start users, set up wallet with default mints
      userWallet = await setupCashuWallet(DEFAULT_MINTS, poolRelaySet);
    } else {
      // For everyone else, check if they already have a nip-60 wallet
      userWallet = await findExistingWallet(poolRelaySet);
      if (userWallet){
        d.log("Found existing NIP-60 wallet")
      } else {
        userWallet = await setupCashuWallet(DEFAULT_MINTS, poolRelaySet);
      }
    }

    wallet.set(userWallet);
    // Update balance store when wallet reports balance changes
    userWallet.on('balance_updated', () => {
      const balance = userWallet?.balance;
      dEvent.log('Balance updated:', balance);
      walletBalance.set(balance?.amount || 0);
    });

    // Listen for wallet warnings
    userWallet.on('warning', (warning) => {
      dEvent.warn('Client wallet warning:', warning.msg);
    });

    // Setup mint-related event handlers
    userWallet.onMintInfoNeeded = async (mint: string) => {
      dMint.log(`Fetching info for mint: ${mint}`);
      try {
        // You can implement custom mint info fetching here if needed
        return undefined; // Let the default behavior handle it
      } catch (error) {
        dMint.error(`Error fetching mint info for ${mint}:`, error);
        return undefined;
      }
    };

    userWallet.onMintInfoLoaded = (mint: string, info: any) => {
      dMint.log(
        `Successfully loaded mint info for ${mint}:`,
        info.version || "Unknown version"
      );
    };

    userWallet.onMintKeysNeeded = async (mint: string) => {
      dMint.log(`Fetching keys for mint: ${mint}`);
      try {
        return undefined; // Default behavior
      } catch (error) {
        dMint.error(`Error fetching mint keys for ${mint}:`, error);
        return undefined;
      }
    };

    userWallet.onMintKeysLoaded = (mint: string, keysets: any) => {
      dMint.log(
        `Successfully loaded mint keys for ${mint}, ${keysets.size} keysets loaded`
      );
    };

    // Listen for wallet events
    userWallet.on('ready', async () => {
      // check if tokens are avalid after getting them from relays
      d.log('Consolidating tokens...');

      await consolidateTokens();
      d.log('✅ Wallet is ready');
      isWalletReady.set(true);
      const balance = userWallet?.balance;
      d.log('Initialized balance:', balance);
      walletBalance.set(balance?.amount || 0);

      // Pre-load wallet connections to each mint
      if (userWallet && userWallet.mints) {
        for (const mint of userWallet.mints) {
          try {
            dMint.log(`Testing connection to mint: ${mint}`);
            await userWallet.getCashuWallet(mint);
            dMint.log(`✅ Successfully connected to mint: ${mint}`);
          } catch (error) {
            dMint.warn(`Warning: Could not connect to mint ${mint}:`, error);
            // We don't fail here, just log the warning
          }
        }
      }

      // Load transaction history when wallet is ready
      d.log('Loading transaction history...');
      await loadTransactionHistory();
      // Start listening for new transactions
      d.log('Setting up transaction subscription...');
      setupTransactionSubscription();
    });

    // Start monitoring the wallet
    d.log('Starting wallet monitoring...');
    userWallet?.start({
      cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY
    });
    d.log('✅ Wallet initialization complete');
    return userWallet;
  } catch (error) {
    d.error('❌ Failed to initialize wallet:', error);
    throw error;
  } finally {
    isInitializingWallet.set(false);
  }
}

async function findExistingWallet(relaySet?: NDKRelaySet): Promise<NDKCashuWallet | undefined> {
  const d = debug.extend('findExistingWallet')
  d.log('Looking for existing wallet...');
  const ndk = getNDK();
  const activeUser = ndk.activeUser;

  if (!activeUser) {
    d.error('No active user found, cannot find wallet');
    throw 'we need a user first, set a signer in ndk';
  }

  // check relays directly
  d.log("using ndk pool set: ", relaySet)

  d.log(`Fetching wallet events for user ${activeUser.pubkey.slice(0, 8)}...`);
  let event = await ndk.fetchEvent(
    { kinds: [NDKKind.CashuWallet], authors: [activeUser.pubkey] },
    { cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY, subId: 'wallet-sub' },
    relaySet
  );

  if (event) {
    d.log("Found existing wallet in relays");
    return await NDKCashuWallet.from(event);
  }

  d.log("No existing wallet found");
  return undefined;
}

async function setupCashuWallet(mints: string[], relaySet: NDKRelaySet) {
  const d = debug.extend('setupCashuWallet');
  d.log(`Setting up new Cashu wallet with mints: ${mints.join(', ')}`);
  const ndk = getNDK();
  // Create the Cashu wallet instance
  const wallet = new NDKCashuWallet(ndk);

  // Add mints to the wallet
  wallet.mints = mints;
  d.log("Using relaySet: ", relaySet);
  wallet.relaySet = relaySet;

  // Generate or load a p2pk (Pay-to-Public-Key) token
  // This is used for receiving payments with NIP-61 (nutzaps)
  d.log('Generating p2pk token...');
  await wallet.getP2pk();
  d.log(`Wallet p2pk generated`);

  d.log('Publishing wallet event...');
  await wallet.publish();
  d.log('✅ Published wallet event');

  // configure reception of NIP-61 nutzaps for the user
  // this publishes an event that tells others who want to zap
  // this user the information they need to publish a NIP-61 nutzap.
  d.log('Configuring nutzap reception...');
  const mintlistForNutzapReception = new NDKCashuMintList(ndk);
  mintlistForNutzapReception.relays = wallet.relaySet.relayUrls;
  mintlistForNutzapReception.mints = wallet.mints;
  mintlistForNutzapReception.p2pk = wallet.p2pk;
  await mintlistForNutzapReception.publish();
  d.log('✅ Published nutzap mintlist event');

  return wallet;
}

// Format transaction for display
export function formatTransaction(tx: NDKCashuWalletTx) {
  return {
    id: tx.id,
    amount: tx.amount ? Number(tx.amount) : 0,
    direction: tx.direction || 'unknown',
    timestamp: tx.created_at || 0,
    date: tx.created_at ? new Date(tx.created_at * 1000) : new Date(),
    description: tx.description || 'No description',
    fee: tx.fee ? Number(tx.fee) : 0,
    mint: tx.mint || 'Unknown',
    hasNutzapRedemption: tx.hasNutzapRedemption || false,
    event: tx
  };
}

// Set up subscription for new transaction events
function setupTransactionSubscription() {
  // Clean up any existing subscription
  if (txSubscription) {
    dTx.log('Stopping existing transaction subscription');
    txSubscription.stop();
    txSubscription = null;
  }

  const ndk = getNDK();

  const activeUser = ndk.activeUser;
  if (!activeUser) {
    dTx.error('Cannot set up transaction subscription: no active user');
    return;
  }

  dTx.log("Setting up transaction subscription");
  txSubscription = ndk.subscribe(
    {
      kinds: [NDKKind.CashuWalletTx],
      authors: [activeUser.pubkey],
      since: Math.floor(Date.now() / 1000) - 5 * 60 // Last 5 minutes to avoid missing recent transactions
    },
    {
      closeOnEose: false,
      subId: 'txs-sub'
    }
  );

  txSubscription.on('event', async (event: NDKEvent) => {
    // Skip if there is no IDs
    if (!event.id) {
      dTx.warn('Received transaction event with no ID, skipping');
      return;
    }

    // Skip if we already know about this transaction
    if (knownTransactionIds.has(event.id)) {
      dTx.log(`Skipping already known transaction: ${event.id.slice(0, 8)}`);
      return;
    }

    try {
      dTx.log(`Processing new transaction event: ${event.id.slice(0, 8)}`);
      const tx = await NDKCashuWalletTx.from(event);
      if (tx && tx.id) {
        // Add to known transactions
        knownTransactionIds.add(event.id);

        // Update the transactions list
        walletTransactions.update((txs) => {
          // Dont add if we already have this tx by id
          if (txs.some((t) => t.id === tx.id)) {
            dTx.log(`Transaction ${tx.id?.slice(0, 8)} already in list, not adding`);
            return txs;
          }
          // Insert at beginning for newest first
          dTx.log(`Added new transaction to list: ${tx.id?.slice(0, 8)}`);
          return [tx, ...txs];
        });
      }
    } catch (error) {
      dTx.error('Error parsing new transaction:', error);
    }
  });

  dTx.log('✅ Transaction subscription set up successfully');
}

// Load transaction history
export async function loadTransactionHistory() {
  const ndk = getNDK();
  const activeUser = ndk.activeUser;

  if (!activeUser) {
    dTx.error('No active user, cannot load transaction history');
    throw 'we need a user first, set a signer in ndk';
  }

  try {
    isLoadingTransactions.set(true);
    dTx.log("Loading transaction history...");

    // Reset state for a clean fetch
    knownTransactionIds = new Set<string>();
    walletTransactions.set([]);

    // Fetch transaction events
    dTx.log(`Fetching transaction events for user ${activeUser.pubkey.slice(0, 8)}`);
    const txEvents = await ndk.fetchEvents({
      kinds: [NDKKind.CashuWalletTx],
      authors: [activeUser.pubkey],
      // You might want to limit this to recent transactions initially
      limit: 50
    });

    dTx.log(`Found ${txEvents.size} transaction events`);

    // Process and convert events to NDKCashuWalletTx objects
    const txs: NDKCashuWalletTx[] = [];

    for (const event of txEvents) {
      try {
        // Skip if there is no IDs
        if (!event.id) {
          dTx.warn('Skipping event transaction with no ID');
          continue;
        }

        // Skip if we've already processed this transaction
        if (knownTransactionIds.has(event.id)) {
          dTx.log(`Skipping duplicate transaction ID: ${event.id.slice(0, 8)}`);
          continue;
        }

        dTx.log(`Processing transaction: ${event.id.slice(0, 8)}`);
        const tx = await NDKCashuWalletTx.from(event);
        if (tx) {
          // Add to our known transaction IDs
          knownTransactionIds.add(event.id);
          txs.push(tx);
        }
      } catch (error) {
        dTx.error('Error parsing transaction:', error);
      }
    }

    // Sort transactions by created_at (newest first)
    txs.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    // Update the store
    walletTransactions.set(txs);
    dTx.log(`✅ Transaction history loaded: ${txs.length} transactions`);

    // Restart the transaction subscription with the latest timestamp
    // Only if we have a wallet ready
    if (get(isWalletReady) && getNDK()) {
      dTx.log('Restarting transaction subscription');
      setupTransactionSubscription();
    }
  } catch (error) {
    dTx.error('Failed to load transaction history:', error);
  } finally {
    isLoadingTransactions.set(false);
  }
}

// Deposit function (to create a Lightning invoice)
export async function createDeposit(
  amount: number
): Promise<{ bolt11: string; deposit: NDKCashuDeposit }> {
  d.log(`Creating deposit for ${amount} sats`);
  const currentWallet = get(wallet);
  if (!currentWallet) {
    d.error('Wallet not initialized');
    throw new Error('Wallet not initialized');
  }

  // Get the main mint from the mint store
  const currentMainMint = get(mainMint);
  if (!currentMainMint) {
    d.error('No main mint configured');
    throw new Error('No main mint configured');
  }

  // Create the deposit using the main mint
  d.log(`Using mint: ${currentMainMint}`);
  const deposit = currentWallet.deposit(amount, currentMainMint);

  // Set up deposit monitoring
  deposit.on('success', (token) => {
    d.log('✅ Deposit successful:', token);
  });

  deposit.on('error', (error) => {
    d.error('❌ Deposit failed:', error);
  });

  // Start the deposit process to get the invoice
  d.log('Starting deposit process...');
  const bolt11 = await deposit.start();
  d.log(`Generated invoice: ${bolt11.substring(0, 20)}...`);

  return {
    bolt11,
    deposit
  };
}

// Function to send sats via Lightning
export async function sendLNPayment(bolt11: string) {
  d.log(`Sending LN payment for invoice: ${bolt11.substring(0, 20)}...`);
  const currentWallet = get(wallet);
  if (!currentWallet) {
    d.error('Wallet not initialized');
    throw new Error('Wallet not initialized');
  }

  const payment: LnPaymentInfo = {
    pr: bolt11
  };

  try {
    d.log('Processing payment...');
    const result = await currentWallet.lnPay(payment, true);
    if (!result) {
      d.log(
        'Payment probably successful and sent to the same mint we are using, so there is no preimage. Also there is no tx event emitted from this operation.'
      );
    } else {
      d.log('✅ Payment successful with result', result);
    }
  } catch (error) {
    d.error('❌ Failed to pay invoice:', error);
    throw error;
  }

  return { success: true };
}

// Function to receive a token (e.g. someone shared a cashu token with you)
export async function receiveToken(token: string) {
  dToken.log(`Receiving token: ${token.substring(0, 20)}...`);
  const currentWallet = get(wallet);
  if (!currentWallet) {
    dToken.error('Wallet not initialized');
    throw new Error('Wallet not initialized');
  }

  try {
    dToken.log('Processing token...');
    const result = await currentWallet.receiveToken(token, 'Token received');
    dToken.log('✅ Token received successfully', result);

    return result;
  } catch (error) {
    dToken.error('❌ Failed to receive token:', error);
    throw error;
  }
}

// Function to generate a token (create ecash to send)
export async function generateToken(amount: number, recipientMints?: MintUrl[]) {
  dToken.log(`Generating token for ${amount} sats`);
  const currentWallet = get(wallet);
  if (!currentWallet) {
    dToken.error('Wallet not initialized');
    throw new Error('Wallet not initialized');
  }

  try {
    // Check if we have enough total balance
    const balance = currentWallet.balance;
    if (!balance || balance.amount < amount) {
      dToken.error(`Insufficient balance. Need ${amount} sats but have ${balance?.amount || 0} sats.`);
      throw new Error(
        `Insufficient balance. You need ${amount} sats but have ${balance?.amount || 0} sats.`
      );
    }

    // // Generate a unique ID for this token
    // const nanoId = generateTokenId();
    // dToken.log(`Generated token ID: ${nanoId}`);
    // const tokenDescription = `Token sent #${nanoId}`;
    const tokenDescription = `Token sent`;


    // Get available mints with sufficient balance
    const eligibleMints = currentWallet.getMintsWithBalance(amount);
    dToken.log(`Found ${eligibleMints.length} eligible mints with sufficient balance`);

    if (eligibleMints.length === 0) {
      dToken.error('No mints with sufficient balance found');
      throw new Error('No mints with sufficient balance found');
    }

    // Determine which mint to use
    let mint: string;

    // Check if recipient specified preferred mints
    if (recipientMints && recipientMints.length > 0) {
      // Find intersection between eligible mints and recipient mints
      const compatibleMints = eligibleMints.filter(m => recipientMints.includes(m));

      if (compatibleMints.length > 0) {
        // We have a compatible mint with the recipient
        dToken.log(`Found ${compatibleMints.length} compatible mints with recipient`);

        // Try to use main mint if it's in the compatible list
        const currentMainMint = get(mainMint);
        if (currentMainMint && compatibleMints.includes(currentMainMint)) {
          dToken.log(`Using main mint which is compatible: ${currentMainMint}`);
          mint = currentMainMint;
        } else {
          dToken.log(`Using first compatible mint: ${compatibleMints[0]}`);
          mint = compatibleMints[0];
        }
      } else {
        // No compatible mints, provide helpful error message
        const mintBalances = await Promise.all(recipientMints.map(async (m) => {
          const bal = currentWallet.mintBalance(m);
          return { mint: m, balance: bal || 0 };
        }));

        const balanceInfo = mintBalances
          .map(mb => `${new URL(mb.mint).hostname}: ${mb.balance} sats`)
          .join(', ');

        dToken.error(`No compatible mints with recipient. Recipient accepts: ${recipientMints.join(', ')}`);
        throw new Error(
          `You don't have enough balance in any of the recipient's preferred mints. ` +
          `Recipient accepts: ${recipientMints.map(m => new URL(m).hostname).join(', ')}. ` +
          `Your balances: ${balanceInfo}. ` +
          `Consider swapping some of your tokens to a compatible mint first.`
        );
      }
    } else {
      // No recipient mints specified, use main mint if possible
      const currentMainMint = get(mainMint);
      if (currentMainMint && eligibleMints.includes(currentMainMint)) {
        dToken.log(`Using main mint: ${currentMainMint}`);
        mint = currentMainMint;
      } else {
        dToken.log(`Main mint not eligible, using alternative: ${eligibleMints[0]}`);
        mint = eligibleMints[0];
      }
    }

    // Generate the token using NDK Cashu wallet
    const paymentInfo = {
      amount: amount,
      unit: 'sat',
      mints: [mint],
      paymentDescription: tokenDescription,
    };

    dToken.log('Generating payment...', paymentInfo);
    const paymentResult = await currentWallet.cashuPay(paymentInfo);
    dToken.log('Payment result received');

    if (!paymentResult) {
      dToken.error('Failed to generate token');
      throw new Error('Failed to generate token');
    }

    // Encode the token using the Cashu format
    const token = {
      mint: mint,
      proofs: paymentResult.proofs,
      memo: `${amount} sats from Nostr wallet`
    };

    dToken.log('Encoding token...');
    const encodedToken = getEncodedTokenV4(token);

    // // Save the token to the database
    // dToken.log('Saving token to database...');
    // await saveToken(encodedToken, amount, nanoId, tokenDescription);

    // dToken.log('✅ Token generated and saved successfully');
    return {
      encodedToken,
      mint
    };
  } catch (error) {
    dToken.error('❌ Error generating token:', error);
    throw error;
  }
}
// Clean up wallet on logout
export function clearWallet() {
  d.log('Clearing wallet...');
  const currentWallet = get(wallet);
  if (currentWallet) {
    d.log('Stopping wallet monitoring');
    currentWallet.stop(); // Stop listening for events
  }

  if (txSubscription) {
    d.log('Stopping transaction subscription');
    txSubscription.stop();
    txSubscription = null;
  }

  wallet.set(undefined);
  walletBalance.set(0);
  walletTransactions.set([]);
  isWalletReady.set(false);
  d.log('✅ Wallet cleared');
}

export async function reclaimToken(nanoId: string) {
  dToken.log(`Attempting to reclaim token with ID: ${nanoId}`);
  // const currentWallet = get(wallet);
  // if (!currentWallet) {
  //   dToken.error('Wallet not initialized');
  //   throw new Error('Wallet not initialized');
  // }
  //
  // try {
  //   // Get the token from the database
  //   dToken.log('Looking up token in database...');
  //   const sentToken = await getTokenByNanoId(nanoId);
  //   if (!sentToken) {
  //     dToken.error(`Token with ID ${nanoId} not found`);
  //     throw new Error(`Token with ID ${nanoId} not found`);
  //   }
  //
  //   if (sentToken.isReclaimed) {
  //     dToken.log('Token was already reclaimed, deleting from database...');
  //     // Token was already reclaimed, delete it from the database
  //     await deleteTokenByNanoId(nanoId);
  //     throw new Error('This token has already been reclaimed');
  //   }
  //
  //   try {
  //     // Attempt to receive the token
  //     dToken.log('Attempting to receive token...');
  //     const result = await currentWallet.receiveToken(sentToken.token, 'Token reclaimed');
  //
  //     // If successful, delete the token from the database
  //     dToken.log('✅ Token reclaimed successfully, deleting from database...');
  //     await deleteTokenByNanoId(nanoId);
  //
  //     return result;
  //   } catch (error) {
  //     // Check if the error indicates the token was already spent
  //     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  //     dToken.error('Error reclaiming token:', errorMessage);
  //
  //     if (
  //       errorMessage.includes('already spent') ||
  //       errorMessage.includes('proof not found') ||
  //       errorMessage.includes('invalid token')
  //     ) {
  //       // Token was spent elsewhere, delete it from the database
  //       dToken.log('Token was spent elsewhere, deleting from database...');
  //       await deleteTokenByNanoId(nanoId);
  //       throw new Error('This token has already been spent and cannot be reclaimed');
  //     }
  //
  //     // For other errors, just pass them through
  //     throw error;
  //   }
  // } catch (error) {
  //   dToken.error('❌ Failed to reclaim token:', error);
  //   throw error;
  // }

}

export async function canReclaimTransaction(
  description: string
): Promise<{ canReclaim: boolean; nanoId?: string }> {
  return { canReclaim: false }
  // if (!description) return { canReclaim: false };
  //
  // // Check if the description contains our nano ID format
  // const match = description.match(/Token sent #([A-Za-z0-9_-]{5})/);
  // if (!match) return { canReclaim: false };
  //
  // const nanoId = match[1];
  // dToken.log(`Found nanoId ${nanoId} in transaction description`);
  //
  // // Check if the token exists in our database
  // dToken.log('Checking if token exists in database...');
  // const token = await getTokenByNanoId(nanoId);
  //
  // // If no token found in the database, it's already been handled
  // if (!token) {
  //   dToken.log(`Token with nanoId ${nanoId} not found in database`);
  //   return { canReclaim: false };
  // }
  //
  // dToken.log(`Token with nanoId ${nanoId} found, can reclaim: ${!token.isReclaimed}`);
  // return {
  //   canReclaim: !token.isReclaimed,
  //   nanoId
  // };
}

// // Function to clean up old tokens in the database
// export async function cleanupOldTokens(olderThanDays = 30) {
//   dToken.log(`Cleaning up tokens older than ${olderThanDays} days...`);
//   try {
//     const cutoffTime = Math.floor(Date.now() / 1000) - olderThanDays * 24 * 60 * 60;
//
//     const count = await tokenDb.sentTokens.where('createdAt').below(cutoffTime).delete();
//
//     if (count > 0) dToken.log(`✅ Cleaned up ${count} old tokens from the database`);
//     else dToken.log('No old tokens to clean up');
//     return count;
//   } catch (error) {
//     dToken.error('❌ Failed to clean up old tokens:', error);
//     return 0;
//   }
// }

// Function to consolidate tokens
export async function consolidateTokens() {
  const currentWallet = get(wallet);
  if (!currentWallet) {
    d.error('Wallet not initialized');
    throw new Error('Wallet not initialized');
  }

  try {
    d.log('Starting token consolidation...');

    // Get all mints from the wallet
    const mints = new Set(
      currentWallet.state
        .getMintsProofs({
          validStates: new Set(['available', 'reserved', 'deleted'])
        })
        .keys()
    );

    d.log(`Found ${mints.size} mints to consolidate`);

    // Process each mint sequentially
    for (const mint of mints) {
      if (!mint) continue;

      // Get proofs for this mint
      const proofs = currentWallet.state.getProofs({
        mint,
        includeDeleted: true,
        onlyAvailable: false
      });

      d.log(`Consolidating ${proofs.length} proofs for mint: ${mint}`);

      // Use the per-mint consolidation function that supports callbacks
      await new Promise<void>((resolve, reject) => {
        // Using the NDKCashuWallet's consolidateMintTokens function which has callbacks
        consolidateMintTokens(
          mint,
          currentWallet,
          proofs,
          (walletChange) => {
            // Success callback
            d.log(`✅ Consolidated mint ${mint}:`, {
              stored: walletChange.store?.length || 0,
              destroyed: walletChange.destroy?.length || 0
            });
            resolve();
          },
          (error) => {
            // Error callback
            d.error(`❌ Failed to consolidate mint ${mint}:`, error);
            reject(new Error(`Failed to consolidate mint: ${error}`));
          }
        );
      });
    }

    // Refresh mint info after consolidation
    d.log('Refreshing mint info after consolidation...');
    await refreshMintInfo();
    d.log('✅ Token consolidation complete');
  } catch (error) {
    d.error('❌ Failed to consolidate tokens:', error);
    throw error;
  }
}

// MINT MANAGEMENT FUNCTIONS

export const mintInfo = derived(wallet, ($wallet) => {
  if (!$wallet) return [];

  // Get registered mints from wallet.mints (in order)
  const registeredMints = $wallet.mints;

  // Get all mints with balances from wallet.mintBalances
  // Type: Record<MintUrl, number> where MintUrl is a string
  const mintBalances: Record<string, number> = $wallet.mintBalances;

  // Create a map to track which mints we've already added
  const processedMints = new Set<string>();

  // First, add all registered mints in their original order
  const allMints = registeredMints.map((url, index) => {
    processedMints.add(url);
    return {
      url,
      balance: mintBalances[url] || 0,
      isMain: index === 0, // First mint is considered the main mint
      isRegistered: true // This is a registered mint
    };
  });

  // Now add any rogue mints (mints with balances that aren't registered)
  for (const [url, balance] of Object.entries(mintBalances)) {
    // Skip if we've already processed this mint
    if (processedMints.has(url)) continue;

    // Add the rogue mint
    allMints.push({
      url,
      balance,
      isMain: false, // Rogue mints can't be main
      isRegistered: false // This is not a registered mint
    });
  }

  return allMints;
});

// Derived store for the main mint
export const mainMint = derived(mintInfo, ($mintInfo) => {
  const main = $mintInfo.find((m) => m.isMain);
  return main?.url || null;
});

// Function to refresh mint information
export async function refreshMintInfo() {
  dMint.log('Refreshing mint information');
  const currentWallet = get(wallet);
  if (!currentWallet) return;

  // Trigger a wallet update to refresh the derived stores
  wallet.update((w) => w);
  dMint.log('✅ Mint information refreshed');
}

// Validate a mint URL before adding it
export async function validateMintUrl(url: string) {
  dMint.log(`Validating mint URL: ${url}`);
  return validateMint(url.trim());
}

// Add a mint to the wallet
export async function addMint(url: string) {
  dMint.log(`Adding mint: ${url}`);
  if (!url.trim()) {
    dMint.error('Mint URL cannot be empty');
    throw new Error('Mint URL cannot be empty');
  }

  const currentWallet = get(wallet);
  if (!currentWallet) {
    dMint.error('Wallet not initialized');
    throw new Error('Wallet not initialized');
  }

  try {
    // Don't add duplicates
    if (currentWallet.mints.includes(url.trim())) {
      dMint.warn(`Mint ${url} is already in wallet`);
      throw new Error('This mint is already in your wallet');
    }

    // Validate the mint
    dMint.log(`Validating mint ${url}...`);
    const validationResult = await validateMint(url.trim());
    if (!validationResult.isValid) {
      dMint.error(`Invalid mint: ${validationResult.error}`);
      throw new Error(`Invalid mint: ${validationResult.error}`);
    }

    // Add the mint to the wallet
    dMint.log(`Adding mint ${url} to wallet...`);
    currentWallet.mints.push(url.trim());

    // Update the store to trigger derived stores
    wallet.update((w) => w);

    // Publish the updated wallet and mintlist
    dMint.log('Publishing updated wallet and mint list...');
    await publishWalletWithMints();

    dMint.log(`✅ Mint ${url} added successfully`);
  } catch (error) {
    dMint.error(`❌ Error adding mint:`, error);
    throw error;
  }
}

// Remove a mint from the wallet
export async function removeMint(url: string) {
  dMint.log(`Removing mint: ${url}`);
  const currentWallet = get(wallet);
  if (!currentWallet) {
    dMint.error('Wallet not initialized');
    throw new Error('Wallet not initialized');
  }

  try {
    // Remove the mint from the wallet
    const mintIndex = currentWallet.mints.indexOf(url);
    if (mintIndex !== -1) {
      dMint.log(`Found mint at index ${mintIndex}, removing...`);
      currentWallet.mints.splice(mintIndex, 1);
    } else {
      dMint.warn(`Mint ${url} not found in wallet`);
    }

    // Update the store to trigger derived stores
    wallet.update((w) => w);

    // Publish the updated wallet and mintlist
    dMint.log('Publishing updated wallet and mint list...');
    await publishWalletWithMints();

    dMint.log(`✅ Mint ${url} removed successfully`);
  } catch (error) {
    dMint.error(`❌ Error removing mint:`, error);
    throw error;
  }
}

// Set a mint as the main mint (move to first position)
export async function setAsMainMint(url: string) {
  dMint.log(`Setting mint as main: ${url}`);
  const currentWallet = get(wallet);
  if (!currentWallet) {
    dMint.error('Wallet not initialized');
    throw new Error('Wallet not initialized');
  }

  try {
    // Find the mint in the current list
    const mintIndex = currentWallet.mints.indexOf(url);
    if (mintIndex === -1) {
      dMint.error(`Mint ${url} not found in wallet`);
      throw new Error('Mint not found in wallet');
    }

    // Don't do anything if it's already the main mint
    if (mintIndex === 0) {
      dMint.log(`Mint ${url} is already the main mint, no changes needed`);
      return;
    }

    // Remove the mint from the current position
    dMint.log(`Moving mint from position ${mintIndex} to position 0...`);
    const mintUrl = currentWallet.mints.splice(mintIndex, 1)[0];

    // Add it to the first position
    currentWallet.mints.unshift(mintUrl);

    // Update the store to trigger derived stores
    wallet.update((w) => w);

    // Publish the updated wallet and mintlist
    dMint.log('Publishing updated wallet and mint list...');
    await publishWalletWithMints();

    dMint.log(`✅ Mint ${url} set as main successfully`);
  } catch (error) {
    dMint.error(`❌ Error setting main mint:`, error);
    throw error;
  }
}

// Add wallet relay
// Add a mint to the wallet
export async function addWalletRelay(url: string) {
  const d = debug.extend('addWalletRelay');
  d.log(`Adding relay: ${url}`);
  if (!url.trim()) {
    d.error('relay URL cannot be empty');
    throw new Error('Relay URL cannot be empty');
  }

  const ndk = getNDK();
  const currentWallet = get(wallet);
  if (!currentWallet) {
    d.error('Wallet not initialized');
    throw new Error('Wallet not initialized');
  }

  try {
    // Don't add duplicates
    if (currentWallet.relaySet?.relayUrls.includes(url.trim())) {
      d.warn(`Relay ${url} is already in wallet relay set`);
      throw new Error('This relay is already in your wallet relay set');
    }

    // TODO: check connection to relay

    // Add the mint to the wallet
    d.log(`Adding relay ${url} to wallet relay set...`);
    currentWallet.relaySet?.addRelay(new NDKRelay(url.trim(), undefined,ndk));

    d.log("current wallet relay set ", currentWallet.relaySet)

    // Update the store to trigger derived stores
    wallet.update((w) => w);

    // Publish the updated wallet and mintlist
    d.log('Publishing updated wallet and relay list...');
    await publishWalletWithMints();

    dMint.log(`✅ Mint ${url} added successfully`);
  } catch (error) {
    dMint.error(`❌ Error adding mint:`, error);
    throw error;
  }
}

// Publish wallet and mint list as Nostr events
async function publishWalletWithMints() {
  const d = debug.extend("publishCurrentWallet")
  dMint.log('Publishing wallet and mint list...');
  const ndk = getNDK();
  const currentWallet = get(wallet);

  if (!currentWallet) {
    d.error('Wallet not initialized');
    throw new Error('Wallet not initialized');
  }

  try {
    // Publish the updated wallet
    d.log('Publishing wallet event...');
    await currentWallet.publish();

    // Also update the mintlist for nutzap reception
    d.log('Publishing Nutzap informational event (NIP-61)...');
    const mintlistForNutzapReception = new NDKCashuMintList(ndk);
    mintlistForNutzapReception.relays = currentWallet.relaySet?.relayUrls || [];
    mintlistForNutzapReception.mints = currentWallet.mints;
    mintlistForNutzapReception.p2pk = currentWallet.p2pk;
    await mintlistForNutzapReception.publishReplaceable();
    d.log('nip-61 event published: ', mintlistForNutzapReception)

    d.log('✅ Wallet and mint list published successfully');
  } catch (error) {
    dMint.error('❌ Failed to publish wallet with updated mints', error);
    throw error;
  }
}

// /**
//  * Creates a deposit token for messaging
//  * @returns The encoded token or null if creation fails
//  */
// export async function createMessageDeposit(): Promise<string | null> {
//   d.log(`Creating message deposit token of ${REQUIRED_DEPOSIT_AMOUNT} sats`);
//   const balance = get(walletBalance);
//
//   // Check if we have enough funds
//   if (balance < REQUIRED_DEPOSIT_AMOUNT) {
//     d.error(
//       `Insufficient funds. Need at least ${REQUIRED_DEPOSIT_AMOUNT} sats to send a message, but have ${balance} sats.`
//     );
//     return null;
//   }
//
//   try {
//     // Create a token using the existing generateToken function
//     d.log('Generating token for message deposit...');
//     const { encodedToken } = await generateToken(REQUIRED_DEPOSIT_AMOUNT);
//     d.log('✅ Message deposit token created successfully');
//     return encodedToken;
//   } catch (error) {
//     d.error('❌ Failed to create deposit token:', error);
//     return null;
//   }
// }
