import { toast } from 'svelte-sonner';

/**
 * Utility function to copy text to clipboard
 * @param text Text to copy to clipboard
 * @returns Promise that resolves when the text is copied
 */
export async function copyToClipboard(text: string, label: string) {
	await navigator.clipboard
		.writeText(text)
		.then(() => {
			toast.success(`${label} copied to clipboard`);
		})
		.catch((err) => {
			console.error('Could not copy text: ', err);
			toast.error('Failed to copy');
		});
}

/**
 * Pastes text from clipboard if available
 * @returns Promise with the clipboard text or null if not supported/permitted
 */
export async function pasteFromClipboard(): Promise<string | null> {
	try {
		// Check if clipboard API is available and the context is secure
		if (
			typeof navigator !== 'undefined' &&
			navigator.clipboard &&
			navigator.clipboard.readText &&
			window.isSecureContext
		) {
			const text = await navigator.clipboard.readText();
			return text;
		} else {
			console.warn('Clipboard read access not available');
			return null;
		}
	} catch (error) {
		console.error('Failed to read from clipboard:', error);
		return null;
	}
}