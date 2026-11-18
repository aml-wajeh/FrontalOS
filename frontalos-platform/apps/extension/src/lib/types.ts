/**
 * lib/types.ts
 *
 * Shapes shared between the popup and the background service worker.
 * Deliberately narrow — this extension only ever reads a handful of
 * CORTIX API endpoints (see lib/cortixApi.ts), so these mirror just the
 * fields it actually uses rather than the full API response shape.
 */

/** What's stored in chrome.storage.local under STORAGE_KEYS.session. */
export interface StoredSession {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms. Used to show a "reconnect" prompt before a call 401s. */
  expiresAt: number;
  /** Best-effort — see README "Known limitation: patient ID". Editable
   * from the popup's Settings view. */
  patientId: number;
  fullName?: string;
}

/** What's stored in chrome.storage.local under STORAGE_KEYS.settings. */
export interface StoredSettings {
  /** Base URL of services/cortix-api, no trailing slash, e.g.
   * "http://localhost:8000". Defaults to the same value as the platform's
   * NEXT_PUBLIC_CORTIX_API_URL default (see .env.example). */
  apiBaseUrl: string;
  /** Origin of apps/web, used to build the "Open Full Dashboard" link and
   * the Connect-flow tab. No trailing slash. */
  webAppOrigin: string;
  notificationsEnabled: boolean;
}

export const STORAGE_KEYS = {
  session: "frontalos_session",
  settings: "frontalos_settings",
} as const;

export const DEFAULT_SETTINGS: StoredSettings = {
  apiBaseUrl: "http://localhost:8000",
  webAppOrigin: "http://localhost:3000",
  notificationsEnabled: true,
};

export interface RewardWalletBalance {
  patient_id: number;
  balance: number;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

/** Message shape posted from the web app's /extension-connect page via
 * chrome.runtime.sendMessage(EXTENSION_ID, ...). See background.ts's
 * onMessageExternal listener and apps/web's extension-connect page. */
export interface ConnectMessage {
  type: "FRONTALOS_CONNECT";
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  patientId: number;
  fullName?: string;
}
