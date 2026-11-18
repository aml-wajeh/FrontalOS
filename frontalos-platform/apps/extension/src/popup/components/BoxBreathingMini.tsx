import { useEffect, useState } from "react";

interface BoxBreathingMiniProps {
  onFinish: (durationSeconds: number) => void;
  onExit: () => void;
}

const PHASES = [
  { label: "Breathe In", seconds: 4, scale: 1.5 },
  { label: "Hold", seconds: 4, scale: 1.5 },
  { label: "Breathe Out", seconds: 4, scale: 1 },
  { label: "Hold", seconds: 4, scale: 1 },
] as const;

/**
 * A single 4-4-4-4 box-breathing cycle (~16s) — deliberately one cycle,
 * not the full dashboard's 3-cycle version (components/patient/
 * DopamineMenu.tsx), since this is meant to be a quick popup-sized reset
 * per the task's "MINI Dopamine Menu" spec. Posts to the same
 * game_name="box-breathing" endpoint so it earns real coins on the same
 * ledger the full dashboard reads from.
 */
export function BoxBreathingMini({ onFinish, onExit }: BoxBreathingMiniProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(PHASES[0].seconds);
  const [done, setDone] = useState(false);
  const totalSeconds = PHASES.reduce((s, p) => s + p.seconds, 0);

  useEffect(() => {
    if (done) return;
    if (secondsLeft <= 0) {
      const next = phaseIndex + 1;
      if (next >= PHASES.length) {
        setDone(true);
        onFinish(totalSeconds);
        return;
      }
      setPhaseIndex(next);
      setSecondsLeft(PHASES[next].seconds);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, done, phaseIndex]);

  if (done) {
    return (
      <div className="mini-activity">
        <div style={{ fontWeight: 700, color: "var(--color-primary-dark)" }}>Nice breathing! 🌬️</div>
        <button className="secondary-btn" onClick={onExit}>
          Back
        </button>
      </div>
    );
  }

  const phase = PHASES[phaseIndex];

  return (
    <div className="mini-activity">
      <div className="breathing-wrap">
        <div
          className="breathing-circle"
          style={{ transform: `scale(${phase.scale})`, transitionDuration: `${phase.seconds}s` }}
        />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span className="breathing-label">{phase.label}</span>
          <span className="breathing-seconds">{secondsLeft}</span>
        </div>
      </div>
      <button className="link-btn" onClick={onExit}>
        Exit early
      </button>
    </div>
  );
}
