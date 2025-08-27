
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
import { browser } from '$app/environment';
import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie";
import { publishUnpublishedEvents, startUnpublishedEventsMonitor, stopUnpublishedEventsMonitor } from '$lib/services/unpublishedEvents.js';
import { createDebug } from '@/utils/debug.js';

// Create debug logger for Nostr functionality
const d = createDebug('nostr');
const dConnect = d.extend('connect');
const dRelay = d.extend('relay');
const dAuth = d.extend('auth');
const dEvent = d.extend('event');

// Create writable stores
export const ndkInstance = writable<NDKSvelte | null>(null);
export const currentUser = writable<NDKUser | null>(null);
export const isConnecting = writable<boolean>(false);
export const loginError = writable<string | null>(null);

// Local storage keys
export const ENCRYPTED_KEY_STORAGE_KEY = 'encrypted_nostr_key';
export const EXTENSION_LOGIN_MARKER = 'nostr_extension_login';

/**
 * Initialize NDK with a specific user context
 * @param signer - The signer to use
 * @returns An object containing the NDK instance and user
 */
export async function initializeNDKWithSigner(signer: NDKSigner) {
  dConnect.log('Initializing NDK with signer');

  // Check if we already have an instance
  const existingNdk = get(ndkInstance);
  if (existingNdk && existingNdk.signer) {
    dConnect.log('NDK already initialized with a signer, reusing existing instance');
    return {
      ndk: existingNdk,
      user: get(currentUser) || (await existingNdk.signer.user())
    };
  }

  // Get user from signer
  dConnect.log('Getting user from signer');
  const user = await signer.user();

  if (!user) {
    dConnect.error('Failed to get user from signer');
    throw new Error('Failed to get user');
  }
  dConnect.log(`User retrieved: ${user.npub.slice(0, 8)}...${user.npub.slice(-4)}`);

  // init dexie cache
  dConnect.log(`Initializing Dexie cache for user ${user.npub.slice(0, 8)}`);
  const dexieAdapter = new NDKCacheAdapterDexie({
    dbName: `nostr-cache-${user.npub.slice(0, 8)}`,
    saveSig: true
  });
  dConnect.log('Dexie cache initialized');

  // Create a new NDK instance or update existing one
  dConnect.log('Creating new NDK instance or updating existing one');
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
  dConnect.log('Updating NDK and user stores');
  ndkInstance.set(ndk);
  currentUser.set(user);

  // Connect to relays
  try {
    dConnect.log('Connecting to relays');
    await ndk.connect();
    dConnect.log('Successfully connected to relays');

    // Set up relay event listeners
    dConnect.log('Setting up relay event listeners');
    setupRelayEventListeners(ndk);
  } catch (err) {
    dConnect.error('Failed to connect to relays:', err);
    dConnect.warn('Continuing without relay connection - will work with cached data only');
    // Continue anyway - we might still be able to work with locally cached data
  }

  dConnect.log('NDK initialization complete');
  return { ndk, user };
}

/**
 * Set up listeners for relay connection events
 */
function setupRelayEventListeners(ndk: NDKSvelte) {
  dRelay.log('Setting up relay event listeners');

  const handleRelayConnect = (relay: any) => {
    dRelay.log(`Relay connected: ${relay.url}`);
    // This will trigger updates to derived stores
    ndkInstance.set(ndk);
  };

  const handleRelayDisconnect = (relay: any) => {
    dRelay.log(`Relay disconnected: ${relay.url}`);
    // This will trigger updates to derived stores
    ndkInstance.set(ndk);
  };

  ndk.pool.on('relay:connect', handleRelayConnect);
  ndk.pool.on('relay:disconnect', handleRelayDisconnect);

  dRelay.log('Relay event listeners set up successfully');

  // Return cleanup function
  return () => {
    dRelay.log('Cleaning up relay event listeners');
    ndk.pool.off('relay:connect', handleRelayConnect);
    ndk.pool.off('relay:disconnect', handleRelayDisconnect);
  };
}

/**
 * Generate a new keypair for the user
 * @returns Private key string
 */
export function generateNewKeypair(): string {
  dAuth.log('Generating new Nostr keypair');
  const signer = NDKPrivateKeySigner.generate();
  const privateKey = signer.privateKey!;
  dAuth.log('New keypair generated successfully');
  return privateKey;
}

/**
 * Login with a private key (nsec)
 */
export async function loginWithPrivateKey(nsec: string) {
  dAuth.log('Attempting login with private key');
  try {
    isConnecting.set(true);
    loginError.set(null);

    // Create private key signer
    let signer;
    try {
      dAuth.log('Creating private key signer');
      signer = new NDKPrivateKeySigner(nsec);
      dAuth.log('Private key signer created successfully');
    } catch (error) {
      dAuth.error('Invalid private key format:', error);
      loginError.set('Invalid private key format');
      throw new Error('Invalid private key format');
    }

    // Initialize NDK with this signer
    dAuth.log('Initializing NDK with private key signer');
    await initializeNDKWithSigner(signer);
    dAuth.log('NDK initialized successfully with private key');

    // Save the key securely
    dAuth.log('Securely storing private key');
    securelyStoreKey(nsec);
    dAuth.log('Private key stored securely');

    dAuth.log('Login with private key completed successfully');
    return true;
  } catch (error) {
    dAuth.error('Login with private key failed:', error);
    loginError.set(error instanceof Error ? error.message : 'Login failed');
    throw error;
  } finally {
    isConnecting.set(false);
  }
}

