
// src/lib/client/services/initialization.ts
import { get } from 'svelte/store';
import { BROWSER as browser } from 'esm-env';
import {
  ndkInstance,
  currentUser,
  autoLogin,
  EXTENSION_LOGIN
} from '$lib/stores/nostr.js';
import { initializeWallet } from '$lib/stores/wallet.js';
import { createDebug } from '$lib/utils/debug.js';
import { initNavigation } from '../stores/navigation.js';
import { startUnpublishedEventsMonitor } from './unpublishedEvents.js';

// Create a debug logger
const d = createDebug('init');

// Simple status enum
export enum InitStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  ERROR = 'error'
}

// Create a state object to track initialization status
export const appState = $state({
  status: InitStatus.IDLE,
  error: null as string | null,
  isInitialized: false
});

/**
 * Main initialization function that sets up the entire app
 * This is the only function called from the layout
 * @param skipAuth Whether to skip authentication (for login pages)
 */
export async function initializeApp(skipAuth = false): Promise<{
  initialized: boolean;
}> {
  // Prevent multiple initialization attempts
  if (appState.status === InitStatus.INITIALIZING) {
    d.log('Initialization already in progress, skipping');
    return { initialized: false };
  }

  d.log('Starting app initialization');
  appState.status = InitStatus.INITIALIZING;
  appState.error = null;

  try {
    // Step 1: Auto-login if needed
    let autoLoginSuccess = false;

    if (!skipAuth && browser) {
      d.log('Attempting auto-login');
      try {
        autoLoginSuccess = await autoLogin() !== null;
        d.log(`Auto-login result: ${autoLoginSuccess ? 'success' : 'failed'}`);
      } catch (error) {
        d.error('Auto-login error:', error);
        // If extension marker exists but extension is not available
        if (localStorage.getItem(EXTENSION_LOGIN) === 'true' && !window.nostr) {
          appState.error = 'Nostr extension not found. Please install or enable your extension.';
        } else {
          appState.error = error instanceof Error ? error.message : 'Auto-login failed';
        }

        // Clear any problematic markers
        localStorage.removeItem(EXTENSION_LOGIN);
        return { initialized: false };
      }
    } else {
      d.log('Skipping auto-login');
    }

    // Step 2: Check if we have NDK instance and user after auto-login
    const ndk = get(ndkInstance);
    const user = get(currentUser);

    // If we don't have both NDK and user, we're not ready for full app initialization
    if (!ndk || !user) {
      d.log('No NDK instance or user available, initialization incomplete');

      if (skipAuth) {
        // This is expected on login page
        d.log('Auth skipped, this is likely the login page');
        appState.status = InitStatus.IDLE;
        return { initialized: false };
      } else {
        // This is unexpected on non-login pages
        appState.status = InitStatus.ERROR;
        appState.error = 'Authentication required';
        return { initialized: false };
      }
    }

    // Step 3: Initialize all components since we have NDK and user
    d.log('NDK and user available, initializing components');
    console.log(ndk.activeUser?.pubkey, user.pubkey)

    initNavigation();

    // Initialize async components
    // await initializeWallet();

    // Start monitoring for unpublished events
    // d.log('Starting unpublished events monitor');
    // startUnpublishedEventsMonitor();

    // Mark initialization as complete
    d.log('App initialization complete');
    appState.status = InitStatus.INITIALIZED;
    appState.isInitialized = true;

    return { initialized: true };
  } catch (error) {
    d.error('App initialization failed:', error);
    appState.status = InitStatus.ERROR;
    appState.error = error instanceof Error ? error.message : 'Unknown initialization error';
    return { initialized: false };
  }
}

/**
 * Check if user is authenticated and app is initialized
 * Useful for route guards
 */
export function isAppReady(): boolean {
  return !!get(currentUser) && appState.isInitialized;
}
