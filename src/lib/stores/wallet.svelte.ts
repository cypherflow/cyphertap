import { createDebug } from "$lib/utils/debug.js";
import NDK, { NDKCashuMintList, NDKCashuToken, NDKEvent, NDKKind, NDKRelay, NDKRelaySet, NDKSubscriptionCacheUsage, type NDKCashuWalletTx, type NDKFilter } from "@nostr-dev-kit/ndk";
import { NDKCashuDeposit, NDKCashuWallet, NDKCashuWalletBackup, NDKWallet, NDKWalletStatus, type MintUrl } from "@nostr-dev-kit/ndk-wallet";
import { NDKCashuQuote } from "$lib/ndk/cashu/quote.js";
import { SvelteMap } from "svelte/reactivity";
import { lastSync } from "./user-preferences.svelte.js";
import { createWalletRelaySync, type RelaySync } from "./relaySync.svelte.js";
import { initNostr, nostr } from "./nostr.svelte.js";

let debug = createDebug("cyphertap-wallet");
let _cumulativeTime = 0;
let _cumulativeCalls = 0;


export const DEFAULT_MINTS = [
    "https://mint.cubabitcoin.org",
    "https://mint.cypherflow.ai",
    "https://mint.minibits.cash/Bitcoin"
]

export const DEFAULT_RELAYS = [
    "wss://relay.cypherflow.ai",
    "wss://relay.nostr.band",
    "wss://relay.snort.social,",
    "wss://relay.damus.io"

]

export const wallet = $state<{
    ndkWallet?: NDKCashuWallet,
    walletEvent?: NDKEvent,
    nutZapEvent?: NDKCashuMintList,
    history: NDKCashuWalletTx[],
    status: "idle" | "init" | "offline-ready" | "downloading" | "uploading" | "ready",
    filters: NDKFilter[], // fileter for wallet events [replaceable, token and tx, delete events]
    newKeyPair: boolean, // if this a completely new ndk wallet for a new nostr user with a new keypai
    counter: SvelteMap<NDKKind, number>
    balance: { total: number, max: number }
    relaySyncs: RelaySync[]
}>({
    ndkWallet: undefined,
    history: [],
    status: "idle",
    filters: [],
    nutZapEvent: undefined,
    walletEvent: undefined,
    newKeyPair: false,
    balance: {
        total: 0,
        max: 0
    },
    counter: new SvelteMap([
        [NDKKind.CashuWallet, 0],   // Main wallet and Mint config
        [NDKKind.CashuMintList, 0], // Mint and relay config
        [NDKKind.CashuToken, 0],    // Cashu Tokens
        [NDKKind.EventDeletion, 0], // [#k: "7375"] delete events
        [NDKKind.CashuQuote, 0],    // pending incoming ln invoices
        [NDKKind.CashuWalletTx, 0], // transaction history
        [NDKKind.Nutzap, 0]         // Nutzap receipts for incoming zaps
    ]),
    relaySyncs: []
});

export async function logoutWallet() {
    const d = debug.extend("logoutWallet")

    wallet.ndkWallet = undefined
    wallet.history = [],
        wallet.status = "idle"
    wallet.filters = []
    wallet.nutZapEvent = undefined
    wallet.walletEvent = undefined
    wallet.newKeyPair = false;
    wallet.counter = new SvelteMap([
        [NDKKind.CashuWallet, 0],   // Main wallet and Mint config
        [NDKKind.CashuMintList, 0], // Mint and relay config
        [NDKKind.CashuToken, 0],    // Cashu Tokens
        [NDKKind.EventDeletion, 0], // [#k: "7375"] delete events
        [NDKKind.CashuQuote, 0],    // pending incoming ln invoices
        [NDKKind.CashuWalletTx, 0], // transaction history
        [NDKKind.Nutzap, 0]         // Nutzap receipts for incoming zaps
    ])
    wallet.relaySyncs = [];
    d.log("wallet cleared and logged out");

}