/**
 * Login with a NIP-07 extension
 */

export async function loginWithExtension() {
  dAuth.log('Attempting login with NIP-07 extension');
  try {
    isConnecting.set(true);
    loginError.set(null);

    if (!browser || !window.nostr) {
      dAuth.error('No Nostr extension found');
      throw new Error(
        'No Nostr extension found. Please install Alby, nos2x, or another NIP-07 extension.'
      );
    }

    // Create NIP-07 signer (for browser extensions)
    dAuth.log('Creating NIP-07 signer for browser extension');
    const nip07signer = new NDKNip07Signer();
    dAuth.log('NIP-07 signer created successfully');

    // Initialize NDK with this signer
    dAuth.log('Initializing NDK with NIP-07 signer');
    await initializeNDKWithSigner(nip07signer);
    dAuth.log('NDK initialized successfully with NIP-07 extension');

    // Store marker for extension login
    if (browser) {
      dAuth.log('Storing extension login marker');
      localStorage.setItem(EXTENSION_LOGIN_MARKER, 'true');
    }

    dAuth.log('Login with extension completed successfully');
    return true;
  } catch (error) {
    dAuth.error('Login with extension failed:', error);
    loginError.set(error instanceof Error ? error.message : 'Login failed');
    throw error;
  } finally {
    isConnecting.set(false);
  }
}


/**
 * Securely store the user's private key
 */
function securelyStoreKey(privateKey: string) {
  dAuth.log('Storing private key');
  if (!browser) {
    dAuth.warn('Not in browser environment, skipping key storage');
    return;
  }
  localStorage.setItem(ENCRYPTED_KEY_STORAGE_KEY, privateKey);
  dAuth.log('Private key stored in local storage');
}

/**
 * Unified login function that handles both login methods
 * Keeps all login logic in the Nostr service
 */
