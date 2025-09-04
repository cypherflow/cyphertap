// src/lib/api/cyphertap-api.svelte.ts
import { 
  type NDKFilter, 
  type NDKRawEvent, 
  type NDKSubscription,
  NDKEvent
} from '@nostr-dev-kit/ndk';
import { getEncodedTokenV4 } from '@cashu/cashu-ts';

// Import existing stores directly
import { 
  ndkInstance, 
  currentUser, 
  relayConnectionStatus,
  autoLogin
} from '$lib/stores/nostr.js';
import { 
  wallet, 
  walletBalance, 
  isWalletReady
} from '$lib/stores/wallet.js';
import { get, derived } from 'svelte/store';

export class CyphertapAPI {
  private static instance: CyphertapAPI | null = null;

  // Create derived stores for reactive state
  private _isLoggedIn = derived(
    [currentUser, ndkInstance], 
    ([$currentUser, $ndkInstance]) => Boolean($currentUser && $ndkInstance)
  );
  
  private _isReady = derived(
    [ndkInstance, currentUser, wallet, isWalletReady], 
    ([$ndkInstance, $currentUser, $wallet, $isWalletReady]) => 
      Boolean($ndkInstance && $currentUser && $wallet && $isWalletReady)
  );
  
  private _npub = derived(
    [currentUser], 
    ([$currentUser]) => $currentUser?.npub || null
  );

  // Reactive state using runes that subscribe to derived stores
  #isLoggedIn = $state(false);
  #isReady = $state(false);
  #balance = $state(0);
  #npub = $state<string | null>(null);

  constructor() {
    // Subscribe to derived stores and update runes
    this._isLoggedIn.subscribe(value => {
      this.#isLoggedIn = value;
    });

    this._isReady.subscribe(value => {
      this.#isReady = value;
    });

    walletBalance.subscribe(value => {
      this.#balance = value;
    });

    this._npub.subscribe(value => {
      this.#npub = value;
    });
  }

  // Public reactive getters
  get isLoggedIn() { 
    return this.#isLoggedIn;
  }
  
  get isReady() { 
    return this.#isReady;
  }
  
  get balance() { 
    return this.#balance;
  }
  
  get npub() { 
    return this.#npub;
  }

  static getInstance(): CyphertapAPI {
    if (!CyphertapAPI.instance) {
      CyphertapAPI.instance = new CyphertapAPI();
    }
    return CyphertapAPI.instance;
  }

  // Public API methods

  // User info
  getUserNpub(): string | null {
    return get(currentUser)?.npub || null;
  }

  getUserHex(): string | null {
    return get(currentUser)?.pubkey || null;
  }

  // Lightning operations
  async createLightningInvoice(amount: number, description = ''): Promise<{ bolt11: string}> {
    const currentWallet = get(wallet);
    if (!currentWallet) throw new Error('Wallet not initialized');
    
    try {
      const deposit = currentWallet.deposit(amount);
      const bolt11 = await deposit.start();
      return { 
        bolt11 
        // paymentHash: deposit.id || '' 
      };
    } catch (error) {
      throw new Error(`Invoice creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendLightningPayment(bolt11: string): Promise<{ success: boolean; preimage?: string }> {
    const currentWallet = get(wallet);
    if (!currentWallet) throw new Error('Wallet not initialized');
    
    try {
      const result = await currentWallet.lnPay({ pr: bolt11 }, true);
      return { success: true, preimage: result?.preimage };
    } catch (error) {
      throw new Error(`Payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Ecash operations
  async generateEcashToken(amount: number, memo = ''): Promise<{ token: string; mint?: string }> {
    const currentWallet = get(wallet);
    if (!currentWallet) throw new Error('Wallet not initialized');
    
    try {
      const paymentInfo = {
        amount,
        unit: 'sat' as const,
        paymentDescription: memo || `${amount} sats token`
      };
      const result = await currentWallet.cashuPay(paymentInfo);
      const token = getEncodedTokenV4({
        mint: result?.mint,
        proofs: result?.proofs,
        memo
      });
      return { token, mint: result?.mint };
    } catch (error) {
      throw new Error(`Token generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async receiveEcashToken(token: string): Promise<{ success: boolean; amount: number }> {
    const currentWallet = get(wallet);
    if (!currentWallet) throw new Error('Wallet not initialized');
    
    try {
      const result = await currentWallet.receiveToken(token, 'Received via API');
      return { 
        success: true, 
        amount: result?.amount || 0 
      };
    } catch (error) {
      throw new Error(`Token receive failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Nostr operations
  async publishTextNote(content: string): Promise<{ id: string; pubkey: string }> {
    const ndk = get(ndkInstance);
    if (!ndk) throw new Error('NDK not initialized');
    
    const event = new NDKEvent(ndk, {
      kind: 1,
      content,
    });
    await event.publish();
    
    return {
      id: event.id || '',
      pubkey: event.pubkey || ''
    };
  }

  async publishEvent(event: Partial<NDKRawEvent>): Promise<{ id: string; pubkey: string }> {
    const ndk = get(ndkInstance);
    if (!ndk) throw new Error('NDK not initialized');
    
    const ndkEvent = new NDKEvent(ndk, event);
    await ndkEvent.publish();
    
    return {
      id: event.id || '',
      pubkey: event.pubkey || ''
    };
  }

  subscribe(filter: NDKFilter, callback: (event: { id: string; pubkey: string; content: string; kind: number; created_at: number }) => void): () => void {
    const ndk = get(ndkInstance);
    if (!ndk) throw new Error('NDK not initialized');
    
    const subscription = ndk.subscribe(filter);
    subscription.on('event', (event: NDKEvent) => {
      callback({
        id: event.id || '',
        pubkey: event.pubkey || '',
        content: event.content || '',
        kind: event.kind || 0,
        created_at: event.created_at || 0
      });
    });
    
    return () => subscription.stop();
  }

  async signEvent(event: Partial<NDKRawEvent>): Promise<{ id: string; pubkey: string; signature: string }> {
    const ndk = get(ndkInstance);
    if (!ndk) throw new Error('NDK not initialized');
    
    let ndkEvent = new NDKEvent(ndk, event);
    await ndkEvent.sign();
    
    return {
      id: event.id || '',
      pubkey: event.pubkey || '',
      signature: event.sig || ''
    };
  }

  // Encryption/Decryption
  async encrypt(content: string, recipientPubkey: string): Promise<string> {
    const ndk = get(ndkInstance);
    const user = get(currentUser);
    
    if (!ndk?.signer || !user) {
      throw new Error('Signer not available');
    }
    return await ndk.signer.encrypt(user, content, recipientPubkey);
  }

  async decrypt(encryptedContent: string, senderPubkey: string): Promise<string> {
    const ndk = get(ndkInstance);
    if (!ndk?.signer) {
      throw new Error('Signer not available');
    }
    return await ndk.signer.decrypt(encryptedContent, senderPubkey);
  }

  // Utility methods
  getConnectionStatus(): { connected: number; total: number } {
    const status = get(relayConnectionStatus);
    const connected = status.filter(relay => relay.connected).length;
    return { connected, total: status.length };
  }
}

// Export singleton instance
export const cyphertap = CyphertapAPI.getInstance();