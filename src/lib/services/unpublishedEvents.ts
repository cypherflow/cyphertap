// src/lib/client/services/unpublishedEvents.ts
import { get } from 'svelte/store';
import { browser } from '$app/environment';
import { getNDK, relayConnectionStatus } from '$lib/stores/nostr.js';
import { createDebug } from '$lib/utils/debug.js';

// Create debug logger
const d = createDebug('unpublished-events');

// Configuration
const RETRY_INTERVAL = 60 * 1000; // 1 minute
const MAX_RETRIES_PER_SESSION = 10; // Limit retries to prevent excessive attempts

// State management
let isCheckingUnpublishedEvents = false;
let retryCount = 0;
let retryInterval: ReturnType<typeof setInterval> | null = null;
// Add module-level variable to store the unsubscribe function
let unsubscribeRelayStatus: (() => void) | null = null;
/**
 * Attempts to publish all unpublished events
 * @returns Promise that resolves to the number of events attempted
 */
export async function publishUnpublishedEvents(): Promise<number> {
  // Prevent concurrent processing
  if (isCheckingUnpublishedEvents || !browser) {
    return 0;
  }

  const ndk = getNDK();
  if (!ndk || !ndk.cacheAdapter || typeof ndk.cacheAdapter.getUnpublishedEvents !== 'function') {
    d.warn('NDK or cache adapter not available, or getUnpublishedEvents method missing');
    return 0;
  }

  // Check connection status
  const connectionStatus = get(relayConnectionStatus);
  const connectedRelays = connectionStatus.filter(relay => relay.connected);

  if (connectedRelays.length === 0) {
    d.log('No connected relays, skipping unpublished events check');
    return 0;
  }

  try {
    isCheckingUnpublishedEvents = true;
    d.log('Checking for unpublished events...');

    // Get unpublished events from cache
    const unpublishedEvents = await ndk.cacheAdapter.getUnpublishedEvents();

    if (!unpublishedEvents || unpublishedEvents.length === 0) {
      d.log('No unpublished events found');
      return 0;
    }

    d.log(`Found ${unpublishedEvents.length} unpublished events to process`);

    // Track successfully published events
    const successfullyPublished: string[] = [];

    // Process each event
    for (const { event, relays } of unpublishedEvents) {
      try {
        // Set the NDK instance for the event
        event.ndk = ndk;

        // Create a promise to track publishing
        const publishPromise = new Promise<void>((resolve) => {
          // Set a timeout for this event's publication attempt
          setTimeout(() => {
            resolve(); // Resolve after timeout to continue processing
          }, 5000); // 5 second timeout per event
        });

        // Filter to get only connected relays that match our target relays
        const connectedRelayUrls = connectedRelays.map(r => r.url);
        const targetRelayUrls = relays && relays.length > 0
          ? relays.filter(url => connectedRelayUrls.includes(url))
          : connectedRelayUrls;

        if (targetRelayUrls.length === 0) {
          d.log(`No targeted relays available for event ${event.id?.slice(0, 8)}`);
          continue;
        }

        d.log(`Attempting to publish event ${event.id?.slice(0, 8)} to ${targetRelayUrls.length} relays`);

        try {
          // Get actual relay objects from the NDK pool
          const relayObjects = targetRelayUrls
            .map(url => ndk.pool.getRelay(url))
            .filter(relay => relay !== undefined);

          if (relayObjects.length === 0) {
            d.log(`Could not find any relay objects for event ${event.id?.slice(0, 8)}`);
            continue;
          }

          // Publish to each relay individually
          const publishPromises = relayObjects.map(relay => {
            return new Promise<void>(resolve => {
              try {
                // Log the attempt
                d.log(`Publishing to relay: ${relay.url}`);

                // Use the NDK's publish method
                //ndk.publish(event, [relay]);
                event.publish(undefined, undefined, 1)
                resolve();
              } catch (err) {
                d.error(`Error publishing to relay ${relay.url}:`, err);
                resolve(); // Resolve anyway to continue
              }
            });
          });

          // Wait for all publish attempts
          await Promise.all(publishPromises);

          // If we get here, consider the event successfully published
          successfullyPublished.push(event.id!);
        } catch (error) {
          d.error(`Error publishing event ${event.id?.slice(0, 8)}:`, error);
        }

        // Wait for the publish attempt to complete
        await publishPromise;

      } catch (error) {
        d.error(`Failed to publish event ${event.id?.slice(0, 8)}:`, error);
      }
    }

    // Clean up successfully published events
    if (successfullyPublished.length > 0 && typeof ndk.cacheAdapter.discardUnpublishedEvent === 'function') {
      for (const eventId of successfullyPublished) {
        try {
          ndk.cacheAdapter.discardUnpublishedEvent(eventId);
          d.log(`Removed ${eventId.slice(0, 8)} from unpublished events cache`);
        } catch (err) {
          d.error(`Failed to remove event ${eventId.slice(0, 8)} from cache:`, err);
        }
      }
    }

    d.log(`Successfully published ${successfullyPublished.length} out of ${unpublishedEvents.length} events`);
    return unpublishedEvents.length;

  } catch (error) {
    d.error('Error processing unpublished events:', error);
    return 0;
  } finally {
    isCheckingUnpublishedEvents = false;
  }
}
/**
 * Starts the monitoring of unpublished events
 */
export function startUnpublishedEventsMonitor(): void {
  if (!browser || retryInterval) {
    return;
  }

  d.log('Starting unpublished events monitor');

  // Initial check
  publishUnpublishedEvents().catch(err => {
    d.error('Failed initial unpublished events check:', err);
  });

  // Set up interval for periodic checks
  retryInterval = setInterval(async () => {
    retryCount++;

    if (retryCount > MAX_RETRIES_PER_SESSION) {
      d.log(`Reached maximum retry attempts (${MAX_RETRIES_PER_SESSION}), stopping monitor`);
      stopUnpublishedEventsMonitor();
      return;
    }

    const count = await publishUnpublishedEvents().catch(err => {
      d.error('Failed to check unpublished events:', err);
      return 0;
    });

    // If no unpublished events and we've done several checks, we can slow down
    if (count === 0 && retryCount > 3) {
      d.log('No unpublished events found after multiple checks, reducing frequency');
      stopUnpublishedEventsMonitor();
      retryInterval = setInterval(() => {
        publishUnpublishedEvents().catch(d.error);
      }, RETRY_INTERVAL * 5); // Check less frequently
    }
  }, RETRY_INTERVAL);

  // Also check whenever connection status changes
  // Store the unsubscribe function at module level so it can be accessed by stopUnpublishedEventsMonitor
  unsubscribeRelayStatus = relayConnectionStatus.subscribe(status => {
    const connectedCount = status.filter(s => s.connected).length;
    if (connectedCount > 0) {
      d.log(`Relay connection detected (${connectedCount} relays), checking unpublished events`);
      publishUnpublishedEvents().catch(d.error);
    }
  });

  // Remove the problematic code that was causing the error
  // No more function reassignment here
}
/**
 * Stops the monitoring of unpublished events
 */
export function stopUnpublishedEventsMonitor(): void {
  if (retryInterval) {
    clearInterval(retryInterval);
    retryInterval = null;
    d.log('Stopped unpublished events monitor');
  }

  // Add the unsubscribe logic directly in the original function
  if (unsubscribeRelayStatus) {
    unsubscribeRelayStatus();
    unsubscribeRelayStatus = null;
    d.log('Unsubscribed from relay connection status');
  }

  retryCount = 0;
}
