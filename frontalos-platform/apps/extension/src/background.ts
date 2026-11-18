/**
 * background.ts — Manifest V3 service worker.
 *
 * Two jobs, both intentionally small:
 *   1. Accept the Connect-flow handoff from apps/web's /extension-connect
 *      page (chrome.runtime.onMessageExternal — see manifest.json's
 *      "externally_connectable" and README "Auth flow").
 *   2. Every ALARM_PERIOD_MINUTES, poll GET /api/v1/notifications and
 *      surface anything new as a native browser notification — gentle,
 *      off by default toggle respected, never more than one alarm in
 *      flight.
 *
 * Deliberately NOT here: the Live AI Observer's webcam session. A service
 * worker gets suspended by the browser whenever it's idle, which would
 * silently kill a long-lived webcam WebSocket — that's exactly the
 * "fragile browser-permission workaround" the task said to skip. See
 * README "What this extension does not do".
 */
import { getNotifications } from "./lib/cortixApi";
import { getSession, getSettings, setSession } from "./lib/storage";
import type { ConnectMessage } from "./lib/types";

const ALARM_NAME = "frontalos-notification-poll";
const ALARM_PERIOD_MINUTES = 20;
const SEEN_IDS_KEY = "frontalos_seen_notification_ids";

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
});

// externally_connectable restricts the sender to origins listed in
// manifest.json, so this only ever fires for the platform's own web app.
chrome.runtime.onMessageExternal.addListener((message: ConnectMessage, _sender, sendResponse) => {
  if (message?.type !== "FRONTALOS_CONNECT") return;

  setSession({
    accessToken: message.accessToken,
    refreshToken: message.refreshToken,
    expiresAt: message.expiresAt,
    patientId: message.patientId,
    fullName: message.fullName,
  })
    .then(() => sendResponse({ ok: true }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));

  return true; // keep the message channel open for the async sendResponse
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    pollNotifications();
  }
});

async function pollNotifications(): Promise<void> {
  const [session, settings] = await Promise.all([getSession(), getSettings()]);
  if (!session || !settings.notificationsEnabled) return;

  try {
    const items = await getNotifications();
    const unread = items.filter((n) => !n.isRead);
    if (unread.length === 0) return;

    const seen = await getSeenIds();
    const fresh = unread.filter((n) => !seen.has(n.id));
    if (fresh.length === 0) return;

    // One gentle nudge per poll, not one toast per notification — a burst
    // of native notifications is exactly the "nagging" the task said to
    // avoid.
    const first = fresh[0];
    const extra = fresh.length > 1 ? ` (+${fresh.length - 1} more)` : "";
    chrome.notifications.create(`frontalos-${first.id}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: first.title || "FrontalOS",
      message: `${first.message}${extra}`,
      priority: 0,
    });

    await saveSeenIds(new Set([...seen, ...fresh.map((n) => n.id)]));
  } catch {
    // Silent by design — a failed background poll shouldn't surface an
    // error notification of its own; the popup's own fetches will show a
    // real error state if the connection is actually broken.
  }
}

async function getSeenIds(): Promise<Set<number>> {
  const result = await chrome.storage.local.get(SEEN_IDS_KEY);
  const ids = (result[SEEN_IDS_KEY] as number[] | undefined) ?? [];
  return new Set(ids);
}

async function saveSeenIds(ids: Set<number>): Promise<void> {
  // Cap so this never grows unbounded across months of polling.
  const trimmed = Array.from(ids).slice(-200);
  await chrome.storage.local.set({ [SEEN_IDS_KEY]: trimmed });
}
