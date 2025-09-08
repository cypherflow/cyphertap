// src/lib/stores/negentropySync.svelte.ts
import { get } from 'svelte/store';
import { relays, getNDK } from './nostr.js';
import { createDebug } from '$lib/utils/debug.js';
import { loadNegentropy, getNegentropy } from '$lib/utils/sync.js';
import { 
    NDKSubscriptionCacheUsage, 
    type NDKEvent, 
    type NDKFilter,
    type NDKRelay,
    NDKRelaySet
} from '@nostr-dev-kit/ndk';

const debug = createDebug('negentropy-sync');

// Types for sync state
export interface RelaySyncState {
    url: string;
    status: 'idle' | 'connecting' | 'syncing' | 'uploading' | 'downloading' | 'complete' | 'error';
    progress: {
        phase: 'init' | 'reconciling' | 'fetching' | 'uploading' | 'downloading' | 'done';
        message: string;
        haveCount: number;
        needCount: number;
        totalProcessed: number;
        roundCount: number;
        startTime?: number;
        endTime?: number;
    };
    error?: string;
    subscriptionId?: string;
    negentropy?: any;
}

export interface NegentropyFilters {
    tokenEvents: NDKFilter;
    deleteEvents: NDKFilter;
    walletEvents: NDKFilter;
    historyEvents: NDKFilter;
}

// Global state using runes
let syncStates = $state<Map<string, RelaySyncState>>(new Map());
let isSyncing = $state(false);
let globalProgress = $state({
    totalRelays: 0,
    completedRelays: 0,
    errorCount: 0
});

// Generate filters for wallet-related events
function generateWalletFilters(userPubkey: string): NegentropyFilters {
    const d = debug.extend('generateFilters');
    d.log(`Generating filters for user: ${userPubkey}`);
    
    const filters = {
        tokenEvents: {
            authors: [userPubkey],
            kinds: [7375]
        },
        deleteEvents: {
            authors: [userPubkey],
            kinds: [5],
            "#k": ["7375"]
        },
        walletEvents: {
            authors: [userPubkey],
            kinds: [17375]
        },
        historyEvents: {
            authors: [userPubkey],
            kinds: [7376]
        }
    };
    
    d.log('Generated filters:', filters);
    return filters;
}

// Combine filters into a single filter for negentropy sync
function combineFilters(filters: NegentropyFilters): NDKFilter {
    const d = debug.extend('combineFilters');
    const authors = filters.tokenEvents.authors!;
    
    const combined = {
        authors,
        kinds: [7375, 5, 17375, 7376],
    };
    
    d.log('Combined filter:', combined);
    return combined;
}

// Create storage from events
async function createStorageFromEvents(events: NDKEvent[]): Promise<any> {
    const d = debug.extend('createStorage');
    d.log(`Creating storage from ${events.length} events`);
    
    const { NegentropyStorageVector } = getNegentropy();
    const storage = new NegentropyStorageVector();
    
    for (const event of events) {
        const timestamp = event.created_at || 0;
        const id = event.id;
        
        if (id) {
            storage.insert(timestamp, id);
            // d.log(`Inserted event: ${id.slice(0, 8)}... timestamp: ${timestamp}`);
        }
    }
    
    storage.seal();
    d.log('Storage sealed and ready');
    return storage;
}

// Get all local events matching the filters
async function getLocalEvents(filters: NegentropyFilters): Promise<NDKEvent[]> {
    const d = debug.extend('getLocalEvents');
    const ndk = getNDK();
    
    d.log('Fetching local events from cache...');
    
    // Fetch each filter separately and combine results
    const allEvents = new Set<NDKEvent>();
    
    const filterList = [
        { name: 'tokenEvents', filter: filters.tokenEvents },
        { name: 'deleteEvents', filter: filters.deleteEvents },
        { name: 'walletEvents', filter: filters.walletEvents },
        { name: 'historyEvents', filter: filters.historyEvents }
    ];
    
    for (const { name, filter } of filterList) {
        try {
            d.log(`Fetching ${name} with filter:`, filter);
            const events = await ndk.fetchEvents(filter, {
                cacheUsage: NDKSubscriptionCacheUsage.ONLY_CACHE
            });
            d.log(`Found ${events.size} events for ${name}`);
            events.forEach(event => allEvents.add(event));
        } catch (error) {
            d.warn(`Failed to fetch events for ${name}:`, error);
        }
    }
    
    const result = Array.from(allEvents);
    d.log(`Total unique local events: ${result.length}`);
    return result;
}

