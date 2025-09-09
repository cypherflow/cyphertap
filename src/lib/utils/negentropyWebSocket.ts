// src/lib/utils/negentropyWebSocket.ts
import { createDebug } from '$lib/utils/debug.js';
import { loadNegentropy, getNegentropy } from './negentropy.js';
import type { NDKFilter, NDKEvent } from '@nostr-dev-kit/ndk';
import type { NegentropyResult } from '$lib/types/negentropy.js';

const debug = createDebug('negentropy:ws');

export interface FilterWithEvents {
    filter: NDKFilter;
    localEvents: NDKEvent[];
    name?: string;
}

export interface MultiFilterResult {
    filterResults: Array<{
        filter: NDKFilter;
        name?: string;
        have: string[];
        need: string[];
        success: boolean;
        error?: string;
    }>;
    totalHave: string[];
    totalNeed: string[];
}

export class NegentropyWebSocket {
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

// Negentropy protocol functions
export async function createStorageFromEvents(events: NDKEvent[]): Promise<any> {
    const d = debug.extend('createStorage');
    d.log(`Creating storage from ${events.length} events...`);
    
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
    d.log('Storage sealed and ready!');
    return storage;
}

// Single filter sync (backward compatibility)
export async function performNegentropySync(
    relayUrl: string, 
    filter: NDKFilter, 
    localEvents: NDKEvent[],
    onProgress?: (message: string, roundCount: number) => void
): Promise<NegentropyResult> {
    const d = debug.extend('performSync');
    d.log(`Starting single filter Negentropy sync with ${relayUrl}`);
    
    const result = await performMultiFilterNegentropySync(
        relayUrl,
        [{ filter, localEvents }],
        (filterIndex, message, roundCount) => {
            onProgress?.(message, roundCount);
        }
    );
    
    if (result.filterResults.length > 0 && result.filterResults[0].success) {
        return {
            have: result.filterResults[0].have,
            need: result.filterResults[0].need
        };
    } else {
        throw new Error(result.filterResults[0]?.error || 'Unknown error');
    }
}

// Multi-filter sync with single WebSocket connection
export async function performMultiFilterNegentropySync(
    relayUrl: string,
    filtersWithEvents: FilterWithEvents[],
    onProgress?: (filterIndex: number, message: string, roundCount: number) => void
): Promise<MultiFilterResult> {
    const d = debug.extend('performMultiSync');
    d.log(`Starting multi-filter Negentropy sync with ${relayUrl} (${filtersWithEvents.length} filters)`);
    
    // Ensure Negentropy is loaded
    await loadNegentropy();
    const { Negentropy } = getNegentropy();
    
    // Create WebSocket connection once
    const negentropyWs = new NegentropyWebSocket(relayUrl);
    await negentropyWs.connect();
    d.log('WebSocket connected, starting filter processing');
    
    const filterResults: MultiFilterResult['filterResults'] = [];
    const allHave: string[] = [];
    const allNeed: string[] = [];
    
    try {
        // Process each filter sequentially
        for (let filterIndex = 0; filterIndex < filtersWithEvents.length; filterIndex++) {
            const { filter, localEvents, name } = filtersWithEvents[filterIndex];
            
            d.log(`Processing filter ${filterIndex + 1}/${filtersWithEvents.length}: ${name || 'Unnamed'}`);
            
            try {
                // Create storage and negentropy instance for this filter
                const storage = await createStorageFromEvents(localEvents);
                const negentropy = new Negentropy(storage, 50_000);
                
                const subscriptionId = `neg-${Date.now()}-${filterIndex}-${Math.random().toString(36).slice(2, 5)}`;
                d.log(`Generated subscription ID for filter ${filterIndex + 1}: ${subscriptionId}`);
                
                const filterHave: string[] = [];
                const filterNeed: string[] = [];
                let roundCount = 0;
                
                // Process this filter
                const filterResult = await new Promise<{ have: string[], need: string[] }>((resolve, reject) => {
                    let isComplete = false;
                    
                    const handleNegentropyMessage = async (message: any[]) => {
                        const msgD = d.extend(`filter${filterIndex + 1}`);
                        msgD.log('Handling Negentropy message:', message);
                        
                        try {
                            const [type, subId, ...rest] = message;
                            
                            if (subId !== subscriptionId) {
                                msgD.log(`Message not for us: ${subId} !== ${subscriptionId}`);
                                return;
                            }
                            
                            if (type === "NEG-ERR") {
                                msgD.error('Negentropy error received:', rest[0]);
                                throw new Error(`Negentropy error: ${rest[0]}`);
                            }
                            
                            if (type === "NEG-MSG") {
                                roundCount++;
                                msgD.log(`📍 Reconciliation round ${roundCount} for filter ${filterIndex + 1}`);
                                onProgress?.(filterIndex, `Filter ${filterIndex + 1} round ${roundCount}`, roundCount);
                                
                                const response = rest[0];
                                msgD.log('Calling negentropy.reconcile with response length:', response.length);
                                
                                const [newMsg, have, need] = await negentropy.reconcile(response);
                                msgD.log(`Reconcile result - newMsg: ${newMsg ? newMsg.length : 'null'}, have: ${have.length}, need: ${need.length}`);
                                
                                // Accumulate results for this filter
                                filterHave.push(...have);
                                filterNeed.push(...need);
                                
                                // Continue reconciliation or finish
                                if (newMsg !== null) {
                                    msgD.log('Continuing reconciliation...');
                                    const nextMessage = JSON.stringify(["NEG-MSG", subscriptionId, newMsg]);
                                    negentropyWs.send(nextMessage);
                                    msgD.log('Sent next NEG-MSG');
                                } else {
                                    // Reconciliation complete for this filter
                                    msgD.log(`🎉 Filter ${filterIndex + 1} reconciliation complete!`);
                                    isComplete = true;
                                    
                                    // Send NEG-CLOSE for this subscription
                                    const closeMessage = JSON.stringify(["NEG-CLOSE", subscriptionId]);
                                    negentropyWs.send(closeMessage);
                                    msgD.log('Sent NEG-CLOSE for filter');
                                    
                                    // Clean up handler and resolve
                                    negentropyWs.removeMessageHandler(subscriptionId);
                                    
                                    resolve({
                                        have: [...new Set(filterHave)], // Deduplicate
                                        need: [...new Set(filterNeed)]  // Deduplicate
                                    });
                                }
                            }
                        } catch (error) {
                            msgD.error('Error handling negentropy message:', error);
                            isComplete = true;
                            negentropyWs.removeMessageHandler(subscriptionId);
                            reject(error);
                        }
                    };
                    
                    // Register message handler for this filter
                    negentropyWs.addMessageHandler(subscriptionId, handleNegentropyMessage);
                    
                    // Start protocol for this filter
                    negentropy.initiate().then(msg => {
                        const openMessage = JSON.stringify(["NEG-OPEN", subscriptionId, filter, msg]);
                        negentropyWs.send(openMessage);
                        d.log(`Sent NEG-OPEN message for filter ${filterIndex + 1}`);
                    }).catch(reject);
                    
                    // Timeout for this filter
                    setTimeout(() => {
                        if (!isComplete) {
                            d.error(`Filter ${filterIndex + 1} sync timeout`);
                            negentropyWs.removeMessageHandler(subscriptionId);
                            reject(new Error(`Filter ${filterIndex + 1} sync timeout`));
                        }
                    }, 60000); // 1 minute timeout per filter
                });
                
                // Store result for this filter
                filterResults.push({
                    filter,
                    name,
                    have: filterResult.have,
                    need: filterResult.need,
                    success: true
                });
                
                // Add to global collections
                allHave.push(...filterResult.have);
                allNeed.push(...filterResult.need);
                
                d.log(`Filter ${filterIndex + 1} complete - Have: ${filterResult.have.length}, Need: ${filterResult.need.length}`);
                
            } catch (error) {
                d.error(`Failed to process filter ${filterIndex + 1}:`, error);
                
                // Store error result
                filterResults.push({
                    filter,
                    name,
                    have: [],
                    need: [],
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        
        d.log('All filters processed, closing WebSocket');
        
    } finally {
        // Close WebSocket connection
        negentropyWs.close();
    }
    
    const result: MultiFilterResult = {
        filterResults,
        totalHave: [...new Set(allHave)], // Deduplicate across all filters
        totalNeed: [...new Set(allNeed)]  // Deduplicate across all filters
    };
    
    d.log(`Multi-filter sync complete - Total Have: ${result.totalHave.length}, Total Need: ${result.totalNeed.length}`);
    return result;
}