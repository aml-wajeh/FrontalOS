"use client";

/**
 * ExtensionConnectClient.tsx
 *
 * The other half of the extension's Connect flow (see apps/extension/src/
 * popup/components/ConnectScreen.tsx and app/api/extension/token/route.ts
 * above). Reached by the popup opening:
 *
 *   {webAppOrigin}/extension-connect?ext_id=<chrome.runtime.id>
 *
 * in a new tab. Steps:
 *   1. If not logged in, send the user to /login?next=/extension-connect
 *      (this page's own querystring, including ext_id, is preserved via
 *      `next` so the redirect lands back here after a successful login).
 *   2. If logged in, fetch GET /api/extension/token (same-origin, so the
 *      httpOnly session cookie is sent automatically) and relay the
 *      result to the extension via chrome.runtime.sendMessage — which
 *      only reaches an extension that declared this origin in its
 *      manifest.json's externally_connectable (see apps/extension/
 *      public/manifest.json).
 *
 * This page never touches the access token in any way other than
 * receiving it from #1's response and immediately forwarding it — it's
 * not stored in this page's own state longer than needed to relay it, and
 * never written to localStorage/sessionStorage.
 */
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Status = "checking" | "not-logged-in" | "connecting" | "connected" | "error" | "no-extension-api";

// Minimal local shape for the one API this page calls — deliberately NOT
// a `declare global { interface Window { chrome: ... } }` augmentation:
// this repo's apps/extension workspace also depends on @types/chrome,
// which npm hoists into the shared node_modules/@types and gets picked up
// by every workspace's tsc run automatically. A second, narrower `chrome`
// declaration here would conflict with it. Casting at the call site
// avoids depending on that hoisting behavior either way.
interface MinimalChromeRuntime {
  runtime?: {
    sendMessage?: (
      extensionId: string,
      message: unknown,
      callback?: (response: unknown) => void
    ) => void;
    lastError?: { message?: string };
  };
}
// (eslint's no-unused-vars flags the parameter names in the type alias
// above even though they only document the call signature — harmless,
// left as-is for readability rather than switching to bare types.)

function getChromeRuntime(): MinimalChromeRuntime["runtime"] {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { chrome?: MinimalChromeRuntime }).chrome?.runtime;
}

export default function ExtensionConnectClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const extId = searchParams.get("ext_id");
  const [status, setStatus] = useState<Status>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!extId) {
      setStatus("error");
      setErrorMessage("Missing extension ID — open this page from the FrontalOS extension's Connect button.");
      return;
    }

    // Browsers other than Chrome/Edge (or this tab opened outside the
    // extension's own browser instance) won't have chrome.runtime — fail
    // visibly rather than hanging on "Connecting…" forever.
    if (!getChromeRuntime()?.sendMessage) {
      setStatus("no-extension-api");
      return;
    }

    let cancelled = false;

    async function run() {
      setStatus("connecting");
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      if (cancelled) return;

      if (meRes.status === 401) {
        setStatus("not-logged-in");
        return;
      }
      if (!meRes.ok) {
        setStatus("error");
        setErrorMessage("Couldn't verify your session. Try refreshing the page.");
        return;
      }

      const tokenRes = await fetch("/api/extension/token", { cache: "no-store" });
      if (cancelled) return;
      if (!tokenRes.ok) {
        setStatus("error");
        setErrorMessage("Couldn't prepare a token for the extension. Try refreshing the page.");
        return;
      }
      const payload = await tokenRes.json();

      const runtime = getChromeRuntime();
      const sendMessage = runtime?.sendMessage;
      if (!sendMessage) {
        setStatus("no-extension-api");
        return;
      }

      sendMessage(extId!, { type: "FRONTALOS_CONNECT", ...payload }, (response) => {
        if (cancelled) return;
        const ok = (response as { ok?: boolean } | undefined)?.ok;
        if (runtime?.lastError || !ok) {
          setStatus("error");
          setErrorMessage(
            "The extension didn't respond. Make sure it's installed and this page's URL is allowed in its settings."
          );
          return;
        }
        setStatus("connected");
      });
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [extId]);

  return (
    <main id="main-content" className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-3xl">🧠</div>

      {status === "checking" || status === "connecting" ? (
        <>
          <p className="font-display text-lg font-semibold text-primary-dark">Connecting your extension…</p>
          <p className="text-sm text-muted">Hang tight, this only takes a second.</p>
        </>
      ) : null}

      {status === "not-logged-in" && (
        <>
          <p className="font-display text-lg font-semibold text-primary-dark">Please log in first</p>
          <p className="text-sm text-muted">
            You&rsquo;ll be brought back here automatically once you&rsquo;re signed in.
          </p>
          <button
            className="mt-2 inline-flex h-10 items-center justify-center rounded-full bg-secondary px-5 text-sm font-medium text-primary-dark hover:bg-secondary/90"
            onClick={() =>
              router.push(`/login?next=${encodeURIComponent(`/extension-connect?ext_id=${extId}`)}`)
            }
          >
            Go to login
          </button>
        </>
      )}

      {status === "connected" && (
        <>
          <p className="font-display text-lg font-semibold text-primary-dark">Connected! ✅</p>
          <p className="text-sm text-muted">You can close this tab and open the FrontalOS popup.</p>
        </>
      )}

      {status === "no-extension-api" && (
        <>
          <p className="font-display text-lg font-semibold text-primary-dark">Extension not detected</p>
          <p className="text-sm text-muted">
            Open this page by clicking &ldquo;Connect to FrontalOS&rdquo; inside the extension popup, in a
            browser that supports Chrome extensions.
          </p>
        </>
      )}

      {status === "error" && (
        <>
          <p className="font-display text-lg font-semibold text-primary-dark">Something went wrong</p>
          <p className="text-sm text-muted">{errorMessage}</p>
        </>
      )}
    </main>
  );
}
