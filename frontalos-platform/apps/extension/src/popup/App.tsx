import { useEffect, useState } from "react";
import { getSession, getSettings, onSessionChanged } from "../lib/storage";
import type { StoredSession, StoredSettings } from "../lib/types";
import { DEFAULT_SETTINGS } from "../lib/types";
import { ConnectScreen } from "./components/ConnectScreen";
import { MainScreen } from "./components/MainScreen";
import { SettingsScreen } from "./components/SettingsScreen";

type View = "main" | "settings";

export function App() {
  const [session, setSession] = useState<StoredSession | null | undefined>(undefined);
  const [settings, setSettingsState] = useState<StoredSettings>(DEFAULT_SETTINGS);
  const [view, setView] = useState<View>("main");

  useEffect(() => {
    getSession().then(setSession);
    getSettings().then(setSettingsState);
    const unsubscribe = onSessionChanged(setSession);
    return unsubscribe;
  }, []);

  const handleSessionExpired = () => {
    setSession(null);
  };

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          FrontalOS
        </div>
        {session && view === "main" && (
          <button className="icon-btn" onClick={() => setView("settings")} aria-label="Settings">
            ⚙
          </button>
        )}
      </div>

      {session === undefined && (
        <div className="content">
          <div className="center-col" style={{ padding: "60px 0" }}>
            <span className="spinner" />
          </div>
        </div>
      )}

      {session === null && <ConnectScreen settings={settings} />}

      {session && view === "main" && (
        <MainScreen session={session} settings={settings} onSessionExpired={handleSessionExpired} />
      )}

      {session && view === "settings" && (
        <SettingsScreen
          settings={settings}
          onClose={() => {
            getSettings().then(setSettingsState);
            setView("main");
          }}
          onDisconnected={() => {
            setView("main");
          }}
        />
      )}

      <div className="footer-note">FrontalOS companion · not a substitute for the full dashboard</div>
    </div>
  );
}
