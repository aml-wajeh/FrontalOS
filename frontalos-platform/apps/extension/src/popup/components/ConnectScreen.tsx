import { useState } from "react";
import type { StoredSettings } from "../../lib/types";
import { setSession } from "../../lib/storage";

interface ConnectScreenProps {
  settings: StoredSettings;
}

/**
 * Two ways in, both documented in README.md's "Auth flow" section:
 *
 *  1. Connect button (preferred) — opens apps/web's /extension-connect
 *     page in a new tab. That page confirms the user is logged in, then
 *     posts a scoped access/refresh token pair back here via
 *     chrome.runtime.sendMessage (see background.ts's
 *     onMessageExternal listener). This popup doesn't do anything else
 *     for that path — it just waits; onSessionChanged in App.tsx picks
 *     the new session up automatically once it lands.
 *
 *  2. Paste a token (fallback) — for local testing before the
 *     /extension-connect page exists in a given deployment, or if
 *     externally_connectable's origin allowlist doesn't yet include this
 *     install's web app URL. Manually-pasted tokens have no refresh
 *     token, so the session simply expires after ~30 min and the popup
 *     will prompt to reconnect.
 */
export function ConnectScreen({ settings }: ConnectScreenProps) {
  const [showManual, setShowManual] = useState(false);
  const [token, setToken] = useState("");
  const [patientId, setPatientId] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openConnectTab = () => {
    const url = `${settings.webAppOrigin}/extension-connect?ext_id=${chrome.runtime.id}`;
    chrome.tabs.create({ url });
  };

  const saveManualToken = async () => {
    setError(null);
    const trimmed = token.trim();
    const pid = Number(patientId);
    if (!trimmed) {
      setError("Paste your access token first.");
      return;
    }
    if (!Number.isFinite(pid) || pid <= 0) {
      setError("Patient ID should be a positive number.");
      return;
    }
    setSaving(true);
    try {
      await setSession({
        accessToken: trimmed,
        expiresAt: Date.now() + 30 * 60_000,
        patientId: pid,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="content">
      <div className="center-col" style={{ padding: "18px 4px 4px" }}>
        <div style={{ fontSize: 34 }}>🧠</div>
        <div style={{ fontWeight: 800, fontSize: 16, color: "var(--color-primary-dark)" }}>
          Connect your FrontalOS account
        </div>
        <p className="muted-text">
          Sign in once and this popup will show your coin balance and quick focus resets.
        </p>
      </div>

      <button className="primary-btn" onClick={openConnectTab}>
        Connect to FrontalOS
      </button>

      <button className="link-btn" onClick={() => setShowManual((v) => !v)}>
        {showManual ? "Hide manual option" : "Have a token already? Paste it instead"}
      </button>

      {showManual && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="field">
            <label htmlFor="token">Access token</label>
            <textarea
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste the access token from your dashboard"
            />
          </div>
          <div className="field">
            <label htmlFor="patientId">Patient ID</label>
            <input
              id="patientId"
              inputMode="numeric"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="secondary-btn" onClick={saveManualToken} disabled={saving}>
            {saving ? "Saving…" : "Save token"}
          </button>
        </div>
      )}
    </div>
  );
}
