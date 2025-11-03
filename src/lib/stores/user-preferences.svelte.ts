import { PersistedState } from "runed";

export const lastSync = new PersistedState<number | undefined>("lastSync", undefined);
export const encryptedKey = new PersistedState<string>("ncrypt", "");
export const extensionLogin = new PersistedState<boolean>("nip-07", false);