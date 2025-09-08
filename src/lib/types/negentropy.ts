// src/lib/types/negentropy.ts
export interface RelaySyncProgress {
    phase: 'init' | 'reconciling' | 'fetching' | 'uploading' | 'downloading' | 'done';
    message: string;
    haveCount: number;
    needCount: number;
    totalProcessed: number;
    roundCount: number;
    startTime?: number;
    endTime?: number;
}

export interface RelaySyncState {
    url: string;
    status: 'idle' | 'connecting' | 'syncing' | 'uploading' | 'downloading' | 'complete' | 'error';
    progress: RelaySyncProgress;
    error?: string;
    subscriptionId?: string;
    negentropy?: any;
}

export interface NegentropyFilters {
    tokenEvents: import('@nostr-dev-kit/ndk').NDKFilter;
    deleteEvents: import('@nostr-dev-kit/ndk').NDKFilter;
    walletEvents: import('@nostr-dev-kit/ndk').NDKFilter;
    historyEvents: import('@nostr-dev-kit/ndk').NDKFilter;
}

export interface NegentropyResult {
    have: string[];  // Event IDs we have that relay needs
    need: string[];  // Event IDs we need from relay
}