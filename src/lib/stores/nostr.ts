// src/lib/client/stores/nostr.ts
import NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import NDK, {
  NDKPrivateKeySigner,
  type NDKUser,
  NDKNip07Signer,
  type NDKSigner,
  NDKEvent,
  NDKKind,
  normalizeRelayUrl,
} from '@nostr-dev-kit/ndk';
import { writable, derived, get } from 'svelte/store';
import { BROWSER as browser } from 'esm-env'
import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie";
import { startUnpublishedEventsMonitor, stopUnpublishedEventsMonitor } from '$lib/services/unpublishedEvents.js';
import { createDebug } from '$lib/utils/debug.js';
import { initWallet } from './wallet.js';
import { navigateTo } from './navigation.js';

// Create debug logger for Nostr functionality
const debug = createDebug('nostr');
// const dConnect = d.extend('connect');
// const dRelay = d.extend('relay');
// const dAuth = d.extend('auth');
// const dEvent = d.extend('event');

// Create writable stores
export const ndkInstance = writable<NDKSvelte | null>(null);
export const currentUser = writable<NDKUser | null>(null);
export const isConnecting = writable<boolean>(false);
export const loginError = writable<string | null>(null);

// Local storage keys
export const ENCRYPTED_KEY = 'ncrypt';
export const EXTENSION_LOGIN = 'nip07';

/**
 * Initialize NDK with a specific user context
 * @param signer - The signer to use
 * @returns An object containing the NDK instance and user
 */
export async function initNDK(signer: NDKSigner) {
  const d = debug.extend('initNDK')
  d.log('Initializing NDK with signer');

  // Check if we already have an instance
  const existingNdk = get(ndkInstance);
  if (existingNdk && existingNdk.signer) {
    d.log('NDK already initialized with a signer, reusing existing instance');
    return {
      ndk: existingNdk,
      user: get(currentUser) || (await existingNdk.signer.user())
    };
  }

  // Get user from signer
  d.log('Getting user from signer');
  const user = await signer.user();

  if (!user) {
    d.error('Failed to get user from signer');
    throw new Error('Failed to get user');
  }
  d.log(`User retrieved: ${user.npub.slice(0, 8)}...${user.npub.slice(-4)}`);

  // init dexie cache
  d.log(`Initializing Dexie cache for user ${user.npub.slice(0, 8)}`);
  const dexieAdapter = new NDKCacheAdapterDexie({
    dbName: dbName(user.npub),
    saveSig: true
  });

  d.log('Creating new NDK instance or updating existing one');
  const ndk =
    existingNdk ||
    new NDKSvelte({
      explicitRelayUrls: [
        'wss://relay.cypherflow.ai'
        // Add other default relays as needed
      ],
      enableOutboxModel: false,
      autoFetchUserMutelist: false,
      signer: signer,
      cacheAdapter: dexieAdapter,
    });

  // Update stores (early to ensure UI can display loading state)
  d.log('Updating NDK and user stores');
  ndkInstance.set(ndk);
  currentUser.set(user);

  // Connect to relays
  try {
    d.log('Connecting to relays');
    await ndk.connect();
    d.log('Successfully connected to relays');

    // Set up relay event listeners
    d.log('Setting up relay event listeners');
    relaySetup(ndk);
  } catch (err) {
    d.error('Failed to connect to relays:', err);
    d.warn('Continuing without relay connection - will work with cached data only');
    // Continue anyway - we might still be able to work with locally cached data
  }

  d.log('NDK initialization complete');
  return { ndk, user };
}

function dbName(npub: string) {
  return `nostr-cache-${npub.slice(0, 8)}`
}

/**
 * Set up listeners for relay connection events
 */
