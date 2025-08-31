// src/lib/client/services/logout.ts
import { get } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';

// Import all the stores and methods we need to clean up
import { logout as nostrLogout, currentUser } from '$lib/stores/nostr.js';
import { clearWallet } from '$lib/stores/wallet.js';
import { appState, InitStatus } from './init.svelte.js';
import { createDebug } from '$lib/utils/debug.js';

// Create debug logger for logout service
const d = createDebug('logout');

/**
 * Clear the Nostr IndexedDB cache for a specific user
 * @param npub The user's public key
 */
function clearNostrCache(npub: string): Promise<void> {
  if (!browser) return Promise.resolve();
  
  const dbName = `nostr-cache-${npub.slice(0, 8)}`;
  d.log(`Deleting IndexedDB database: ${dbName}`);
  
  return new Promise<void>((resolve, reject) => {
    const deleteRequest = window.indexedDB.deleteDatabase(dbName);
    
    deleteRequest.onerror = (event) => {
      const error = `Error deleting IndexedDB database: ${dbName}`;
      d.error(error, event);
      reject(new Error(error));
    };
    
    deleteRequest.onsuccess = () => {
      d.log(`Successfully deleted IndexedDB database: ${dbName}`);
      resolve();
    };
  });
}

/**
 * Complete logout that handles cleaning up all app components
 * @param options Configuration options for logout
 * @returns Promise that resolves when logout is complete
 */
export async function logout(
  options: {
    /**
     * Whether to redirect to home page after logout
     * @default true
     */
    redirectToHome?: boolean;

    /**
     * Whether to clear database cache
     * @default false
     */
    clearDatabase?: boolean;
  } = {}
): Promise<void> {
  // Set defaults
  const { redirectToHome = true, clearDatabase = false } = options;

  try {
    // Update app state
    appState.status = InitStatus.IDLE;
    appState.isInitialized = false;
    appState.error = null;

    // 1. Get current user before logout (if we need to clear the database)
    const user = clearDatabase ? get(currentUser) : null;

    // 2. Clear the wallet state
    clearWallet();

    // 3. Clear cache if requested
    if (clearDatabase && user) {
      d.log('Clearing Nostr database cache');
      try {
        await clearNostrCache(user.npub);
        d.log('Database cache cleared successfully');
      } catch (error) {
        d.error('Failed to clear database cache:', error);
        // Continue with logout even if cache clearing fails
      }
    }

    // 4. Use the Nostr logout function to clean up NDK and stored keys
    nostrLogout();

    d.log('Logout complete');

    // Redirect to home page if requested and in browser
    if (redirectToHome && browser) {
      goto('/');
    }
  } catch (error) {
    d.error('Error during logout:', error);
    throw error;
  }
}