export async function initWallet() {
    const d = debug.extend('initWallet')

    wallet.status = "init";
    // init ndk
    await initNostr();
    if (!nostr.activeUser || !nostr.ndk) {
        d.error("No active user found in nostr.ndk, cannot init wallet without user");
        throw "We need a user, set a signer in ndk first."
    }

    // initialize a fresh cashu wallet
    wallet.ndkWallet = new NDKCashuWallet(nostr.ndk);
    d.log("Started with new NDKCashuWallet: ", $state.snapshot(wallet));

    // Add user relays
    let relaySet = new NDKRelaySet(new Set(), nostr.ndk);
    nostr.ndk.pool.relays.values().forEach((relay: NDKRelay) => {
        relaySet.addRelay(relay)
        d.log("new relay added to wallet relaySet: ", relay)
    });
    wallet.ndkWallet.relaySet = relaySet;
    wallet.filters = [{
        authors: [nostr.activeUser.pubkey],
        kinds: [17375, 10019]
    }, {
        authors: [nostr.activeUser.pubkey],
        kinds: [7374, 7375, 7376]
    }, {
        authors: [nostr.activeUser.pubkey],
        kinds: [5],
        "#k": ["7375"]
    }];

    // Set up offline-ready wallet
    if (wallet.newKeyPair) {
        d.log("Setting up a fresh new nip-60 wallet with default relays and mints: ", DEFAULT_RELAYS, DEFAULT_MINTS);
        await updateWallet(DEFAULT_MINTS, NDKRelaySet.fromRelayUrls(DEFAULT_RELAYS, nostr.ndk));
    } else {
        // User logged in with their own pubkey
        // User may have an existing nip-60 wallet
        d.log("Loading wallet from cache with filter: ", $state.snapshot(wallet.filters));
        await loadWalletFromCache();
        d.log("Loaded wallet from cache: ", $state.snapshot(wallet))

        if (!wallet.ndkWallet) {
            d.log("There were no wallet events on local cache, setting up a new one...");
            wallet.ndkWallet = new NDKCashuWallet(nostr.ndk);
        }
    }

    wallet.status = "offline-ready";

    d.log("Offline wallet ready! all local data has been loaded.")

    d.log("Now we start nostr connection")
    await nostr.ndk.connect();

    d.warn("Stopped awaiting on nostr.ndk.connect()")

    d.log("Staring Negentropy sync with know wallet relays: ", wallet.ndkWallet.relaySet)
    if (!wallet.ndkWallet.relaySet) {
        d.error("wallet does not have a relay set, something went wrong...")
        return
    }

    // Create a relaySync rune for each relay in wallet RelaySet
    const pubkey = nostr.ndk.activeUser?.pubkey;
    if (pubkey) {
        wallet.ndkWallet.relaySet.relays.forEach((relay: NDKRelay) => {
            wallet.relaySyncs.push(createWalletRelaySync(relay, pubkey))
            d.log("Created relaySync for relay: ", relay.url);
        })
    }

    // start sync
    d.log("Starting negentroy sync of all relays for wallet events")
    wallet.relaySyncs.forEach(async (relaySync) => {
        const result = await relaySync.sync();

        if (result.success) {
            d.log("Negentropy sync SUCCESS with relay: ", relaySync.url);
            if (lastSync.current == 0) {
                lastSync.current = Date.now()
                d.log("PersistedRune: lastSync")
            }
        } else {
            d.log("Negentropy sync FAILED with relay: ", relaySync.url);
        }
    }
    )

    // }

    // Set up event listeners for emmited wallet events
    wallet.ndkWallet.on('balance_updated', () => {
        const d = debug.extend('on:balance_updated');

        if (wallet.ndkWallet?.balance) {
            wallet.balance.total = wallet.ndkWallet.balance.amount;
            wallet.balance.max = Math.max(...Object.values(wallet.ndkWallet.mintBalances));
            d.log("wallet.balance:", $state.snapshot(wallet.balance));
        }
    })
    // Start wallet sync since last wallet ready;
    d.log("Starting wallet sync with wallet.start()...")
    // wallet.ndkWallet.start();



    // Do negentropy sync with all relays on wallet RelaySet

    try {
    } catch (e) {
        d.error("something happened, error: ", error.message);
        throw e;
    }

};

