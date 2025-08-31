// src/lib/client/utils/pin.ts

import { encrypt } from './nip49.js';
import { hexToBytes } from '@noble/hashes/utils.js';

/**
 * Generate a random numeric PIN of specified length
 * @param length The length of the PIN (default: 4)
 * @returns A string containing the PIN
 */
export function generateRandomPin(length: number = 4): string {
	// Simple 4-digit PIN generation with padding
	const pin = Math.floor(Math.random() * Math.pow(10, length)).toString();

	// Ensure the PIN has the correct length by padding with zeros if needed
	return pin.padStart(length, '0');
}

/**
 * Create a QR link payload with encrypted private key
 * @param privateKey The user's private key
 * @param pin The PIN used for encryption
 * @returns An object with encrypted key and formatted QR data
 */
export function createLinkPayload(
	privateKey: string,
	pin: string
): { encryptedKey: string; qrData: string } {
	// Import the nip49 functions (these will be available in the real implementation)
	//const { encrypt } = await import('$lib/client/utils/nip49');

	// Convert private key to bytes using the hexToBytes utility from your nip49 module
	const privateKeyBytes = hexToBytes(privateKey);

	// Encrypt the private key using the PIN as the password
	// Using a lower logn value (10) for faster scanning in QR codes
	const encryptedKey = encrypt(privateKeyBytes, pin, 10);

	// Create a custom URI format that your app will recognize
	// Important: Make sure the encryptedKey (which starts with ncryptsec1) can be
	// easily extracted and isn't mangled in any way
	const qrData = `nostr:link:${encryptedKey}`;

	//console.log(`Generated QR data starting with: ${qrData.substring(0, 30)}...`);

	return { encryptedKey, qrData };
}