function relaySetup(ndk: NDKSvelte) {
  const d = debug.extend("relaySetup")
  d.log('Registering event listeners');

  const handleRelayConnect = (relay: any) => {
    d.log(`Connected to: ${relay.url}`);
    // This will trigger updates to derived stores
    ndkInstance.set(ndk);
  };

  const handleRelayDisconnect = (relay: any) => {
    d.log(`Disconnected from: ${relay.url}`);
    // This will trigger updates to derived stores
    ndkInstance.set(ndk);
  };

  ndk.pool.on('relay:connect', handleRelayConnect);
  ndk.pool.on('relay:disconnect', handleRelayDisconnect);

  d.log('Relay event listeners set up successfully');

  // Return cleanup function
  return () => {
    d.log('Cleaning up relay event listeners');
    ndk.pool.off('relay:connect', handleRelayConnect);
    ndk.pool.off('relay:disconnect', handleRelayDisconnect);
  };
}

/**
 * Generate a new keypair for the user
 * @returns Private key string
 */
export function generateNewKeypair(): string {
  const d = debug.extend("generateNewKeyPair")
  d.log('Generating new Nostr keypair');
  const signer = NDKPrivateKeySigner.generate();
  const privateKey = signer.privateKey!;
  d.log('New keypair generated successfully');
  return privateKey;
}

/**
 * Login with a private key (nsec)
 */
export async function privateKeyLogin(nsec: string) {
  const d = debug.extend("privateKeyLogin")
  try {
    isConnecting.set(true);
    loginError.set(null);

    // Create private key signer
    let signer: NDKSigner;
    try {
      d.log('Creating signer with private key...');
      signer = new NDKPrivateKeySigner(nsec);
      d.log('Signer created successfully');
    } catch (error) {
      d.error('Invalid private key format:', error);
      throw new Error('Invalid private key format');
    }

    // Initialize NDK with private key signer
    await initNDK(signer);

    // Save the key securely
    d.log('Securely storing private key');
    storePrivateKey(nsec);
    d.log('Private key stored securely');

    d.log('Login with private key completed successfully');
    return true;
  } catch (error) {
    d.error('Login with private key failed:', error);
    loginError.set(error instanceof Error ? error.message : 'Login failed');
    throw error;
  } finally {
    isConnecting.set(false);
  }
}

/**
 * Login with a NIP-07 extension
 */

export async function nip07Login() {
  const d = debug.extend("nip07Login")

  try {
    isConnecting.set(true);
    loginError.set(null);

    if (!browser || !window.nostr) {
      d.error('No Nostr extension found');
      throw new Error(
        'No Nostr extension found. Please install Alby, nos2x, or another NIP-07 extension.'
      );
    }

    // Create NIP-07 signer (for browser extensions)
    d.log('Creating NIP-07 signer from browser extension');
    const nip07signer = new NDKNip07Signer();
    d.log('NIP-07 signer created successfully');

    // Initialize NDK with nip-07 signer
    await initNDK(nip07signer);

    // Store marker for extension login
    if (browser) {
      d.log('Storing extension login marker on local storage');
      localStorage.setItem(EXTENSION_LOGIN, 'true');
    }

    d.log('Login with extension completed successfully');
    return true;
  } catch (error) {
    d.error('Login with extension failed:', error);
    loginError.set(error instanceof Error ? error.message : 'Login failed');
    throw error;
  } finally {
    isConnecting.set(false);
  }
}


/**
 * Securely store the user's private key
 */
function storePrivateKey(privateKey: string) {
  const d = debug.extend("storePrivateKey")
  d.log('Storing private key');
  if (!browser) {
    d.warn('Not in browser environment, skipping key storage');
    return;
  }
  localStorage.setItem(ENCRYPTED_KEY, privateKey);
  d.log('Private key stored in local storage');
}

/**
 * Unified login function that handles both login methods
 * Keeps all login logic in the Nostr service
 */
