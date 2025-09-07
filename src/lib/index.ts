// src/lib/index.ts
// Main component
import './styles.css';
export { default as Cyphertap } from '$lib/components/cyphertap/cyphertap.svelte';

// Programmatic API
export { cyphertap } from '$lib/api/cyphertap-api.svelte.js';

// // Utility functions
// export { identifyScanType } from '$lib/stores/scan-store.js';
// export { formatTransactionDescription } from '$lib/utils/tx.js';

// // Types (if needed for consumers)
// export type { ScanResult, ScanResultType } from '$lib/stores/scan-store.js';