export async function updateWallet(mints?: string[], relaySet?: NDKRelaySet) {
    // update and publish wallet events;
    const d = debug.extend('updateWallet');

    if (!nostr.ndk){
        d.error("nostr.ndk does not exist, canceling update")
        return;
    }

    if (!wallet.ndkWallet) wallet.ndkWallet = new NDKCashuWallet(nostr.ndk);
    if (!wallet.nutZapEvent) wallet.nutZapEvent = new NDKCashuMintList(nostr.ndk);

    // update wallet.ndkWallet
    try {
        if (relaySet) {
            d.log("Updating relays in wallet (kind:17375) and nutzap info (kind:10019) events: ", relaySet.relayUrls);
            wallet.ndkWallet.relaySet = relaySet;
            wallet.nutZapEvent.relays = relaySet.relayUrls;
        }
        if (mints) {
            d.log("Updating mints in wallet (kind:17375) and nutzap info (kind:10019) events", mints);
            wallet.ndkWallet.mints = mints;
            wallet.nutZapEvent.mints = mints;
        }
        // Setup Pay-2-Public-Key if it's not already there
        await wallet.ndkWallet.getP2pk();
        wallet.nutZapEvent.p2pk = wallet.ndkWallet.p2pk;
        wallet.walletEvent = await wallet.ndkWallet.backup();
    } catch (error) {
        d.error("while updating the wallet", error)
        throw error
    }

    // Publish events
    try {

        d.log("Publishing NIP-60 Wallet event (kind:17375)... ", wallet.walletEvent);
        const walletPublishedRelays = await wallet.ndkWallet.publish()
        d.log("✅ Published Wallet event to: ", walletPublishedRelays);

        d.log("Publishing NIP-61 Nutzap info event (kind:10019)...", wallet.nutZapEvent);
        const nutzapPublishedRelays = await wallet.nutZapEvent.publish(wallet.ndkWallet.relaySet);
        d.log("✅ Published Nutzap info event to: ", nutzapPublishedRelays);
    } catch (error) {
        d.error("while publishing wallet events ", error);
        throw error
    }

}

export async function handleWalletEvent(event: NDKEvent) {
    const d = debug.extend("handleWalleEvent");
    if (event.kind == 7375) {
        await handleCashuToken(event);
    } else if (event.kind == 7374) {
        await handleCashuQuote(event);
    } else if (event.kind == 5) {
        await handleEventDeletion(event);
    } else if (event.kind == 10019) {
        await handleCashuMintList(event)
    } else if (event.kind == 17375) {
        await handleCashuWallet(event)
    }
}

export async function loadWalletFromCache() {
    // return true if there was a local wallet found in in cache
    const d = debug.extend("loadWalletFromCache")
    if (!nostr.ndk || !nostr.activeUser) {
        d.error("No active user found in ndk instance, cannot get local wallet events without user");
        throw "We need a user, set a signer in ndk first."
    }

    d.log("Fetching local wallet events with filter ", wallet.filters);
    const walletEvents = await nostr.ndk.fetchEvents(wallet.filters, {
        cacheUsage: NDKSubscriptionCacheUsage.ONLY_CACHE
    });

    const result = Array.from(walletEvents);
    // handle wallet events from cache
    d.log(`Loaded ${result.length} local wallet events`);
    // First handle replaceable events kinds [17375, 10019]
    result.filter((event: NDKEvent) => wallet.filters[0].kinds?.includes(event.kind)).map(handleWalletEvent);
    // Handle token and transaction events;
    result.filter((event: NDKEvent) => wallet.filters[1].kinds?.includes(event.kind)).map(handleWalletEvent);
    // Handle delete events;
    result.filter((event: NDKEvent) => wallet.filters[2].kinds?.includes(event.kind)).map(handleWalletEvent);

    return
}

function addToCount(kind: NDKKind, amount?: number) {
    let n = amount || 1;
    let count = wallet.counter.get(kind) || 0;
    wallet.counter.set(kind, count + n);
}

export async function handleCashuMintList(event: NDKEvent) {
    const d = debug.extend("handleNutzapInfo");
    // Check if nutzap event
    if (event.kind !== NDKKind.CashuMintList) return;

    // check that it is older that current 
    const lastCreated = wallet.nutZapEvent?.created_at || 0;
    if ((event.created_at || 0) < lastCreated) {
        d.log("Nutzap event is older than current one, ignoring it", wallet.nutZapEvent, event)
        return;
    };

    let ndk = getNDK();
    // add new nutzap info event
    wallet.nutZapEvent = new NDKCashuMintList(ndk, event);
    if (wallet.nutZapEvent.relaySet && wallet.ndkWallet) {
        // update wallet relays from this list
        wallet.ndkWallet.relaySet = wallet.nutZapEvent.relaySet;
        d.log("updated wallet relays with nutzap event: ", $state.snapshot(wallet.ndkWallet)?.relaySet)
    }

    addToCount(NDKKind.CashuMintList);
}