export async function login(options: {
  method: 'private-key' | 'nip-07';
  privateKey?: string;
}): Promise<void> {
  const d = debug.extend("login")
  d.log(`Login with method: ${options.method}`);

  try {
    isConnecting.set(true);
    loginError.set(null);

    // Perform login based on method
    if (options.method === 'private-key' && options.privateKey) {
      await privateKeyLogin(options.privateKey);
    } else if (options.method === 'nip-07') {
      await nip07Login();
    } else {
      throw new Error('Invalid login method or missing required parameters');
    }

    d.log(`Login successful!`);
    navigateTo("main");

    // Start unpublished events monitor
    startUnpublishedEventsMonitor();

    await initWallet();


    return;
  } catch (error) {
    d.error('Login failed:', error);
    loginError.set(error instanceof Error ? error.message : 'Login failed');
    throw error;
  } finally {
    isConnecting.set(false);
  }
}

/**
 * Try to auto-login with stored credentials
 * This function only handles the NDK initialization, not other components
 */
export async function autoLogin() {
  const d = debug.extend("autoLogin");

  if (!browser) {
    d.warn('Not in browser environment, skipping auto-login');
    return null;
  }

  try {
    // Check if we have a stored key
    const storedKey = localStorage.getItem(ENCRYPTED_KEY);
    const extensionMarker = localStorage.getItem(EXTENSION_LOGIN);

    if (storedKey) {
      d.log('Found stored private key, attempting login');
      // In a real app, you'd decrypt this key first
      return await login({
        method: 'private-key',
        privateKey: storedKey
      })
    } else if (extensionMarker === 'true') {
      d.log('Found extension login marker, attempting extension login');

      // Check if extension is available
      if (!window.nostr) {
        d.error('Extension not available but marker exists');
        throw new Error('Nostr extension not found. Please install or enable your extension.');
      }

      return await login({ method: "nip-07" });
    } else {
      d.log('No stored credentials found, auto-login skipped');
    }
  } catch (error) {
    d.error('Auto-login failed:', error);
    // Clear potentially corrupted credentials
    d.log('Clearing potentially corrupted credentials');
    localStorage.removeItem(ENCRYPTED_KEY);
    localStorage.removeItem(EXTENSION_LOGIN);
  }

  return null;
}

/**
 * Clear the Nostr IndexedDB cache for a specific user
 * @param npub The user's public key
 */
function clearNostrCache(npub: string): Promise<void> {
  const d = debug.extend("clearNostrCache")

  if (!browser) return Promise.resolve();

  const db = dbName(npub);
  d.log(`Deleting IndexedDB database: ${db}`);

  return new Promise<void>((resolve, reject) => {
    const deleteRequest = window.indexedDB.deleteDatabase(db);

    deleteRequest.onerror = (event) => {
      const error = `Error deleting IndexedDB database: ${db}`;
      d.error(error, event);
      reject(new Error(error));
    };

    deleteRequest.onsuccess = () => {
      d.log(`Successfully deleted IndexedDB database: ${db}`);
      resolve();
    };
  });
}

/**
 * Logout function
 */
export function logout(
  clearCache: boolean = false) {
  const d = debug.extend("logout")
  d.log('Logging out user');
  const ndk = get(ndkInstance);
  const user = get(currentUser);

  // Stop unpublished events monitor
  d.log('Stopping unpublished events monitor');
  stopUnpublishedEventsMonitor();

  // Delete the user's cache database if requested
  if (browser && user && clearCache) {
    clearNostrCache(user.npub);
  }

  if (ndk) {
    d.log('Clearing NDK signer and active user');
    ndk.signer = undefined;
    ndk.activeUser = undefined;
    ndkInstance.set(null);
  }
  currentUser.set(null);

  // Clear stored key
  if (browser) {
    d.log('Removing stored private key and extension marker if any');
    localStorage.removeItem(ENCRYPTED_KEY);
    localStorage.removeItem(EXTENSION_LOGIN);
  }
  d.log('Logout complete');
}
export function getNDK(): NDK {
  const ndk = get(ndkInstance);

  if (!ndk) {
    debug.error('Attempted to get NDK instance but it is not initialized');
    throw new Error('NDK not initialized');
  }
  return ndk;
}
/**
 * Add a relay to the NDK instance and publish the updated relay list
 * @param url The relay URL to add
 */