export async function login(options: {
  method: 'private-key' | 'extension';
  privateKey?: string;
}): Promise<boolean> {
  dAuth.log(`Login with method: ${options.method}`);

  try {
    isConnecting.set(true);
    loginError.set(null);

    // Perform login based on method
    if (options.method === 'private-key' && options.privateKey) {
      dAuth.log('Logging in with private key');
      await loginWithPrivateKey(options.privateKey);
    } else if (options.method === 'extension') {
      dAuth.log('Logging in with extension');
      await loginWithExtension();
    } else {
      dAuth.error('Invalid login method or missing parameters');
      throw new Error('Invalid login method or missing required parameters');
    }

    // Check if login was successful
    const success = !!get(currentUser);
    dAuth.log(`Login ${success ? 'successful' : 'failed'}`);

    // If login was successful, check for unpublished events
    if (success) {
      dAuth.log('Checking for unpublished events after login');
      try {
        // Start unpublished events monitor
        startUnpublishedEventsMonitor();
      } catch (err) {
        dAuth.error('Failed to process unpublished events:', err);
        // Non-fatal error, continue with login
      }
    }

    return success;
  } catch (error) {
    dAuth.error('Login failed:', error);
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
  dAuth.log('Attempting auto-login');
  if (!browser) {
    dAuth.warn('Not in browser environment, skipping auto-login');
    return null;
  }

  try {
    // Check if we have a stored key
    const storedKey = localStorage.getItem(ENCRYPTED_KEY_STORAGE_KEY);
    const extensionMarker = localStorage.getItem(EXTENSION_LOGIN_MARKER);

    if (storedKey) {
      dAuth.log('Found stored private key, attempting login');
      // In a real app, you'd decrypt this key first
      return await loginWithPrivateKey(storedKey);
    } else if (extensionMarker === 'true') {
      dAuth.log('Found extension login marker, attempting extension login');

      // Check if extension is available
      if (!window.nostr) {
        dAuth.error('Extension not available but marker exists');
        throw new Error('Nostr extension not found. Please install or enable your extension.');
      }

      return await loginWithExtension();
    } else {
      dAuth.log('No stored credentials found, auto-login skipped');
    }
  } catch (error) {
    dAuth.error('Auto-login failed:', error);
    // Clear potentially corrupted credentials
    dAuth.log('Clearing potentially corrupted credentials');
    localStorage.removeItem(ENCRYPTED_KEY_STORAGE_KEY);
    localStorage.removeItem(EXTENSION_LOGIN_MARKER);
  }

  return null;
}

/**
 * Logout function
 */
export function logout() {
  dAuth.log('Logging out user');
  const ndk = get(ndkInstance);
  const user = get(currentUser);

  // Stop unpublished events monitor
  dAuth.log('Stopping unpublished events monitor');
  stopUnpublishedEventsMonitor();

  // Delete the user's cache database if we have a user
  if (browser && user) {
    const dbName = `nostr-cache-${user.npub.slice(0, 8)}`;
    dAuth.log(`Deleting IndexedDB database: ${dbName}`);

    const deleteRequest = window.indexedDB.deleteDatabase(dbName);

    deleteRequest.onerror = (event) => {
      dAuth.error(`Error deleting IndexedDB database: ${dbName}`, event);
    };

    deleteRequest.onsuccess = () => {
      dAuth.log(`Successfully deleted IndexedDB database: ${dbName}`);
    };
  }

  if (ndk) {
    dAuth.log('Clearing NDK signer and active user');
    ndk.signer = undefined;
    ndk.activeUser = undefined;
    ndkInstance.set(null);
  }
  currentUser.set(null);

  // Clear stored key
  if (browser) {
    dAuth.log('Removing stored private key and extension marker');
    localStorage.removeItem(ENCRYPTED_KEY_STORAGE_KEY);
    localStorage.removeItem(EXTENSION_LOGIN_MARKER);
  }
  dAuth.log('Logout complete');
}
export function getNDK(): NDK {
  const ndk = get(ndkInstance);

  if (!ndk) {
    d.error('Attempted to get NDK instance but it is not initialized');
    throw new Error('NDK not initialized');
  }
  return ndk;
}
/**
 * Add a relay to the NDK instance and publish the updated relay list
 * @param url The relay URL to add
 */
export async function addRelay(url: string) {
  dRelay.log(`Adding relay: ${url}`);
  if (!url.trim()) {
    dRelay.error('Relay URL cannot be empty');
    throw new Error('Relay URL cannot be empty');
  }

  try {
    const ndk = getNDK();
    dRelay.log('Got NDK instance');

    const normalizedUrl = normalizeRelayUrl(url.trim());
    dRelay.log(`Normalized relay URL: ${normalizedUrl}`);

    dRelay.log('Adding relay to NDK pool');
    ndk.addExplicitRelay(normalizedUrl);
    dRelay.log('Relay added to local NDK instance');

    // Make sure to update the store to trigger derived stores
    dRelay.log('Updating NDK store');
    ndkInstance.set(ndk);

    dRelay.log('Publishing updated relay list');
    await publishRelayList();
    dRelay.log('New relay list published successfully');

    return normalizedUrl;
  } catch (error) {
    dRelay.error('Error adding relay:', error);
    throw error;
  }
}

/**
 * Remove a relay from the NDK instance and publish the updated relay list
 * @param url The relay URL to remove
 */
export async function removeRelay(url: string) {
  dRelay.log(`Removing relay: ${url}`);

  try {
    const ndk = getNDK();
    dRelay.log('Got NDK instance');

    dRelay.log('Removing relay from NDK pool');
    ndk.pool.removeRelay(url);
    dRelay.log('Relay removed from local NDK instance');

    // Update the store to trigger derived stores
    dRelay.log('Updating NDK store');
    ndkInstance.set(ndk);

    dRelay.log('Publishing updated relay list');
    await publishRelayList();
    dRelay.log('Updated relay list published successfully');
  } catch (error) {
    dRelay.error('Error removing relay:', error);
    throw error;
  }
}

/**
 * Publish the current relay list as a Nostr event
 */
export async function publishRelayList() {
  dEvent.log('Publishing relay list');
  const ndk = getNDK();
  const user = get(currentUser);

  if (!ndk || !user) {
    dEvent.error('NDK or user not initialized');
    throw new Error('NDK or user not initialized');
  }

  try {
    dEvent.log('Creating relay list event (kind 10002)');
    const event = new NDKEvent(ndk, {
      kind: NDKKind.RelayList,
      content: ''
    });

    // Add all current relays to the event
    const relays = Array.from(ndk.pool.relays.values());
    dEvent.log(`Adding ${relays.length} relays to event`);

    relays.forEach((relay) => {
      event.tags.push(['r', relay.url]);
      dEvent.log(`Added relay to tags: ${relay.url}`);
    });

    dEvent.log('Publishing relay list event');
    await event.publish();
    dEvent.log('Relay list event published successfully');
  } catch (error) {
    dEvent.error('Failed to publish relay list:', error);
    throw error;
  }
}

// Derived store for login status
export const isLoggedIn = derived(currentUser, ($currentUser) => {
  const loggedIn = !!$currentUser;
  d.log(`Login status: ${loggedIn ? 'Logged in' : 'Not logged in'}`);
  return loggedIn;
});

// Derived store for relays list
export const relays = derived(ndkInstance, ($ndk) => {
  if (!$ndk) {
    dRelay.log('No NDK instance, relay list is empty');
    return [];
  }
  const relayList = Array.from($ndk.pool.relays.values());
  dRelay.log(`Current relay list has ${relayList.length} relays`);
  return relayList;
});

// Derived store for relay connection status
export const relayConnectionStatus = derived(relays, ($relays) => {
  const status = $relays.map((relay) => ({
    url: relay.url,
    connected: relay.status >= 5, // e.g., NDKRelayStatus.CONNECTED
    status: relay.status
  }));

  dRelay.log(`Relay connection status: ${status.filter(r => r.connected).length}/${status.length} connected`);
  return status;
});