// Direct WebSocket connection for Negentropy
class NegentropyWebSocket {
    private ws: WebSocket | null = null;
    private url: string;
    private debug;
    private messageHandlers = new Map<string, (message: any[]) => void>();
    
    constructor(url: string) {
        this.url = url;
        this.debug = debug.extend(`ws:${new URL(url).hostname}`);
    }
    
    async connect(): Promise<void> {
        const d = this.debug.extend('connect');
        d.log(`Connecting to ${this.url}`);
        
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);
                
                this.ws.onopen = () => {
                    d.log('✅ WebSocket connected');
                    resolve();
                };
                
                this.ws.onclose = (event) => {
                    d.log(`WebSocket closed: ${event.code} ${event.reason}`);
                    this.ws = null;
                };
                
                this.ws.onerror = (error) => {
                    d.error('WebSocket error:', error);
                    reject(new Error('WebSocket connection failed'));
                };
                
                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    if (this.ws?.readyState !== WebSocket.OPEN) {
                        d.error('Connection timeout');
                        this.ws?.close();
                        reject(new Error('Connection timeout'));
                    }
                }, 10000);
                
            } catch (error) {
                d.error('Failed to create WebSocket:', error);
                reject(error);
            }
        });
    }
    
    private handleMessage(data: string): void {
        const d = this.debug.extend('handleMessage');
        d.log('Received message:', data);
        
        try {
            const message = JSON.parse(data);
            const [type, subId] = message;
            
            d.log(`Message type: ${type}, subId: ${subId}`);
            
            const handler = this.messageHandlers.get(subId);
            if (handler) {
                d.log('Found handler for subscription:', subId);
                handler(message);
            } else {
                d.log('No handler found for subscription:', subId);
            }
        } catch (error) {
            d.error('Failed to parse message:', error);
        }
    }
    
    send(message: string): void {
        const d = this.debug.extend('send');
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            d.error('Cannot send message: WebSocket not connected');
            throw new Error('WebSocket not connected');
        }
        
        d.log('Sending message:', message);
        this.ws.send(message);
    }
    
    addMessageHandler(subId: string, handler: (message: any[]) => void): void {
        const d = this.debug.extend('addHandler');
        d.log(`Adding handler for subscription: ${subId}`);
        this.messageHandlers.set(subId, handler);
    }
    
    removeMessageHandler(subId: string): void {
        const d = this.debug.extend('removeHandler');
        d.log(`Removing handler for subscription: ${subId}`);
        this.messageHandlers.delete(subId);
    }
    
    close(): void {
        const d = this.debug.extend('close');
        d.log('Closing WebSocket connection');
        this.ws?.close();
        this.ws = null;
        this.messageHandlers.clear();
    }
    
    get connected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

// Upload events using NDK
async function uploadEvents(relay: NDKRelay, eventIds: string[], localEvents: NDKEvent[]): Promise<void> {
    const d = debug.extend('uploadEvents');
    d.log(`Uploading ${eventIds.length} events to ${relay.url}`);
    
    for (const eventId of eventIds) {
        const event = localEvents.find(e => e.id === eventId);
        if (event) {
            try {
                d.log(`📤 Uploading event: ${eventId.slice(0, 8)}...`);
                await relay.publish(event);
                d.log(`✅ Successfully uploaded: ${eventId.slice(0, 8)}...`);
            } catch (error) {
                d.warn(`❌ Failed to upload event ${eventId}:`, error);
            }
        } else {
            d.warn(`Event not found in local events: ${eventId}`);
        }
    }
    
    d.log(`Upload complete: ${eventIds.length} events processed`);
}

