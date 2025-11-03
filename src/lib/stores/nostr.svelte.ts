import { createDebug } from "$lib/utils/debug.js"
import { NDKNip07Signer, NDKPrivateKeySigner, type NDKSigner, type NDKUser } from "@nostr-dev-kit/ndk"
import NDK from "@nostr-dev-kit/ndk"
import { BROWSER } from "esm-env"
import { encryptedKey, extensionLogin } from "./user-preferences.svelte.js"
import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie"
import { DEFAULT_RELAYS } from "./wallet.svelte.js"

const debug = createDebug("nostr-rune")

export const nostr = $state<{
    ndk?: NDK
    activeUser?: NDKUser
    signer?: NDKSigner
}>({
    ndk: undefined,
    activeUser: undefined,
    signer: undefined
})

export async function initNostr() {
    const d = debug.extend('initNostr');

    // Check we are client side
    if (!BROWSER) {
        d.warn('Not in browser environment, skipping auto-login');
        return undefined
    }

    // Check if already init
    if (!nostr.ndk ) {
        d.log("Already initialized, nothing to do.");
        return
    }

    // Get signer if available
    await autoLogin();

    // Set up cache 
    let cacheAdapter = undefined;
    if (nostr.activeUser){
        cacheAdapter = new NDKCacheAdapterDexie({
            dbName: `NDKCache-${nostr.activeUser.npub.slice(0,8)}`,
            saveSig: true
        })
        d.log("Set up cache adapter")
    } else {
        d.warn("No active user, unable to start a cache adapter")
    }

    // Create ndk
    nostr.ndk = new NDK({
        explicitRelayUrls: DEFAULT_RELAYS,
        enableOutboxModel: true,
        autoFetchUserMutelist: true,
        autoConnectUserRelays: true,
        cacheAdapter: cacheAdapter
    })

    d.log("Adding signer to nostr.ndk...", $state.snapshot(nostr));
    nostr.ndk.signer = nostr.signer;

    d.log("Checking active user is set up: ", nostr.ndk.activeUser);
}


export async function autoLogin() {
    const d = debug.extend("autoLogin");

    if (encryptedKey.current) {
        d.log('Found key in local storage: ', encryptedKey.current)
        nostr.signer = new NDKPrivateKeySigner(encryptedKey.current);
    } else if (extensionLogin.current) {
        d.log('Found extension login, attempting nip-07 login');
        nostr.signer = new NDKNip07Signer();
    } else {
        d.log('No previous logins, skipping autologin');
        return
    }

    nostr.activeUser = await nostr.signer.user()
    d.log("Set up nostr.activeUser to: ", nostr.activeUser)

    return
}
