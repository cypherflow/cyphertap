// src/lib/stores/scan-store.ts
import { writable } from 'svelte/store';

// Types for scan results
export type ScanResultType = 'lightning' | 'ecash' | 'private-key' | 'link' | 'unknown';

export interface ScanResult {
	type: ScanResultType;
	data: string;
}

// Create a writable store with initial value of null
const createScanStore = () => {
	const { subscribe, set } = writable<ScanResult | null>(null);

	return {
		subscribe,
		// Store a new scan result
		setResult: (type: ScanResultType, data: string) => {
			//console.log(`[SCAN STORE] Setting scan result: ${type}`);
			set({ type, data });
		},
		// Clear the scan result (call this after it's been used)
		clearResult: () => {
			//console.log('[SCAN STORE] Clearing scan result');
			set(null);
		}
	};
};

// Create a single instance of the store and export it
export const scanResult = createScanStore();

// Helper function to identify the type of scanned content
export function identifyScanType(data: string): ScanResultType {
	if (!data) return 'unknown';

	const lowerData = data.toLowerCase();

	// Check for Lightning invoice
	if (lowerData.startsWith('lightning:') || lowerData.startsWith('lnbc')) {
		return 'lightning';
	}

	// Check for Ecash token
	if (
		lowerData.startsWith('cashu:') ||
		lowerData.startsWith('cashub') ||
		(!lowerData.startsWith('cashu:') && lowerData.includes('cashub')) ||
		lowerData.startsWith('ur:') ||
		lowerData.includes('ur:')
	) {
		return 'ecash';
	}

	// Check for Nostr private key
	if (lowerData.startsWith('nsec')) {
		return 'private-key';
	}

	// Check for device link format
	if (
		lowerData.startsWith('nostr:link:') ||
		(lowerData.includes('ncryptsec') && lowerData.includes('nostr:link'))
	) {
		return 'link';
	}

	// Unknown format
	return 'unknown';
}