export async function handleCashuWallet(event: NDKEvent) {
    const d = debug.extend("handleCashuWallet");
    // Check wallet event
    if (event.kind !== NDKKind.CashuWallet) return;

    let ndk = getNDK();

    // If no wallet event already set, then use this event and be done with it
    if (!wallet.walletEvent || !wallet.ndkWallet) {
        d.log("Setting ndkWallet from first wallet event seen: ", event);
        event.ndk = ndk;
        wallet.ndkWallet = await NDKCashuWallet.from(event);
        wallet.walletEvent = event;
        addToCount(NDKKind.CashuWallet);
        return
    }

    // Check incomming event is older than current
    if ((event.created_at || 0) <= (wallet.walletEvent.created_at || 0)) {
        d.log("Incoming wallet event is older that current one. ignore.");
        return
    }

    // update wallet.ndkWallet mints and privkeys if any
    event.ndk = ndk;
    let walletEvent = await NDKCashuWallet.from(event);

    if (!walletEvent?.mints) {
        d.warn("Ignoring wallet event (kind:17375): does not have any mints.")
        return
    }

    wallet.ndkWallet.mints = walletEvent.mints;
    wallet.ndkWallet.privkeys = walletEvent.privkeys;
    d.log("Updated wallet with latest mint list and privkeys");

    // update count
    addToCount(NDKKind.CashuWallet);
}

export async function handleCashuToken(event: NDKEvent) {
    const d = debug.extend("handleCashuToken");
    // Check wallet event
    if (event.kind !== NDKKind.CashuToken) return;


    let ndk = getNDK();
    if (!wallet.ndkWallet) wallet.ndkWallet = new NDKCashuWallet(ndk)

    if (wallet.ndkWallet.state.tokens.has(event.id)) {
        d.log(`Repeated token event: ${event.id.slice(0, 8)}`)
        return;
    }

    const startTime = Date.now();

    const token = await NDKCashuToken.from(event);
    if (!token) {
        _cumulativeTime += Date.now() - startTime;
        _cumulativeCalls++;
        return;
    }

    _cumulativeTime += Date.now() - startTime;
    _cumulativeCalls++;

    for (const deletedTokenId of token.deletedTokens) {
        d.log("deleting tokenId: ", deletedTokenId)
        wallet.ndkWallet.state.removeTokenId(deletedTokenId);
    }

    d.log("Adding token to wallet state ", token)
    wallet.ndkWallet.state.addToken(token);
    // update counter of processed events
    addToCount(NDKKind.CashuToken);
    // update total balance
    if (wallet.ndkWallet.balance?.amount) {
        wallet.balance.total = wallet.ndkWallet.balance.amount
        d.log("updated total wallet balance", $state.snapshot(wallet.balance.total));

    }
    // update max balance per mint
    let mintBalances = wallet.ndkWallet.mintBalances;
    wallet.balance.max = Math.max(...Object.values(mintBalances));
    d.log("Updated max wallet balance: ", $state.snapshot(wallet.balance.max))
}

export async function handleEventDeletion(event: NDKEvent): Promise<void> {
    const d = debug.extend("handleEventDeletion");

    // Check this is an event deletion for a token event.
    if (event.kind !== NDKKind.EventDeletion || event.tagValue("#k") !== "7375") return;

    let ndk = getNDK();
    if (!wallet.ndkWallet) {
        // There is nothing to delete from a blank wallet
        wallet.ndkWallet = new NDKCashuWallet(ndk);
        return
    }

    const deletedIds = event.getMatchingTags("e").map((tag) => tag[1]);

    for (const deletedId of deletedIds) {
        d.log("Removing TokenId from wallet state: ", deletedId)
        wallet.ndkWallet.state.removeTokenId(deletedId);
    }
    addToCount(NDKKind.EventDeletion);
}

export async function handleCashuQuote(event: NDKEvent) {
    const d = debug.extend("handleCashuQuote");

    // Check quote event
    if (event.kind !== NDKKind.CashuQuote) return;

    let ndk = getNDK();
    if (!wallet.ndkWallet) wallet.ndkWallet = new NDKCashuWallet(ndk)

    const quote = await NDKCashuQuote.from(event);
    if (!quote) {
        d.warn("Failed to parse cashu quote from: ", event);
        return
    }

    d.log("Adding CashuQuote event to wallet: ", quote);
    const deposit = NDKCashuDeposit.fromQuoteEvent(getNDKWallet(), quote);
    d.log("Adding deposit to wallet deposit monitor: ", deposit)
    if (wallet.ndkWallet.depositMonitor.addDeposit(deposit)) {
        deposit.finalize();
    }
}

function getNDKWallet(): NDKCashuWallet {
    const d = debug.extend("getNDKWallet")
    let ndk = getNDK();
    if (!wallet.ndkWallet) {
        wallet.ndkWallet = new NDKCashuWallet(ndk);
    }
    return wallet.ndkWallet
}

