// src/lib/stores/negentropySync.svelte.ts
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { relays, currentUser, getNDK } from './nostr.js';
import { get } from 'svelte/store';

// Type definitions for Negentropy
interface NegentropyStorageVector {
    insert(timestamp: number, id: string | Uint8Array | Buffer): void;
    seal(): void;
}

interface Negentropy {
    initiate(): Promise<string>;
    reconcile(msg: string): Promise<[string | null, string[], string[]]>;
    wantUint8ArrayOutput?: boolean;
}

// Global declarations for browser environment
declare global {
    interface Window {
        Negentropy: new (storage: NegentropyStorageVector, frameSizeLimit?: number) => Negentropy;
        NegentropyStorageVector: new () => NegentropyStorageVector;
    }
}

export interface NostrFilter {
    ids?: string[];
    authors?: string[];
    kinds?: number[];
    since?: number;
    until?: number;
    limit?: number;
    [key: string]: any;
}

export enum RelayStatus {
    PENDING = 'pending',
    CONNECTING = 'connecting',
    SYNCING = 'syncing',
    COMPLETED = 'completed',
    ERROR = 'error'
}

export interface RelayState {
    status: RelayStatus;
    progress: number;
    error: string | null;
    have: string[];
    need: string[];
    haveCount: number;
    needCount: number;
    roundTrips: number;
    startTime: number | null;
    endTime: number | null;
}

export interface SyncState {
    isRunning: boolean;
    totalRelays: number;
    completedRelays: number;
    currentRelay: string | null;
    relayStates: Map<string, RelayState>;
    totalEvents: { have: number; need: number };
    startTime: number | null;
    endTime: number | null;
}

export interface SyncResult {
    relay: string;
    success: boolean;
    have?: string[];
    need?: string[];
    roundTrips?: number;
    error?: string;
}

