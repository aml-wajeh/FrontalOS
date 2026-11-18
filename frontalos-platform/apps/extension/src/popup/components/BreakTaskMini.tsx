import { useState } from "react";

interface BreakTaskMiniProps {
  onFinish: (durationSeconds: number) => void;
  onExit: () => void;
}

/** A tiny 3-input checklist — same game_name="break-task-into-3" as the
 * full dashboard's version, so it credits the same coin ledger. */
export function BreakTaskMini({ onFinish, onExit }: BreakTaskMiniProps) {
  const [steps, setSteps] = useState(["", "", ""]);
  const [startedAt] = useState(() => Date.now());
  const [done, setDone] = useState(false);

  const canSave = steps.every((s) => s.trim().length > 0);

  const save = () => {
    setDone(true);
    onFinish(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
  };

  if (done) {
    return (
      <div className="mini-activity">
        <div style={{ fontWeight: 700, color: "var(--color-primary-dark)" }}>Nice breakdown! 🧩</div>
        <button className="secondary-btn" onClick={onExit}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="mini-activity">
      <p className="muted-text" style={{ margin: 0 }}>
        Split what's next into 3 tiny steps
      </p>
      <div className="task-steps">
        {steps.map((value, i) => (
          <input
            key={i}
            value={value}
            placeholder={`Step ${i + 1}`}
            onChange={(e) => {
              const next = [...steps];
              next[i] = e.target.value;
              setSteps(next);
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, width: "100%" }}>
        <button className="link-btn" onClick={onExit}>
          Exit early
        </button>
        <div style={{ flex: 1 }} />
        <button className="primary-btn" onClick={save} disabled={!canSave}>
          Done
        </button>
      </div>
    </div>
  );
}
