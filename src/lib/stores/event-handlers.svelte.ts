import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { NDKCashuToken } from "@nostr-dev-kit/ndk";
import type { NDKCashuWallet } from "@nostr-dev-kit/ndk-wallet";
import { wallet } from "./wallet.svelte.js";
import { createDebug } from "$lib/utils/debug.js";

const debug = createDebug("wallet-event-handlers");

let _cumulativeTime = 0;
let _cumulativeCalls = 0;

export async function handleToken( event: NDKEvent) {
    const d = debug.extend("addToken");
    if (!wallet.ndkWallet) {
        d.error("ndkwallet is undefined")
        throw "ndkWallet is undefined 8(..."
    }

    if(wallet.ndkWallet.state.tokens.has(event.id)) return;

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
        wallet.ndkWallet.state.removeTokenId(deletedTokenId);
    }

    wallet.ndkWallet.state.addToken(token);
}

export async function handleEventDeletion(event: NDKEvent): Promise<void> {
    const d = debug.extend("handleEventDeletion");
    if (!wallet.ndkWallet) {
        d.error("ndkwallet is undefined")
        throw "ndkWallet is undefined 8(..."
    }
    const deletedIds = event.getMatchingTags("e").map((tag) => tag[1]);

    for (const deletedId of deletedIds) {
        wallet.ndkWallet.state.removeTokenId(deletedId);
    }
}

export async function handleQuote(this: NDKCashuWallet, event: NDKEvent) {
    const quote = await NDKCashuQuote.from(event);
    if (!quote) return;

    const deposit = NDKCashuDeposit.fromQuoteEvent(this, quote);
    if (this.depositMonitor.addDeposit(deposit)) {
        deposit.finalize();
    }
}