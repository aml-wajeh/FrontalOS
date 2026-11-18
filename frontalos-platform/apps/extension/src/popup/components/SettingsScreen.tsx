import { useState } from "react";
import type { StoredSettings } from "../../lib/types";
import { clearSession, setSettings } from "../../lib/storage";

interface SettingsScreenProps {
  settings: StoredSettings;
  onClose: () => void;
  onDisconnected: () => void;
}

export function SettingsScreen({ settings, onClose, onDisconnected }: SettingsScreenProps) {
  const [apiBaseUrl, setApiBaseUrl] = useState(settings.apiBaseUrl);
  const [webAppOrigin, setWebAppOrigin] = useState(settings.webAppOrigin);
  const [notificationsEnabled, setNotificationsEnabled] = useState(settings.notificationsEnabled);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      await setSettings({
        apiBaseUrl: apiBaseUrl.trim().replace(/\/$/, ""),
        webAppOrigin: webAppOrigin.trim().replace(/\/$/, ""),
        notificationsEnabled,
      });
      setNote("Saved.");
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    await clearSession();
    onDisconnected();
  };

  return (
    <div className="content">
      <div className="section-title">Settings</div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="field">
          <label htmlFor="apiBaseUrl">CORTIX API base URL</label>
          <input id="apiBaseUrl" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="webAppOrigin">Web app URL</label>
          <input id="webAppOrigin" value={webAppOrigin} onChange={(e) => setWebAppOrigin(e.target.value)} />
        </div>
        <p className="muted-text" style={{ margin: 0 }}>
          Pointing at a non-default domain also needs a matching entry in manifest.json's
          host_permissions (API URL) and externally_connectable (web app URL) — see README.
        </p>
      </div>

      <div className="card">
        <div className="toggle-row">
          <span>Gentle reminders</span>
          <button
            className="toggle"
            data-on={notificationsEnabled}
            onClick={() => setNotificationsEnabled((v) => !v)}
            aria-pressed={notificationsEnabled}
            aria-label="Toggle gentle reminder notifications"
          >
            <span className="knob" />
          </button>
        </div>
        <p className="muted-text" style={{ margin: "6px 0 0" }}>
          Occasional native notifications (roughly every 20 min) when there's something new.
        </p>
      </div>

      {note && <div className="muted-text">{note}</div>}

      <button className="primary-btn" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </button>
      <button className="secondary-btn" onClick={onClose}>
        Back
      </button>
      <button className="link-btn" onClick={disconnect} style={{ color: "#b3261e" }}>
        Disconnect account
      </button>
    </div>
  );
}