// Download specific events using NDK
async function downloadEvents(relay: NDKRelay, eventIds: string[]): Promise<void> {
    const d = debug.extend('downloadEvents');
    d.log(`Downloading ${eventIds.length} events from ${relay.url}`);
    
    if (eventIds.length === 0) {
        d.log('No events to download');
        return;
    }
    
    const ndk = getNDK();
    
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            d.warn('Download timeout reached, resolving anyway');
            resolve();
        }, 30000);
        
        let receivedCount = 0;
        const targetCount = eventIds.length;
        
        d.log(`Creating subscription for ${targetCount} event IDs`);
        
        const subscription = ndk.subscribe(
            { ids: eventIds },
            { 
                closeOnEose: true,
                cacheUsage: NDKSubscriptionCacheUsage.PARALLEL
            },
            NDKRelaySet.fromRelayUrls([relay.url], ndk)
        );
        
        subscription.on('event', (event: NDKEvent) => {
            receivedCount++;
            d.log(`📥 Downloaded event ${receivedCount}/${targetCount}: ${event.id?.slice(0, 8)}...`);
        });
        
        subscription.on('eose', () => {
            clearTimeout(timeout);
            d.log(`✅ Download complete: ${receivedCount}/${targetCount} events received`);
            resolve();
        });
    });
}

