# apps/extension — FrontalOS Companion

A small Manifest V3 browser extension (Chrome/Edge) that sits next to the
Patient Portal: your coin balance, a link to the full dashboard, and a
mini Dopamine Menu (Box Breathing + Break Task Into 3) in the toolbar
popup. Built with Vite + React + TypeScript, sharing the platform's brand
colors from `packages/design-tokens`.

It is intentionally small. It does **not** try to replicate the Live AI
Observer's webcam session — see "What this extension does not do" below.

## Load it locally (unpacked)

```bash
cd apps/extension
npm install
npm run build
```

This produces `apps/extension/dist/`. Then:

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select `apps/extension/dist/`.
4. Pin the FrontalOS icon to the toolbar for easy access.

`npm run dev` runs the same build in watch mode — after a change, click
the refresh icon on the extension's card in `chrome://extensions` to pick
it up (Vite's build watcher writes to `dist/`, but MV3 doesn't hot-reload
popups/service workers automatically).

Packaging for the Chrome Web Store (a signed `.crx`/`.zip` upload, a
developer account, and a store listing) is a separate future step, not
covered here.

## Auth flow

The extension is a `chrome-extension://` origin. It can't read
`apps/web`'s httpOnly session cookies (that's the point of them being
httpOnly), and a cross-origin `fetch` from the popup wouldn't carry a
`SameSite=Lax` cookie anyway. So it carries its own bearer access token
instead, obtained one of two ways:

**1. Connect button (default, preferred).** Popup → "Connect to
FrontalOS" opens `{webAppOrigin}/extension-connect?ext_id=<extension id>`
in a new tab. That page (added to `apps/web` alongside this extension —
see `apps/web/src/app/extension-connect/` and
`apps/web/src/app/api/extension/token/route.ts`):

  1. Confirms the tab is logged in (`GET /api/auth/me`, same-origin, so
     the httpOnly cookie is sent automatically).
  2. If not, sends the user to `/login?next=/extension-connect?ext_id=...`
     and comes back here after a successful login.
  3. Once logged in, calls the new `GET /api/extension/token` — a small
     server-only route that reads the same httpOnly access-token cookie
     every other Route Handler under `app/api/*` already reads, and
     returns it (plus the refresh token and a best-effort patient ID) as
     JSON to that one page, in that one authenticated tab.
  4. Relays the result to the extension via
     `chrome.runtime.sendMessage(extensionId, ...)`. This only works
     because `manifest.json` declares `externally_connectable.matches`
     for the web app's origin — any other page trying to message the
     extension is ignored (`background.ts`'s `onMessageExternal`
     listener).

No new token type, no new backend service — this reuses the exact
access/refresh token pair `services/cortix-api/auth/router.py` already
issues, just held by the extension instead of in a cookie.

**2. Paste a token (fallback).** The popup's Connect screen has a
"paste it instead" option for local testing, or for a deployment whose
web app origin isn't in `externally_connectable` yet. A pasted token has
no refresh token, so the session simply expires (~30 min) and the popup
prompts to reconnect — this is expected, not a bug.

## Pointing at a non-default deployment

Dev defaults (`http://localhost:8000` for the API, `http://localhost:3000`
for the web app) are already in `manifest.json` and the popup's Settings
screen. To point at a real deployment:

1. Update the popup's Settings screen (API base URL + web app URL) —
   this is enough for API calls to work, since `services/cortix-api`'s
   CORS is wide open (`allow_origins: ["*"]`, see `main.py`).
2. Add the new API origin to `manifest.json`'s `host_permissions` and the
   new web app origin to `externally_connectable.matches`, then reload
   the unpacked extension. This repo intentionally does **not** request a
   broad `<all_urls>` permission or an open-ended `optional_host_permissions`
   wildcard — every origin the extension can reach is listed explicitly,
   which means changing it requires this one manual edit + reload.

## What this extension does not do

- **No in-popup webcam session.** The Live AI Observer
  (`apps/web/src/components/patient/LiveAIObserver.tsx`) holds a
  long-lived WebSocket to `services/frontalos-engine` while the tab stays
  open. A Manifest V3 service worker gets suspended by the browser
  whenever it's idle (no fixed lifetime — it's event-driven), which would
  silently drop that session mid-capture. Replicating it here would mean
  either an always-on offscreen document (extra permissions, and still
  fights browser power-saving) or reimplementing capture as a content
  script injected into arbitrary tabs (broad host permissions, exactly
  what this extension avoids). Documented as a future enhancement, not
  attempted.
- **No day streak / XP / badges in the popup.** These already only exist
  in the web app's own `localStorage` (see `lib/rewards/rewardWallet.ts`'s
  header comment — "no backing table anywhere in cortix-api"), not behind
  any CORTIX API endpoint. Rather than fabricate a number the extension
  can't actually verify, the popup shows the one figure that *is* real —
  coin balance, straight from `GET /api/v1/rewards/wallet/{id}` — and
  links to the full dashboard for everything else.
- **Known placeholder: patient ID.** There's no "which patient am I"
  endpoint for the patient/child role yet — `PatientDashboardClient.tsx`
  in the main web app hardcodes `PATIENT_ID = 1` with a comment noting
  real session-to-patient wiring isn't done. `GET /api/extension/token`
  mirrors that same placeholder. The popup's Settings screen lets you
  override the patient ID locally in the meantime.

## Notifications

`background.ts` polls `GET /api/v1/notifications` every 20 minutes via
`chrome.alarms` (never a `setInterval` — those don't survive service
worker suspension) and shows at most one native notification per poll,
only for items not already surfaced. Off by default is one toggle away —
see the popup's Settings screen (`notificationsEnabled`); the alarm still
fires either way, it just no-ops when the toggle is off.

## Structure

```
apps/extension/
├── public/
│   ├── manifest.json        Copied verbatim into dist/ by Vite.
│   └── icons/                16/32/48/128px, on-brand navy/teal/amber.
├── src/
│   ├── background.ts         Service worker: connect listener + polling.
│   ├── popup/
│   │   ├── index.html
│   │   ├── App.tsx            Connect / Main / Settings screen switch.
│   │   ├── styles.css         Brand tokens copied from
│   │   │                      packages/design-tokens/tokens.css.
│   │   └── components/
│   │       ├── ConnectScreen.tsx
│   │       ├── MainScreen.tsx
│   │       ├── SettingsScreen.tsx
│   │       ├── BoxBreathingMini.tsx
│   │       └── BreakTaskMini.tsx
│   └── lib/
│       ├── cortixApi.ts       Direct fetch to CORTIX API (bearer token,
│       │                      not the web app's cookie-based proxy).
│       ├── storage.ts         chrome.storage.local helpers.
│       └── types.ts
└── vite.config.ts             Multi-entry build (popup + background),
                                unhashed output paths for a stable manifest.
```
