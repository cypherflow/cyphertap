// src/lib/stores/relaySync.svelte.ts
import { createDebug } from '$lib/utils/debug.js';
import { getNDK } from './nostr.js';
import { performNegentropySync, combineFilters } from '$lib/utils/negentropyWebSocket.js';
import type { RelaySyncState, NegentropyFilters } from '$lib/types/negentropy.js';
import { 
    NDKSubscriptionCacheUsage, 
    type NDKEvent, 
    type NDKRelay,
    NDKRelaySet
} from '@nostr-dev-kit/ndk';

const debug = createDebug('relay-sync');

export class RelaySync {
    url = $state('');
    status = $state<RelaySyncState['status']>('idle');
    progress = $state<RelaySyncState['progress']>({
        phase: 'init',
        message: 'Ready to sync',
        haveCount: 0,
        needCount: 0,
        totalProcessed: 0,
        roundCount: 0
    });
    error = $state<string | undefined>(undefined);
    subscriptionId = $state<string | undefined>(undefined);
    negentropy = $state<any>(undefined);
    
    private relay: NDKRelay;
    private debug;
    
    constructor(relay: NDKRelay) {
        this.relay = relay;
        this.url = relay.url;
        this.debug = debug.extend(new URL(relay.url).hostname);
    }
    
    // Generate filters for wallet-related events
    private generateWalletFilters(userPubkey: string): NegentropyFilters {
        const d = this.debug.extend('generateFilters');
        d.log(`Generating filters for user: ${userPubkey}`);
        
        const filters = {
            tokenEvents: {
                authors: [userPubkey],
                kinds: [7375]
            },
            deleteEvents: {
                authors: [userPubkey],
                kinds: [5],
                // "#k": ["7375"]
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
    
    // Get all local events matching the filters
    private async getLocalEvents(filters: NegentropyFilters): Promise<NDKEvent[]> {
        const d = this.debug.extend('getLocalEvents');
        const ndk = getNDK();
        
        d.log('Fetching local events from cache...');
        
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
    
    // Upload events using NDK
    private async uploadEvents(eventIds: string[], localEvents: NDKEvent[]): Promise<void> {
        const d = this.debug.extend('uploadEvents');
        d.log(`Uploading ${eventIds.length} events`);
        
        this.status = 'uploading';
        this.progress.phase = 'uploading';
        this.progress.message = `Uploading ${eventIds.length} events...`;
        
        for (const eventId of eventIds) {
            const event = localEvents.find(e => e.id === eventId);
            if (event) {
                try {
                    d.log(`📤 Uploading event: ${eventId.slice(0, 8)}...`);
                    await this.relay.publish(event);
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
    private async downloadEvents(eventIds: string[]): Promise<void> {
        const d = this.debug.extend('downloadEvents');
        d.log(`Downloading ${eventIds.length} events`);
        
        if (eventIds.length === 0) {
            d.log('No events to download');
            return;
        }
        
        this.status = 'downloading';
        this.progress.phase = 'downloading';
        this.progress.message = `Downloading ${eventIds.length} events...`;
        
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
                    cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                    relaySet: NDKRelaySet.fromRelayUrls([this.relay.url], ndk)
                },
            );
            
            subscription.on('event', (event: NDKEvent) => {
                receivedCount++;
                this.progress.message = `Downloaded ${receivedCount}/${targetCount} events`;
                d.log(`📥 Downloaded event ${receivedCount}/${targetCount}: ${event.id?.slice(0, 8)}...`);
            });
            
            subscription.on('eose', () => {
                clearTimeout(timeout);
                d.log(`✅ Download complete: ${receivedCount}/${targetCount} events received`);
                resolve();
            });
        });
    }
    
    // Main sync method
    sync = async (): Promise<void> => {
        const d = this.debug.extend('sync');
        d.log(`🔄 Starting sync with relay: ${this.url}`);
        
        try {
            // Reset state
            this.status = 'connecting';
            this.progress = {
                phase: 'init',
                message: 'Initializing sync...',
                haveCount: 0,
                needCount: 0,
                totalProcessed: 0,
                roundCount: 0,
                startTime: Date.now()
            };
            this.error = undefined;
            
            const ndk = getNDK();
            const user = ndk.activeUser;
            
            if (!user?.pubkey) {
                throw new Error('User not initialized');
            }
            
            d.log(`Starting sync for user: ${user.pubkey}`);
            
            // Get local events
            this.progress.message = 'Fetching local events...';
            this.progress.phase = 'init';
            
            const filters = this.generateWalletFilters(user.pubkey);
            const localEvents = await this.getLocalEvents(filters);
            
            this.progress.message = `Found ${localEvents.length} local events`;
            d.log(`Found ${localEvents.length} local events`);
            
            // Perform Negentropy sync
            this.status = 'syncing';
            this.progress.phase = 'reconciling';
            this.progress.message = 'Starting reconciliation...';
            
            const combinedFilter = combineFilters(filters);
            const result = await performNegentropySync(
                this.url,
                combinedFilter, 
                localEvents,
                (message, roundCount) => {
                    this.progress.message = message;
                    this.progress.roundCount = roundCount;
                }
            );
            
            d.log(`Negentropy complete - Have: ${result.have.length}, Need: ${result.need.length}`);
            
            // Update counts
            this.progress.haveCount = result.have.length;
            this.progress.needCount = result.need.length;
            this.progress.totalProcessed = result.have.length + result.need.length;
            
            // Upload events we have that relay needs
            if (result.have.length > 0) {
                await this.uploadEvents(result.have, localEvents);
            }
            
            // Download events we need from relay
            if (result.need.length > 0) {
                await this.downloadEvents(result.need);
            }
            
            // Complete
            this.status = 'complete';
            this.progress.phase = 'done';
            this.progress.message = `Sync complete: ${this.progress.haveCount} uploaded, ${this.progress.needCount} downloaded`;
            this.progress.endTime = Date.now();
            
            d.log('✅ Sync completed successfully');
            
        } catch (error) {
            d.error(`❌ Sync failed:`, error);
            this.status = 'error';
            this.error = error instanceof Error ? error.message : 'Unknown error';
            this.progress.message = `Error: ${this.error}`;
            this.progress.endTime = Date.now();
        }
    };
    
    // Clear/reset state
    reset = (): void => {
        this.status = 'idle';
        this.progress = {
            phase: 'init',
            message: 'Ready to sync',
            haveCount: 0,
            needCount: 0,
            totalProcessed: 0,
            roundCount: 0
        };
        this.error = undefined;
        this.subscriptionId = undefined;
        this.negentropy = undefined;
    };
    
    // Get sync duration
    get duration(): number | undefined {
        if (this.progress.startTime && this.progress.endTime) {
            return this.progress.endTime - this.progress.startTime;
        }
        return undefined;
    }
    
    // Check if currently syncing
    get isSyncing(): boolean {
        return this.status === 'syncing' || 
               this.status === 'uploading' || 
               this.status === 'downloading' ||
               this.status === 'connecting';
    }
}