export async function addRelay(url: string) {
  const d = debug.extend("addRelay");

  d.log(`Adding relay: ${url}`);
  if (!url.trim()) {
    d.error('Relay URL cannot be empty');
    throw new Error('Relay URL cannot be empty');
  }

  try {
    const ndk = getNDK();

    const normalizedUrl = normalizeRelayUrl(url.trim());
    d.log(`Normalized relay URL: ${normalizedUrl}`);

    d.log('Adding relay to NDK pool');
    ndk.addExplicitRelay(normalizedUrl);
    d.log('Relay added to local NDK instance');

    // Make sure to update the store to trigger derived stores
    d.log('Updating NDK store');
    ndkInstance.set(ndk);

    d.log('Publishing updated relay list');
    await publishRelayList();
    d.log('New relay list published successfully');

    return normalizedUrl;
  } catch (error) {
    d.error('Error adding relay:', error);
    throw error;
  }
}

/**
 * Remove a relay from the NDK instance and publish the updated relay list
 * @param url The relay URL to remove
 */
export async function removeRelay(url: string) {
  const d = debug.extend("removeRelay");
  d.log(`Removing relay: ${url}`);

  try {
    const ndk = getNDK();

    d.log('Removing relay from NDK pool');
    ndk.pool.removeRelay(url);
    d.log('Relay removed from local NDK instance');

    // Update the store to trigger derived stores
    d.log('Updating NDK store');
    ndkInstance.set(ndk);

    d.log('Publishing updated relay list');
    await publishRelayList();
    d.log('Updated relay list published successfully');
  } catch (error) {
    d.error('Error removing relay:', error);
    throw error;
  }
}

/**
 * Publish the current relay list as a Nostr event
 */
export async function publishRelayList() {
  const d = debug.extend("publishRelayList");
  d.log('Publishing relay list');

  const ndk = getNDK();
  const user = get(currentUser);

  if (!ndk || !user) {
    d.error('NDK or user not initialized');
    throw new Error('NDK or user not initialized');
  }

  try {
    d.log('Creating relay list event (kind 10002)');
    const event = new NDKEvent(ndk, {
      kind: NDKKind.RelayList,
      content: ''
    });

    // Add all current relays to the event
    const relays = Array.from(ndk.pool.relays.values());
    relays.forEach((relay) => {
      event.tags.push(['r', relay.url]);
      d.log(`Added relay to tags: ${relay.url}`);
    });

    d.log('Publishing relay list event');
    await event.publish();
    d.log('Relay list event published successfully');
  } catch (error) {
    d.error('Failed to publish relay list:', error);
    throw error;
  }
}

// Derived store for login status
export const isLoggedIn = derived(currentUser, ($currentUser) => {
  const loggedIn = !!$currentUser;
  console.log(`Login status: ${loggedIn ? 'Logged in' : 'Not logged in'}`);
  return loggedIn;
});

// Derived store for relays list
export const relays = derived(ndkInstance, ($ndk) => {
  const d = debug.extend('relays');
  if (!$ndk) {
    console.log('No NDK instance, relay list is empty');
    return [];
  }
  const relayList = Array.from($ndk.pool.relays.values());
  d.log(`Current relay list has ${relayList.length} relays`);
  return relayList;
});

// Derived store for relay connection status
export const relayConnectionStatus = derived(relays, ($relays) => {
  const d = debug.extend('relayConnectionStatus')
  const status = $relays.map((relay) => ({
    url: relay.url,
    connected: relay.status >= 5, // e.g., NDKRelayStatus.CONNECTED
    status: relay.status
  }));

  d.log(`Relay connection status: ${status.filter(r => r.connected).length}/${status.length} connected`);
  return status;
});