export function createNegentropySync() {
    // State using runes
    let syncState = $state<SyncState>({
        isRunning: false,
        totalRelays: 0,
        completedRelays: 0,
        currentRelay: null,
        relayStates: new Map(),
        totalEvents: { have: 0, need: 0 },
        startTime: null,
        endTime: null
    });

    // Load Negentropy library
    const loadNegentropy = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (window.Negentropy && window.NegentropyStorageVector) {
                console.log('✅ Negentropy already loaded');
                resolve();
                return;
            }

            console.log('📦 Loading Negentropy library...');
            
            const script = document.createElement('script');
            script.src = '/negentropy.js'; // Load from static folder
            script.onload = () => {
                // Verify the library loaded correctly
                if (window.Negentropy && window.NegentropyStorageVector) {
                    console.log('✅ Negentropy loaded successfully');
                    resolve();
                } else {
                    console.error('❌ Negentropy classes not found on window object');
                    reject(new Error('Negentropy library did not load properly'));
                }
            };
            script.onerror = (error) => {
                console.error('❌ Failed to load Negentropy script:', error);
                reject(new Error('Failed to load negentropy.js'));
            };
            
            document.head.appendChild(script);
        });
    };

    // Initialize relay state
    function initializeRelay(relayUrl: string): void {
        syncState.relayStates.set(relayUrl, {
            status: RelayStatus.PENDING,
            progress: 0,
            error: null,
            have: [],
            need: [],
            haveCount: 0,
            needCount: 0,
            roundTrips: 0,
            startTime: null,
            endTime: null
        });
    }

    // Update relay state
    function updateRelayState(relayUrl: string, updates: Partial<RelayState>): void {
        const current = syncState.relayStates.get(relayUrl);
        if (current) {
            syncState.relayStates.set(relayUrl, { ...current, ...updates });
        }
    }

    // Build storage from local events
    function buildStorage(events: NDKEvent[]): NegentropyStorageVector {
        console.log('🏗️ Building Negentropy storage with', events.length, 'events');
        
        const storage = new window.NegentropyStorageVector();
        
        for (const event of events) {
            // Ensure we have valid timestamp and id
            if (!event.created_at || !event.id) {
                console.warn('⚠️ Skipping invalid event:', event);
                continue;
            }
            
            try {
                storage.insert(event.created_at, event.id);
            } catch (error) {
                console.error('❌ Failed to insert event into storage:', event.id, error);
            }
        }
        
        storage.seal();
        console.log('✅ Storage sealed with', events.length, 'events');
        return storage;
    }

    // Get wallet-related filter for the user
    function getWalletFilter(userPubkey: string, mintUrls: string[] = []): NostrFilter[] {
        const filters: NostrFilter[] = [
            // Token events (7375)
            { 
                authors: [userPubkey], 
                kinds: [7375] 
            },
            // Delete events for tokens
            { 
                authors: [userPubkey], 
                kinds: [5], 
                "#k": ["7375"] 
            },
            // Wallet events (17375) 
            { 
                authors: [userPubkey], 
                kinds: [17375] 
            },
            // Transaction history (7376)
            { 
                authors: [userPubkey], 
                kinds: [7376] 
            }
        ];

        // Add incoming nutzaps if mint URLs provided
        if (mintUrls.length > 0) {
            filters.push({
                kinds: [9321],
                "#p": [userPubkey],
                "#u": mintUrls
            });
        }

        return filters;
    }

    // Get local wallet events from NDK
    async function getLocalWalletEvents(userPubkey: string, mintUrls: string[] = []): Promise<NDKEvent[]> {
        console.log('📦 Fetching local wallet events');
        
        const ndk = getNDK();
        const filters = getWalletFilter(userPubkey, mintUrls);
        const events: NDKEvent[] = [];
        
        try {
            for (const filter of filters) {
                const subscription = ndk.subscribe(filter, { closeOnEose: true });
                const filterEvents: NDKEvent[] = [];
                
                subscription.on('event', (event: NDKEvent) => {
                    filterEvents.push(event);
                });
                
                await new Promise<void>((resolve) => {
                    subscription.on('eose', () => resolve());
                });
                
                events.push(...filterEvents);
                console.log(`📄 Found ${filterEvents.length} events for filter kinds: ${filter.kinds?.join(',')}`);
            }
            
            console.log(`📦 Total local events: ${events.length}`);
            return events;
        } catch (error) {
            console.error('❌ Error fetching local events:', error);
            return [];
        }
    }

    // Sync with a single relay
    async function syncWithRelay(
        relayUrl: string, 
        userPubkey: string, 
        localEvents: NDKEvent[], 
        mintUrls: string[] = []
    ): Promise<{ have: string[]; need: string[]; roundTrips: number }> {
        console.log(`🔄 Starting sync with relay: ${relayUrl}`);
        
        updateRelayState(relayUrl, {
            status: RelayStatus.CONNECTING,
            startTime: Date.now()
        });

        try {
            // Connect to relay
            const relay = new WebSocket(relayUrl);
            
            await new Promise<void>((resolve, reject) => {
                relay.onopen = () => resolve();
                relay.onerror = () => reject(new Error('WebSocket connection failed'));
                setTimeout(() => reject(new Error('Connection timeout')), 10000);
            });

            console.log(`✅ Connected to ${relayUrl}`);
            
            updateRelayState(relayUrl, {
                status: RelayStatus.SYNCING,
                progress: 10
            });

            // Build negentropy storage and create Negentropy instance
            const storage = buildStorage(localEvents);
            const ne = new window.Negentropy(storage, 50_000);

            // Generate subscription ID
            const subId = `neg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Get appropriate filter
            const filters = getWalletFilter(userPubkey, mintUrls);
            console.log(`📋 Using ${filters.length} filters for sync`);

            // Track reconciliation state
            let totalHave: string[] = [];
            let totalNeed: string[] = [];
            let roundTrips = 0;

            // Initiate negentropy sync
            let msg = await ne.initiate();
            console.log(`📤 Sending NEG-OPEN to ${relayUrl}`);

            // Send NEG-OPEN with the first filter
            const negOpen = JSON.stringify([
                "NEG-OPEN",
                subId,
                filters[0], // Start with first filter
                msg
            ]);

            relay.send(negOpen);
            updateRelayState(relayUrl, { progress: 20 });

            // Handle relay responses
            return new Promise<{ have: string[]; need: string[]; roundTrips: number }>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    relay.close();
                    reject(new Error('Sync timeout'));
                }, 60000);

                relay.onmessage = async (event) => {
                    try {
                        const [type, id, ...rest] = JSON.parse(event.data);
                        
                        console.log(`📥 Received ${type} from ${relayUrl}`);

                        if (type === 'NEG-ERR') {
                            const error = rest[0] || 'Unknown error';
                            console.error(`❌ NEG-ERR from ${relayUrl}:`, error);
                            throw new Error(`Negentropy error: ${error}`);
                        }

                        if (type === 'NEG-MSG') {
                            const response = rest[0];
                            roundTrips++;
                            
                            console.log(`🔄 Round trip ${roundTrips} with ${relayUrl}`);
                            
                            const result = await ne.reconcile(response);
                            const [newMsg, have, need] = result;

                            // Accumulate have/need
                            if (have && have.length > 0) {
                                totalHave.push(...have);
                                console.log(`📤 Relay needs ${have.length} events from us`);
                            }
                            
                            if (need && need.length > 0) {
                                totalNeed.push(...need);
                                console.log(`📥 We need ${need.length} events from relay`);
                            }

                            // Update progress
                            const progress = Math.min(20 + (roundTrips * 15), 80);
                            updateRelayState(relayUrl, {
                                progress,
                                roundTrips,
                                haveCount: totalHave.length,
                                needCount: totalNeed.length
                            });

                            if (newMsg !== null) {
                                // Continue reconciliation
                                const negMsg = JSON.stringify([
                                    "NEG-MSG",
                                    subId,
                                    newMsg
                                ]);
                                relay.send(negMsg);
                            } else {
                                // Reconciliation complete
                                console.log(`✅ Reconciliation complete with ${relayUrl}`);
                                console.log(`📊 Final tally - Have: ${totalHave.length}, Need: ${totalNeed.length}`);
                                
                                // Send NEG-CLOSE
                                const negClose = JSON.stringify(["NEG-CLOSE", subId]);
                                relay.send(negClose);
                                
                                clearTimeout(timeout);
                                relay.close();
                                
                                updateRelayState(relayUrl, {
                                    status: RelayStatus.COMPLETED,
                                    progress: 100,
                                    have: totalHave,
                                    need: totalNeed,
                                    haveCount: totalHave.length,
                                    needCount: totalNeed.length,
                                    endTime: Date.now()
                                });

                                resolve({
                                    have: totalHave,
                                    need: totalNeed,
                                    roundTrips
                                });
                            }
                        }
                    } catch (error) {
                        console.error(`❌ Error processing message from ${relayUrl}:`, error);
                        clearTimeout(timeout);
                        relay.close();
                        reject(error);
                    }
                };

                relay.onerror = (error) => {
                    console.error(`❌ WebSocket error with ${relayUrl}:`, error);
                    clearTimeout(timeout);
                    reject(error);
                };
            });

        } catch (error) {
            console.error(`❌ Failed to sync with ${relayUrl}:`, error);
            
            updateRelayState(relayUrl, {
                status: RelayStatus.ERROR,
                error: error instanceof Error ? error.message : 'Unknown error',
                endTime: Date.now()
            });
            
            throw error;
        }
    }

    // Main sync function
    async function syncWithRelays(mintUrls: string[] = []): Promise<SyncResult[]> {
        // First, ensure Negentropy is loaded
        await loadNegentropy();
        
        const user = get(currentUser);
        const relayList = get(relays);
        
        if (!user) {
            throw new Error('No user logged in');
        }
        
        if (!relayList || relayList.length === 0) {
            throw new Error('No relays configured');
        }
        
        const userPubkey = user.pubkey;
        const relayUrls = relayList.map(r => r.url);
        
        // Get local events
        console.log('📦 Getting local wallet events...');
        const localEvents = await getLocalWalletEvents(userPubkey, mintUrls);
        
        console.log(`🚀 Starting Negentropy sync with ${relayUrls.length} relays`);
        console.log(`👤 User: ${userPubkey.slice(0, 8)}...`);
        console.log(`📦 Local events: ${localEvents.length}`);
        console.log(`🏦 Mint URLs: ${mintUrls.join(', ')}`);

        // Reset state
        syncState.isRunning = true;
        syncState.totalRelays = relayUrls.length;
        syncState.completedRelays = 0;
        syncState.relayStates.clear();
        syncState.totalEvents = { have: 0, need: 0 };
        syncState.startTime = Date.now();
        syncState.endTime = null;

        // Initialize all relay states
        relayUrls.forEach(url => initializeRelay(url));

        const results: SyncResult[] = [];

        // Sync with each relay (could be parallelized)
        for (const relayUrl of relayUrls) {
            try {
                syncState.currentRelay = relayUrl;
                console.log(`🎯 Syncing with relay ${syncState.completedRelays + 1}/${syncState.totalRelays}: ${relayUrl}`);
                
                const result = await syncWithRelay(relayUrl, userPubkey, localEvents, mintUrls);
                results.push({ relay: relayUrl, success: true, ...result });
                
                // Update totals
                syncState.totalEvents.have += result.have.length;
                syncState.totalEvents.need += result.need.length;
                
            } catch (error) {
                console.error(`❌ Failed to sync with ${relayUrl}:`, error);
                results.push({ 
                    relay: relayUrl, 
                    success: false, 
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
            
            syncState.completedRelays++;
        }

        syncState.isRunning = false;
        syncState.currentRelay = null;
        syncState.endTime = Date.now();

        const duration = syncState.endTime - syncState.startTime;
        const successful = results.filter(r => r.success).length;
        
        console.log(`🏁 Sync completed in ${duration}ms`);
        console.log(`✅ Successful: ${successful}/${relayUrls.length} relays`);
        console.log(`📊 Total events - Have: ${syncState.totalEvents.have}, Need: ${syncState.totalEvents.need}`);

        return results;
    }

    // Public API
    return {
        // State (reactive)
        get state() { return syncState; },
        
        // Actions
        syncWithRelays,
        
        // Utilities
        getRelayState: (relayUrl: string) => syncState.relayStates.get(relayUrl),
        getAllRelayStates: () => Array.from(syncState.relayStates.entries()),
        
        // Computed getters
        get progress(): number {
            return syncState.totalRelays > 0 
                ? (syncState.completedRelays / syncState.totalRelays) * 100 
                : 0;
        },
        
        get successfulRelays(): number {
            return Array.from(syncState.relayStates.values())
                .filter(state => state.status === RelayStatus.COMPLETED).length;
        },
        
        get failedRelays(): number {
            return Array.from(syncState.relayStates.values())
                .filter(state => state.status === RelayStatus.ERROR).length;
        },

        get duration(): number | null {
            if (!syncState.startTime) return null;
            const endTime = syncState.endTime || Date.now();
            return endTime - syncState.startTime;
        }
    };
}