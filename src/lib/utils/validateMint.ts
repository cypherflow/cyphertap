
// src/lib/client/utils/validateMint.ts
import { wallet as walletStore } from '$lib/stores/wallet.js';
import { get } from 'svelte/store';

/**
 * A simple function to validate a mint URL by attempting to connect to it
 *
 * @param mintUrl The URL of the mint to validate
 * @returns A validation result with status and error message if any
 */
export async function validateMint(mintUrl: string): Promise<{
  isValid: boolean;
  error?: string;
  info?: any;
}> {
  if (!mintUrl.trim()) {
    return { isValid: false, error: 'Mint URL cannot be empty' };
  }

  // Basic URL validation
  try {
    const url = new URL(mintUrl);
    if (!url.protocol.startsWith('http')) {
      return { isValid: false, error: 'Mint URL must start with http:// or https://' };
    }
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' };
  }

  const wallet = get(walletStore);
  if (!wallet) {
    return { isValid: false, error: 'Wallet not initialized' };
  }

  try {
    // Try to connect to the mint by getting a CashuWallet instance
    console.log(`Testing connection to mint: ${mintUrl}`);
    await wallet.getCashuWallet(mintUrl);
    console.log(`Successfully connected to mint: ${mintUrl}`);

    // If we get here, the mint is valid
    return {
      isValid: true
      // You could potentially get the mint info here too if needed:
      // info: cashuWallet.getMintInfo()
    };
  } catch (error) {
    console.error(`Failed to connect to mint ${mintUrl}:`, error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Failed to connect to mint'
    };
  }
}
