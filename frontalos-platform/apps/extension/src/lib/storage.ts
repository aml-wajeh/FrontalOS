/**
 * lib/storage.ts
 *
 * Thin wrapper around chrome.storage.local — used instead of
 * chrome.storage.sync because the access token shouldn't silently
 * propagate to a user's other signed-in Chrome profiles/devices, and
 * instead of localStorage because that isn't shared between the popup,
 * the background service worker, and (if added later) any content script.
 */
import { DEFAULT_SETTINGS, STORAGE_KEYS, type StoredSession, type StoredSettings } from "./types";

export async function getSession(): Promise<StoredSession | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.session);
  const session = result[STORAGE_KEYS.session] as StoredSession | undefined;
  return session ?? null;
}

export async function setSession(session: StoredSession): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.session]: session });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.session);
}

export async function getSettings(): Promise<StoredSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const stored = result[STORAGE_KEYS.settings] as Partial<StoredSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function setSettings(settings: StoredSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}

/** Fires cb whenever the session changes (any writer — popup, background,
 * or the onMessageExternal connect handler). Used by the popup to refresh
 * its view live after a Connect completes in another tab. */
export function onSessionChanged(cb: (session: StoredSession | null) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (area !== "local" || !(STORAGE_KEYS.session in changes)) return;
    cb((changes[STORAGE_KEYS.session].newValue as StoredSession | undefined) ?? null);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
