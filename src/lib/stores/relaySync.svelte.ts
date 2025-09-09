// src/lib/stores/relaySync.svelte.ts
import { createDebug } from '$lib/utils/debug.js';
import { getNDK } from './nostr.js';
import { performMultiFilterNegentropySync, type FilterWithEvents } from '$lib/utils/negentropyWebSocket.js';
import type { RelaySyncState, FilterSyncResult, SyncResult } from '$lib/types/negentropy.js';
import { 
    NDKSubscriptionCacheUsage, 
    type NDKEvent, 
    type NDKRelay,
    type NDKFilter,
    NDKRelaySet
} from '@nostr-dev-kit/ndk';

const debug = createDebug('relay-sync');

export interface FilterConfig {
    filter: NDKFilter;
    name?: string; // Optional descriptive name
}

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
    lastSyncResult = $state<SyncResult | undefined>(undefined);
    
    private relay: NDKRelay;
    private debug;
    private filters: FilterConfig[];
    
    constructor(relay: NDKRelay, filters: NDKFilter[] | FilterConfig[] = []) {
        this.relay = relay;
        this.url = relay.url;
        this.debug = debug.extend(new URL(relay.url).hostname);
        
        // Normalize filters to FilterConfig format
        this.filters = filters.map((filter, index) => {
            if ('filter' in filter) {
                return filter as FilterConfig;
            } else {
                return {
                    filter: filter as NDKFilter,
                    name: `Filter ${index + 1}`
                };
            }
        });
    }
    // Update filters
    setFilters(filters: NDKFilter[] | FilterConfig[]): void {
        const d = this.debug.extend('setFilters');
        d.log(`Setting ${filters.length} filters`);
        
        this.filters = filters.map((filter, index) => {
            if ('filter' in filter) {
                return filter as FilterConfig;
            } else {
                return {
                    filter: filter as NDKFilter,
                    name: `Filter ${index + 1}`
                };
            }
        });
        
        d.log('Filters set:', this.filters.map(f => f.name));
    }
    
    // Add a single filter
    addFilter(filter: NDKFilter, name?: string): void {
        const filterConfig: FilterConfig = {
            filter,
            name: name || `Filter ${this.filters.length + 1}`
        };
        this.filters.push(filterConfig);
    }
    
    // Get all local events matching a specific filter
    private async getLocalEventsForFilter(filter: NDKFilter): Promise<NDKEvent[]> {
        const d = this.debug.extend('getLocalEventsForFilter');
        const ndk = getNDK();
        
        try {
            d.log('Fetching local events with filter:', filter);
            const events = await ndk.fetchEvents(filter, {
                cacheUsage: NDKSubscriptionCacheUsage.ONLY_CACHE
            });
            
            const result = Array.from(events);
            d.log(`Found ${result.length} local events for filter`);
            return result;
        } catch (error) {
            d.warn('Failed to fetch events for filter:', error);
            return [];
        }
    }

    // Upload events using NDK
    private async uploadEvents(eventIds: string[], localEvents: NDKEvent[]): Promise<void> {
        const d = this.debug.extend('uploadEvents');
        d.log(`Uploading ${eventIds.length} events`);

        let ndk = getNDK();
        let relaySet: NDKRelaySet = new NDKRelaySet(new Set([this.relay]), ndk)
        
        let uploadedCount = 0;
        
        for (const eventId of eventIds) {
            const event = localEvents.find(e => e.id === eventId);
            if (event) {
                try {
                    d.log(`📤 Uploading event: ${eventId.slice(0, 8)}...`);
                    event.ndk = ndk;
                    await event.publish(relaySet);
                    uploadedCount++;
                    this.progress.message = `Uploaded ${uploadedCount}/${eventIds.length} events`;
                    d.log(`✅ Successfully uploaded: ${eventId.slice(0, 8)}...`);
                } catch (error) {
                    d.warn(`❌ Failed to upload event ${eventId}:`, error);
                }
            } else {
                d.warn(`Event not found in local events: ${eventId}`);
            }
        }
        
        d.log(`Upload complete: ${uploadedCount}/${eventIds.length} events uploaded successfully`);
    }
    
    // Download specific events using NDK
    private async downloadEvents(eventIds: string[]): Promise<void> {
        const d = this.debug.extend('downloadEvents');
        d.log(`Downloading ${eventIds.length} events`);
        
        if (eventIds.length === 0) {
            d.log('No events to download');
            return;
        }
        
        const ndk = getNDK();
        
        return new Promise((resolve) => {
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
    
    // Perform Negentropy reconciliation only (no upload/download) - now uses single WebSocket
    reconcileOnly = async (): Promise<FilterSyncResult[]> => {
        const d = this.debug.extend('reconcileOnly');
        d.log(`🔄 Starting reconciliation-only with relay: ${this.url}`);
        
        if (this.filters.length === 0) {
            throw new Error('No filters configured for sync');
        }
        
        try {
            // Reset state
            this.status = 'connecting';
            this.progress = {
                phase: 'init',
                message: 'Initializing reconciliation...',
                haveCount: 0,
                needCount: 0,
                totalProcessed: 0,
                roundCount: 0,
                currentFilter: 0,
                totalFilters: this.filters.length,
                startTime: Date.now()
            };
            this.error = undefined;
            
            d.log(`Processing ${this.filters.length} filters with single WebSocket connection`);
            
            // Prepare filters with their local events
            const filtersWithEvents: FilterWithEvents[] = [];
            
            for (let i = 0; i < this.filters.length; i++) {
                const filterConfig = this.filters[i];
                this.progress.message = `Fetching local events for ${filterConfig.name}...`;
                
                try {
                    const localEvents = await this.getLocalEventsForFilter(filterConfig.filter);
                    filtersWithEvents.push({
                        filter: filterConfig.filter,
                        localEvents,
                        name: filterConfig.name
                    });
                    d.log(`Prepared filter ${i + 1}: ${filterConfig.name} with ${localEvents.length} events`);
                } catch (error) {
                    d.error(`Failed to get local events for filter ${i + 1}:`, error);
                    // Still add the filter but with empty events
                    filtersWithEvents.push({
                        filter: filterConfig.filter,
                        localEvents: [],
                        name: filterConfig.name
                    });
                }
            }
            
            // Perform multi-filter sync with single WebSocket
            this.status = 'syncing';
            this.progress.phase = 'reconciling';
            this.progress.message = 'Starting reconciliation...';
            
            const result = await performMultiFilterNegentropySync(
                this.url,
                filtersWithEvents,
                (filterIndex, message, roundCount) => {
                    this.progress.currentFilter = filterIndex + 1;
                    this.progress.message = message;
                    this.progress.roundCount = roundCount;
                }
            );
            
            // Convert results to FilterSyncResult format
            const filterResults: FilterSyncResult[] = result.filterResults.map((filterResult, index) => ({
                filter: filterResult.filter,
                filterIndex: index,
                filterName: filterResult.name,
                have: filterResult.have,
                need: filterResult.need,
                localEvents: filtersWithEvents[index]?.localEvents || [],
                error: filterResult.success ? undefined : filterResult.error
            }));
            
            // Update overall progress
            this.progress.haveCount = result.totalHave.length;
            this.progress.needCount = result.totalNeed.length;
            this.progress.totalProcessed = result.totalHave.length + result.totalNeed.length;
            
            // Complete
            this.status = 'complete';
            this.progress.phase = 'done';
            this.progress.message = `Reconciliation complete: ${this.progress.haveCount} to upload, ${this.progress.needCount} to download`;
            this.progress.endTime = Date.now();
            
            d.log('✅ Multi-filter reconciliation completed successfully');
            return filterResults;
            
        } catch (error) {
            d.error(`❌ Reconciliation failed:`, error);
            this.status = 'error';
            this.error = error instanceof Error ? error.message : 'Unknown error';
            this.progress.message = `Error: ${this.error}`;
            this.progress.endTime = Date.now();
            throw error;
        }
    };
    
    // Full sync method (reconciliation + upload/download)
    sync = async (): Promise<SyncResult> => {
        const d = this.debug.extend('sync');
        d.log(`🔄 Starting full sync with relay: ${this.url}`);
        
        try {
            // First, perform reconciliation
            const filterResults = await this.reconcileOnly();
            
            // Collect all events to upload and download
            const allHave: string[] = [];
            const allNeed: string[] = [];
            const allLocalEvents: NDKEvent[] = [];
            
            for (const result of filterResults) {
                allHave.push(...result.have);
                allNeed.push(...result.need);
                allLocalEvents.push(...result.localEvents);
            }
            
            // Remove duplicates
            const uniqueHave = [...new Set(allHave)];
            const uniqueNeed = [...new Set(allNeed)];
            const uniqueLocalEvents = Array.from(
                new Map(allLocalEvents.map(e => [e.id, e])).values()
            );
            
            // Upload events we have that relay needs
            if (uniqueHave.length > 0) {
                this.status = 'uploading';
                this.progress.phase = 'uploading';
                this.progress.message = `Uploading ${uniqueHave.length} events...`;
                await this.uploadEvents(uniqueHave, uniqueLocalEvents);
            }
            
            // Download events we need from relay
            if (uniqueNeed.length > 0) {
                this.status = 'downloading';
                this.progress.phase = 'downloading';
                this.progress.message = `Downloading ${uniqueNeed.length} events...`;
                await this.downloadEvents(uniqueNeed);
            }
            
            // Complete
            this.status = 'complete';
            this.progress.phase = 'done';
            this.progress.message = `Sync complete: ${uniqueHave.length} uploaded, ${uniqueNeed.length} downloaded`;
            this.progress.endTime = Date.now();
            
            const syncResult: SyncResult = {
                totalHave: uniqueHave.length,
                totalNeed: uniqueNeed.length,
                filterResults,
                duration: this.duration,
                success: true
            };
            
            this.lastSyncResult = syncResult;
            d.log('✅ Full sync completed successfully');
            return syncResult;
            
        } catch (error) {
            d.error(`❌ Sync failed:`, error);
            this.status = 'error';
            this.error = error instanceof Error ? error.message : 'Unknown error';
            this.progress.message = `Error: ${this.error}`;
            this.progress.endTime = Date.now();
            
            const errorResult: SyncResult = {
                totalHave: 0,
                totalNeed: 0,
                filterResults: [],
                success: false,
                error: this.error
            };
            
            this.lastSyncResult = errorResult;
            throw error;
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
        this.lastSyncResult = undefined;
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
    
    // Get current filter info
    get currentFilterInfo(): string {
        if (this.progress.currentFilter && this.progress.totalFilters) {
            return `${this.progress.currentFilter}/${this.progress.totalFilters}`;
        }
        return '';
    }
}

// Helper function to create wallet-specific RelaySync
export function createWalletRelaySync(relay: NDKRelay, userPubkey: string): RelaySync {
    const walletFilters: FilterConfig[] = [
        {
            filter: { authors: [userPubkey], kinds: [17375, 7375, 7376] },
            name: 'Wallet Tokens and History Events'
        },
        {
            filter: { authors: [userPubkey], kinds: [5], "#k": ["7375"] },
            name: 'Delete Events'
        }
    ];
    
    return new RelaySync(relay, walletFilters);
}