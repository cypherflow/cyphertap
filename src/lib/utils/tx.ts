/**
 * Formats a transaction description by removing the nanoId if present
 * @param description The original transaction description
 * @returns The formatted description with nanoId removed
 */
export function formatTransactionDescription(description: string): string {
	if (!description) return 'Unknown';

	// Check if this is an outgoing token with nanoId pattern
	// Pattern: "Token sent #XXXXX" where XXXXX is the nanoId
	const tokenSentPattern = /^(Token sent) #[A-Za-z0-9_-]{5,}$/;

	if (tokenSentPattern.test(description)) {
		// Return just "Token sent" without the nanoId
		return 'Token sent';
	}

	return description;
}