// Sync with a single relay using direct WebSocket
async function syncWithRelay(relay: NDKRelay, filters: NegentropyFilters): Promise<void> {
    const d = debug.extend('syncRelay');
    const relayUrl = relay.url;
    d.log(`🔄 Starting sync with relay: ${relayUrl}`);
    
    // Initialize state
    const state: RelaySyncState = {
        url: relayUrl,
        status: 'connecting',
        progress: {
            phase: 'init',
            message: 'Initializing sync...',
            haveCount: 0,
            needCount: 0,
            totalProcessed: 0,
            roundCount: 0,
            startTime: Date.now()
        }
    };
    
    syncStates.set(relayUrl, state);
    d.log('Initial state set:', state);
    
    let negentropyWs: NegentropyWebSocket | null = null;
    
    try {
        // Ensure Negentropy is loaded
        d.log('Loading Negentropy library...');
        await loadNegentropy();
        const { Negentropy } = getNegentropy();
        d.log('Negentropy library loaded');
        
        // Get local events
        state.progress.message = 'Fetching local events...';
        state.progress.phase = 'init';
        syncStates.set(relayUrl, state);
        d.log('Fetching local events...');
        
        const localEvents = await getLocalEvents(filters);
        d.log(`Found ${localEvents.length} local events`);
        
        state.progress.message = `Found ${localEvents.length} local events`;
        syncStates.set(relayUrl, state);
        
        // Create Negentropy storage and instance
        d.log('Creating Negentropy storage...');
        const storage = await createStorageFromEvents(localEvents);
        const negentropy = new Negentropy(storage, 50_000);
        d.log('Negentropy instance created');
        
        state.negentropy = negentropy;
        state.subscriptionId = `neg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        state.status = 'syncing';
        state.progress.phase = 'reconciling';
        
        d.log(`Generated subscription ID: ${state.subscriptionId}`);
        
        // Create direct WebSocket connection
        d.log('Creating WebSocket connection...');
        negentropyWs = new NegentropyWebSocket(relayUrl);
        await negentropyWs.connect();
        d.log('WebSocket connected');
        
        // Start negentropy protocol
        const combinedFilter = combineFilters(filters);
        d.log('Starting Negentropy protocol...');
        let msg = await negentropy.initiate();
        d.log('Initial Negentropy message created, length:', msg.length);
        
        let isComplete = false;
        
        // Create message handler for this sync session
        const handleNegentropyMessage = async (message: any[]) => {
            const msgD = d.extend('handleMessage');
            msgD.log('Handling Negentropy message:', message);
            
            try {
                const [type, subId, ...rest] = message;
                
                if (subId !== state.subscriptionId) {
                    msgD.log(`Message not for us: ${subId} !== ${state.subscriptionId}`);
                    return;
                }
                
                if (type === "NEG-ERR") {
                    msgD.error('Negentropy error received:', rest[0]);
                    throw new Error(`Negentropy error: ${rest[0]}`);
                }
                
                if (type === "NEG-MSG") {
                    state.progress.roundCount++;
                    msgD.log(`📍 Reconciliation round ${state.progress.roundCount}`);
                    
                    const response = rest[0];
                    msgD.log('Calling negentropy.reconcile with response length:', response.length);
                    
                    const [newMsg, have, need] = await negentropy.reconcile(response);
                    msgD.log(`Reconcile result - newMsg: ${newMsg ? newMsg.length : 'null'}, have: ${have.length}, need: ${need.length}`);
                    
                    // Update progress
                    state.progress.haveCount += have.length;
                    state.progress.needCount += need.length;
                    state.progress.totalProcessed += have.length + need.length;
                    state.progress.message = `Round ${state.progress.roundCount}: Have ${have.length}, Need ${need.length}`;
                    syncStates.set(relayUrl, state);
                    
                    // Handle events we have but relay needs (upload)
                    if (have.length > 0) {
                        msgD.log(`📤 Starting upload of ${have.length} events`);
                        state.status = 'uploading';
                        state.progress.phase = 'uploading';
                        state.progress.message = `Uploading ${have.length} events...`;
                        syncStates.set(relayUrl, state);
                        
                        await uploadEvents(relay, have, localEvents);
                        msgD.log('Upload completed');
                    }
                    
                    // Handle events we need from relay (download)
                    if (need.length > 0) {
                        msgD.log(`📥 Starting download of ${need.length} events`);
                        state.status = 'downloading';
                        state.progress.phase = 'downloading';
                        state.progress.message = `Downloading ${need.length} events...`;
                        syncStates.set(relayUrl, state);
                        
                        await downloadEvents(relay, need);
                        msgD.log('Download completed');
                    }
                    
                    // Continue reconciliation or finish
                    if (newMsg !== null) {
                        msgD.log('Continuing reconciliation...');
                        state.status = 'syncing';
                        state.progress.phase = 'reconciling';
                        
                        // Send next message
                        const nextMessage = JSON.stringify(["NEG-MSG", state.subscriptionId, newMsg]);
                        negentropyWs!.send(nextMessage);
                        msgD.log('Sent next NEG-MSG');
                    } else {
                        // Reconciliation complete
                        msgD.log('🎉 Reconciliation complete!');
                        isComplete = true;
                        state.status = 'complete';
                        state.progress.phase = 'done';
                        state.progress.message = `Sync complete: ${state.progress.haveCount} uploaded, ${state.progress.needCount} downloaded`;
                        state.progress.endTime = Date.now();
                        syncStates.set(relayUrl, state);
                        
                        // Send NEG-CLOSE
                        const closeMessage = JSON.stringify(["NEG-CLOSE", state.subscriptionId]);
                        negentropyWs!.send(closeMessage);
                        msgD.log('Sent NEG-CLOSE');
                    }
                }
            } catch (error) {
                msgD.error('Error handling negentropy message:', error);
                isComplete = true;
                state.status = 'error';
                state.error = error instanceof Error ? error.message : 'Message handling error';
                state.progress.endTime = Date.now();
                syncStates.set(relayUrl, state);
            }
        };
        
        // Register message handler
        negentropyWs.addMessageHandler(state.subscriptionId, handleNegentropyMessage);
        d.log('Message handler registered');
        
        // Send initial NEG-OPEN message
        const openMessage = JSON.stringify(["NEG-OPEN", state.subscriptionId, combinedFilter, msg]);
        negentropyWs.send(openMessage);
        d.log('Sent NEG-OPEN message');
        
        // Wait for completion or timeout
        d.log('Waiting for sync completion...');
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (!isComplete) {
                    d.error('Sync timeout reached');
                    reject(new Error('Sync timeout'));
                }
            }, 120000); // 2 minute timeout
            
            const checkComplete = () => {
                if (isComplete) {
                    d.log('Sync completed, cleaning up...');
                    clearTimeout(timeout);
                    resolve();
                } else {
                    setTimeout(checkComplete, 100);
                }
            };
            checkComplete();
        });
        
        d.log('✅ Sync completed successfully');
        
    } catch (error) {
        d.error(`❌ Sync failed with relay ${relayUrl}:`, error);
        state.status = 'error';
        state.error = error instanceof Error ? error.message : 'Unknown error';
        state.progress.message = `Error: ${state.error}`;
        state.progress.endTime = Date.now();
        syncStates.set(relayUrl, state);
    } finally {
        // Clean up WebSocket connection
        if (negentropyWs) {
            d.log('Cleaning up WebSocket connection...');
            negentropyWs.removeMessageHandler(state.subscriptionId || '');
            negentropyWs.close();
        }
    }
}

// Public API
export const negentropySync = {
    // Reactive state getters
    get states() { return syncStates; },
    get isLoaded() { 
        const loaded = !!window.Negentropy && !!window.NegentropyStorageVector;
        debug.log(`Negentropy loaded: ${loaded}`);
        return loaded;
    },
    get isSyncing() { return isSyncing; },
    get progress() { return globalProgress; },
    
    // Get state for specific relay
    getRelayState(url: string): RelaySyncState | undefined {
        return syncStates.get(url);
    },
    
    // Load the Negentropy library
    async loadLibrary() {
        const d = debug.extend('loadLibrary');
        d.log('Loading Negentropy library...');
        return loadNegentropy();
    },
    
    // Start sync with all relays
    async startSync() {
        const d = debug.extend('startSync');
        
        if (isSyncing) {
            d.warn('Sync already in progress');
            return;
        }
        
        const ndk = getNDK();
        const user = ndk.activeUser;
        
        if (!ndk || !user?.pubkey) {
            d.error('NDK or user not initialized');
            throw new Error('NDK or user not initialized');
        }
        
        d.log(`Starting sync for user: ${user.pubkey}`);
        
        // Load Negentropy if not already loaded
        await loadNegentropy();
        
        isSyncing = true;
        const relayList = get(relays);
        
        globalProgress.totalRelays = relayList.length;
        globalProgress.completedRelays = 0;
        globalProgress.errorCount = 0;
        
        d.log(`🚀 Starting Negentropy sync with ${relayList.length} relays`);
        
        const filters = generateWalletFilters(user.pubkey);
        
        // Start sync with all relays in parallel
        const syncPromises = relayList.map(relayInfo => {
            const relay = ndk.pool.getRelay(relayInfo.url);
            if (!relay) {
                d.warn(`Relay ${relayInfo.url} not found in pool`);
                globalProgress.errorCount++;
                return Promise.resolve();
            }
            
            return syncWithRelay(relay, filters)
                .then(() => {
                    globalProgress.completedRelays++;
                    d.log(`✅ Completed sync with ${relayInfo.url}`);
                })
                .catch((error) => {
                    globalProgress.errorCount++;
                    d.error(`❌ Sync failed for relay ${relayInfo.url}:`, error);
                });
        });
        
        try {
            await Promise.allSettled(syncPromises);
            d.log('✅ All relay syncs completed');
        } finally {
            isSyncing = false;
        }
    },
    
    // Start sync with specific relay
    async syncRelay(relayUrl: string) {
        const d = debug.extend('syncRelay');
        const ndk = getNDK();
        const user = ndk.activeUser;
        
        if (!user?.pubkey) {
            d.error('User not initialized');
            throw new Error('User not initialized');
        }
        
        const relay = ndk.pool.getRelay(relayUrl);
        if (!relay) {
            d.error(`Relay ${relayUrl} not found in pool`);
            throw new Error(`Relay ${relayUrl} not found in pool`);
        }
        
        d.log(`Starting individual sync with relay: ${relayUrl}`);
        
        await loadNegentropy();
        
        const filters = generateWalletFilters(user.pubkey);
        await syncWithRelay(relay, filters);
    },
    
    // Clear sync states
    clearStates() {
        const d = debug.extend('clearStates');
        d.log('Clearing all sync states');
        syncStates.clear();
        globalProgress.totalRelays = 0;
        globalProgress.completedRelays = 0;
        globalProgress.errorCount = 0;
    }
};