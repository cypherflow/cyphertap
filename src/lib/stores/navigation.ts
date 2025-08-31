// src/lib/client/stores/wallet-navigation.ts
import { writable, get } from 'svelte/store';
import type { NDKCashuWalletTx } from '@nostr-dev-kit/ndk';
import { isLoggedIn } from './nostr.js';

// Define types for the views
export type ViewName =
  | 'login'
  | 'login-private-key'
  | 'login-link-device'  
  | 'login-nip-07'
  | 'login-generate-key'
  | 'main'
  | 'receive'
  | 'send'
  | 'settings'
  | 'transaction-history'
  | 'transaction-details'
  | 'qr-scanner';

// View hierarchy for animation direction
const viewHierarchy: Record<ViewName, number> = {
  'login': 0,
  'login-private-key': 1,
  'login-link-device': 1,
  'login-nip-07': 1,
  'login-generate-key': 1,
  'main': 2,
  'receive': 3,
  'send': 3,
  'settings': 3,
  'transaction-history': 3,
  'transaction-details': 4,
  'qr-scanner': 4
};
// Navigation context type
export type NavigationContext = {
  sourceView: ViewName;
  tx?: NDKCashuWalletTx;
};

// Create the stores
export const currentView = writable<ViewName>('login');
export const isUserMenuOpen = writable<boolean>(false)
export const direction = writable<number>(1);
export const context = writable<NavigationContext>({ sourceView: 'login' });
export const inTransition = writable<boolean>(false);



export function initUserMenuNavigation() {
  console.log("setting inTransition: false")
  //inTransition.set(false)
  if (get(isLoggedIn)) {
    console.log("[INIT USER MENU] USER IS LOGGED IN, GOING TO MAIN")
    currentView.set('main')
  } else {
    console.log("[INIT USER MENU] USER IS NOT LOGGED IN, GOING TO LOGIN")
    currentView.set('login')
  }
  //inTransition.set(false)
}

/**
 * Navigate to a specific view
 */
export function navigateTo(
  view: ViewName | 'reset',
  navigationContext?: Partial<NavigationContext>
) {
  const current = get(currentView);

  // Handle reset view (go to main if logged in, login otherwise)
  if (view === 'reset') {
    const loggedIn = get(isLoggedIn);
    view = loggedIn ? 'main' : 'login';
  }

  // Don't navigate if it's the same view
  if (view === current) return;

  // Set animation direction based on view hierarchy
  direction.set(viewHierarchy[view] > viewHierarchy[current] ? 1 : -1);

  // Set source view as current view
  context.update((ctx) => ({ ...ctx, sourceView: current }));
  console.log(`setting navigation context to: `, get(context))

  // Update context if provided
  if (navigationContext) {
    context.update((ctx) => ({ ...ctx, ...navigationContext }));
  }

  // Update current view
  console.log(`[navigateTo] setting current view to: ${view}`)
  currentView.set(view);
}

export function openMenuAt(view: ViewName) {
  console.log(`[openMenuAt] setting isTransition: false`)
  inTransition.set(false)

  console.log("[openMenuAt] navigate to reset")
  navigateTo('reset');
  console.log('[openMenuAt] set current view to ', view)
  currentView.set(view)
  //console.log("[openMenuAt] opening userMenuOpen")
  //isUserMenuOpen.set(true)
}

export function openMenuAtCurrentView() {
  console.log(`[openMenuAt] setting isTransition: false`)
  inTransition.set(false)

  const current = get(currentView)

  console.log("[openMenuAt] navigate to reset")
  navigateTo('reset');
  console.log('[openMenuAt] set current view to ', current)
  currentView.set(current)
  //console.log("[openMenuAt] opening userMenuOpen")
  //isUserMenuOpen.set(true)
}

/**
 * Start a view transition animation
 */
export function startTransition() {
  console.log("start transition")
  inTransition.set(true);
}

/**
 * End a view transition animation
 */
export function endTransition() {
  console.log('end transition')
  inTransition.set(false);
}

/**
 * Navigate to transaction details view
 */
export function viewTransactionDetails(transaction: any, sourceView: ViewName = 'main') {
  context.update((ctx) => ({
    ...ctx,
    transaction,
    transactionSourceView: sourceView
  }));

  navigateTo('transaction-detail');
}
