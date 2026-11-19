"""
core/intervention_policy.py

Turns noisy per-window engagement estimates into calm, explainable re-focus
nudges. Deterministic and clock-injected, so every behaviour is unit-tested.

Rules
-----
1. Smoothing: an exponential moving average (EMA) of engagement, so one bad
   window (a sneeze, a glance away) cannot trigger anything.
2. Hysteresis: the state becomes DRIFTING only when the EMA falls below
   `low_threshold`, and returns to FOCUSED only when it climbs back above
   `high_threshold` (> low). This stops flickering around one threshold.
3. Sustain: a nudge needs DRIFTING to have lasted `sustain_seconds`.
4. Cooldown: at most one nudge per `cooldown_seconds`; each dismissal
   doubles the next cooldown (capped), each "helpful" resets it.
5. One nudge per drift episode: after nudging, the user must refocus before
   another nudge can fire.

The thresholds are product defaults on the engine's [0, 1] engagement scale
(level / 3), NOT values validated against real attention outcomes.
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from enum import Enum


class FocusState(str, Enum):
    WARMING_UP = "warming_up"
    FOCUSED = "focused"
    DRIFTING = "drifting"


@dataclass(frozen=True)
class PolicyConfig:
    ema_alpha: float = 0.3
    low_threshold: float = 0.5      # below ~level 1.5 of 3
    high_threshold: float = 0.6     # must recover above this to count as refocused
    min_samples: int = 5            # windows before the EMA is trusted
    sustain_seconds: float = 30.0
    cooldown_seconds: float = 300.0
    max_cooldown_seconds: float = 1800.0

    def __post_init__(self) -> None:
        if not 0 < self.ema_alpha <= 1:
            raise ValueError("ema_alpha must be in (0, 1]")
        if self.high_threshold <= self.low_threshold:
            raise ValueError("high_threshold must be greater than low_threshold (hysteresis)")


@dataclass(frozen=True)
class Nudge:
    id: int
    reason: str
    drift_seconds: float


@dataclass
class PolicyDecision:
    state: FocusState
    smoothed_engagement: float | None
    nudge: Nudge | None = None


@dataclass
class InterventionPolicy:
    config: PolicyConfig = field(default_factory=PolicyConfig)
    state: FocusState = FocusState.WARMING_UP
    ema: float | None = None
    samples: int = 0
    drift_started_at: float | None = None
    nudged_this_episode: bool = False
    last_nudge_at: float | None = None
    current_cooldown: float | None = None
    _ids: itertools.count[int] = field(default_factory=lambda: itertools.count(1))

    def __post_init__(self) -> None:
        if self.current_cooldown is None:
            self.current_cooldown = self.config.cooldown_seconds

    def update(self, engagement: float, now: float) -> PolicyDecision:
        """Feed one engagement estimate in [0, 1] observed at time `now` (seconds)."""
        cfg = self.config
        engagement = min(1.0, max(0.0, float(engagement)))
        self.ema = engagement if self.ema is None else cfg.ema_alpha * engagement + (1 - cfg.ema_alpha) * self.ema
        self.samples += 1

        if self.samples < cfg.min_samples:
            self.state = FocusState.WARMING_UP
            return PolicyDecision(self.state, self.ema)

        if self.state != FocusState.DRIFTING and self.ema < cfg.low_threshold:
            self.state = FocusState.DRIFTING
            self.drift_started_at = now
            self.nudged_this_episode = False
        elif self.state == FocusState.DRIFTING and self.ema > cfg.high_threshold:
            self.state = FocusState.FOCUSED
            self.drift_started_at = None
        elif self.state == FocusState.WARMING_UP:
            self.state = FocusState.FOCUSED

        nudge = None
        if self.state == FocusState.DRIFTING and not self.nudged_this_episode:
            drift_for = now - (self.drift_started_at or now)
            cooled_down = self.last_nudge_at is None or now - self.last_nudge_at >= self.current_cooldown
            if drift_for >= cfg.sustain_seconds and cooled_down:
                nudge = Nudge(id=next(self._ids), reason="sustained_low_engagement", drift_seconds=round(drift_for, 1))
                self.last_nudge_at = now
                self.nudged_this_episode = True

        return PolicyDecision(self.state, self.ema, nudge)

    def feedback(self, helpful: bool) -> None:
        """User reaction to the last nudge: dismissals back off, 'helpful' resets."""
        if helpful:
            self.current_cooldown = self.config.cooldown_seconds
        else:
            self.current_cooldown = min(self.current_cooldown * 2, self.config.max_cooldown_seconds)
