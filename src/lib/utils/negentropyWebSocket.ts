// src/lib/utils/negentropyWebSocket.ts
import { createDebug } from '$lib/utils/debug.js';
import { loadNegentropy, getNegentropy } from './negentropy.js';
import type { NDKFilter, NDKEvent } from '@nostr-dev-kit/ndk';
import type { NegentropyResult } from '$lib/types/negentropy.js';

const debug = createDebug('negentropy:ws');

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
    d.log(`Creating storage from ${events.length} events`);
    
    const { NegentropyStorageVector } = getNegentropy();
    const storage = new NegentropyStorageVector();
    
    for (const event of events) {
        const timestamp = event.created_at || 0;
        const id = event.id;
        
        if (id) {
            storage.insert(timestamp, id);
            d.log(`Inserted event: ${id.slice(0, 8)}... timestamp: ${timestamp}`);
        }
    }
    
    storage.seal();
    d.log('Storage sealed and ready');
    return storage;
}

export function combineFilters(filters: import('$lib/types/negentropy.js').NegentropyFilters): NDKFilter {
    const d = debug.extend('combineFilters');
    const authors = filters.tokenEvents.authors!;
    
    const combined = {
        authors,
        kinds: [7375, 5, 17375, 7376],
    };
    
    d.log('Combined filter:', combined);
    return combined;
}

export async function performNegentropySync(
    relayUrl: string, 
    filter: NDKFilter, 
    localEvents: NDKEvent[],
    onProgress?: (message: string, roundCount: number) => void
): Promise<NegentropyResult> {
    const d = debug.extend('performSync');
    d.log(`Starting Negentropy sync with ${relayUrl}`);
    
    // Ensure Negentropy is loaded
    await loadNegentropy();
    const { Negentropy } = getNegentropy();
    
    // Create storage and negentropy instance
    const storage = await createStorageFromEvents(localEvents);
    const negentropy = new Negentropy(storage, 50_000);
    
    // Create WebSocket connection
    const negentropyWs = new NegentropyWebSocket(relayUrl);
    await negentropyWs.connect();
    
    const subscriptionId = `neg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    d.log(`Generated subscription ID: ${subscriptionId}`);
    
    const allHave: string[] = [];
    const allNeed: string[] = [];
    let roundCount = 0;
    
    return new Promise((resolve, reject) => {
        let isComplete = false;
        
        const handleNegentropyMessage = async (message: any[]) => {
            const msgD = d.extend('handleMessage');
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
                    msgD.log(`📍 Reconciliation round ${roundCount}`);
                    onProgress?.(`Reconciliation round ${roundCount}`, roundCount);
                    
                    const response = rest[0];
                    msgD.log('Calling negentropy.reconcile with response length:', response.length);
                    
                    const [newMsg, have, need] = await negentropy.reconcile(response);
                    msgD.log(`Reconcile result - newMsg: ${newMsg ? newMsg.length : 'null'}, have: ${have.length}, need: ${need.length}`);
                    
                    // Accumulate results
                    allHave.push(...have);
                    allNeed.push(...need);
                    
                    // Continue reconciliation or finish
                    if (newMsg !== null) {
                        msgD.log('Continuing reconciliation...');
                        const nextMessage = JSON.stringify(["NEG-MSG", subscriptionId, newMsg]);
                        negentropyWs.send(nextMessage);
                        msgD.log('Sent next NEG-MSG');
                    } else {
                        // Reconciliation complete
                        msgD.log('🎉 Negentropy reconciliation complete!');
                        isComplete = true;
                        
                        // Send NEG-CLOSE
                        const closeMessage = JSON.stringify(["NEG-CLOSE", subscriptionId]);
                        negentropyWs.send(closeMessage);
                        msgD.log('Sent NEG-CLOSE');
                        
                        // Clean up and resolve
                        negentropyWs.removeMessageHandler(subscriptionId);
                        negentropyWs.close();
                        
                        resolve({
                            have: [...new Set(allHave)], // Deduplicate
                            need: [...new Set(allNeed)]  // Deduplicate
                        });
                    }
                }
            } catch (error) {
                msgD.error('Error handling negentropy message:', error);
                isComplete = true;
                negentropyWs.removeMessageHandler(subscriptionId);
                negentropyWs.close();
                reject(error);
            }
        };
        
        // Register message handler
        negentropyWs.addMessageHandler(subscriptionId, handleNegentropyMessage);
        
        // Start protocol
        negentropy.initiate().then(msg => {
            const openMessage = JSON.stringify(["NEG-OPEN", subscriptionId, filter, msg]);
            negentropyWs.send(openMessage);
            d.log('Sent NEG-OPEN message');
        }).catch(reject);
        
        // Timeout
        setTimeout(() => {
            if (!isComplete) {
                d.error('Negentropy sync timeout');
                negentropyWs.removeMessageHandler(subscriptionId);
                negentropyWs.close();
                reject(new Error('Negentropy sync timeout'));
            }
        }, 120000);
    });
}