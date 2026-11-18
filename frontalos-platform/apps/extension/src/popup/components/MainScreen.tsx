import { useCallback, useEffect, useState } from "react";
import { getRewardWalletBalance, postGameMetrics, CortixApiError } from "../../lib/cortixApi";
import type { StoredSession, StoredSettings } from "../../lib/types";
import { BoxBreathingMini } from "./BoxBreathingMini";
import { BreakTaskMini } from "./BreakTaskMini";

interface MainScreenProps {
  session: StoredSession;
  settings: StoredSettings;
  onSessionExpired: () => void;
}

type Activity = "none" | "box-breathing" | "break-task-into-3";

const COIN_REWARDS: Record<Exclude<Activity, "none">, number> = {
  "box-breathing": 20,
  "break-task-into-3": 15,
};

export function MainScreen({ session, settings, onSessionExpired }: MainScreenProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [activity, setActivity] = useState<Activity>("none");
  const [rewardToast, setRewardToast] = useState<number | null>(null);

  const loadBalance = useCallback(async () => {
    setLoadingBalance(true);
    setBalanceError(null);
    try {
      const wallet = await getRewardWalletBalance(session.patientId);
      setBalance(wallet.balance);
    } catch (err) {
      if (err instanceof CortixApiError && err.status === 401) {
        onSessionExpired();
        return;
      }
      setBalanceError("Couldn't load your coin balance.");
    } finally {
      setLoadingBalance(false);
    }
  }, [session.patientId, onSessionExpired]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  const handleActivityFinish = async (id: Exclude<Activity, "none">, durationSeconds: number) => {
    const reward = COIN_REWARDS[id];
    setRewardToast(reward);
    try {
      await postGameMetrics({
        patient_id: session.patientId,
        game_name: id,
        accuracy: 1,
        reaction_time: durationSeconds,
        mistakes: 0,
        breaks: 1,
        difficulty: "adaptive",
        session_duration: durationSeconds,
      });
      loadBalance();
    } catch {
      // Best-effort — the mini activity itself already completed for the
      // user; a failed sync just means the balance card won't reflect it
      // until the next successful load.
    }
  };

  const openDashboard = () => {
    chrome.tabs.create({ url: `${settings.webAppOrigin}/dashboard` });
  };

  return (
    <div className="content">
      <div className="card balance-card">
        <div>
          <div className="balance-label">Coin Balance</div>
          <div className="balance-value">
            <span className="balance-coin">🪙</span>
            {loadingBalance ? <span className="spinner" /> : balanceError ? "—" : balance}
          </div>
          {balanceError && (
            <button className="link-btn" onClick={loadBalance} style={{ marginTop: 4 }}>
              {balanceError} Retry
            </button>
          )}
        </div>
      </div>

      <div className="streak-note">
        Day streak, XP, and badges live on your full dashboard — this popup only shows what
        syncs from the CORTIX API directly.{" "}
        <a href="#" onClick={(e) => { e.preventDefault(); openDashboard(); }}>
          Open it
        </a>
      </div>

      <div>
        <div className="section-title">✨ Dopamine Menu</div>

        {activity === "none" && (
          <div className="dopamine-grid" style={{ marginTop: 8 }}>
            <button className="dopamine-btn" onClick={() => setActivity("box-breathing")}>
              <span className="emoji">🌬️</span>
              <span className="title">Box Breathing</span>
              <span className="coins">+20 coins</span>
            </button>
            <button className="dopamine-btn" onClick={() => setActivity("break-task-into-3")}>
              <span className="emoji">🧩</span>
              <span className="title">Break Task Into 3</span>
              <span className="coins">+15 coins</span>
            </button>
          </div>
        )}

        {activity === "box-breathing" && (
          <BoxBreathingMini
            onFinish={(s) => handleActivityFinish("box-breathing", s)}
            onExit={() => setActivity("none")}
          />
        )}

        {activity === "break-task-into-3" && (
          <BreakTaskMini
            onFinish={(s) => handleActivityFinish("break-task-into-3", s)}
            onExit={() => setActivity("none")}
          />
        )}

        {rewardToast !== null && activity === "none" && (
          <div className="reward-toast" style={{ marginTop: 10 }}>
            +{rewardToast} coins 🪙
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <button className="secondary-btn dashboard-link" onClick={openDashboard}>
        Open Full Dashboard
      </button>
    </div>
  );
}
