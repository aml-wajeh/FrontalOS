"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Mirrors the JSON pushed by services/frontalos-engine's
 * `WS /ws/observe/{session_id}` (see app/main.py docstring — every field
 * below is sent on every message, no optional fields on the wire).
 */
export interface ObserverMetrics {
  boredom: number;
  engagement: number;
  confusion: number;
  frustration: number;
  focus_score: number; // 0-10
  inference_mode: "model" | "demo";
  /** Output of the engine's intervention policy (smoothing + hysteresis + cooldown). */
  focus_state: "warming_up" | "focused" | "drifting";
  smoothed_engagement: number | null;
  /** Present only on the message where the policy decides to nudge. */
  nudge: ObserverNudge | null;
  timestamp: string;
}

export interface ObserverNudge {
  id: number;
  reason: string;
  drift_seconds: number;
}

export type ObserverSocketStatus =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"
  | "unavailable";

interface UseObserverSocketOptions {
  /** Stable per-portal-session id, used to key the engine's per-session buffer. */
  sessionId: string;
  /** Only opens the socket once true — gate this on webcam permission being granted. */
  enabled: boolean;
}

const MAX_RECONNECT_DELAY_MS = 15_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

export function useObserverSocket({ sessionId, enabled }: UseObserverSocketOptions) {
  const [status, setStatus] = useState<ObserverSocketStatus>("idle");
  const [metrics, setMetrics] = useState<ObserverMetrics | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedIntentionallyRef = useRef(false);

  const connect = useCallback(() => {
    const wsBase = process.env.NEXT_PUBLIC_FRONTALOS_WS_URL;
    if (!wsBase) {
      // Missing config — surface as "unavailable" rather than looping
      // reconnect attempts against an undefined URL forever.
      setStatus("unavailable");
      return;
    }

    closedIntentionallyRef.current = false;
    setStatus((prev) => (prev === "idle" ? "connecting" : "reconnecting"));

    const url = `${wsBase.replace(/\/$/, "")}/ws/observe/${encodeURIComponent(sessionId)}`;
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      reconnectAttemptRef.current = 0;
      setStatus("open");
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as ObserverMetrics;
        setMetrics(parsed);
      } catch {
        // Ignore malformed frames rather than crashing the observer UI.
      }
    };

    socket.onerror = () => {
      // onclose fires right after in the browser WS spec — let that branch
      // own the reconnect scheduling so we don't double-schedule.
    };

    socket.onclose = () => {
      socketRef.current = null;
      if (closedIntentionallyRef.current) {
        setStatus("closed");
        return;
      }
      setStatus("reconnecting");
      const attempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = attempt;
      const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** (attempt - 1), MAX_RECONNECT_DELAY_MS);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!enabled) return;

    connect();

    return () => {
      closedIntentionallyRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close(1000, "component unmounted");
      socketRef.current = null;
      reconnectAttemptRef.current = 0;
    };
  }, [connect, enabled]);

  /** Sends one base64-encoded JPEG frame (no data: prefix) to the engine. */
  const sendFrame = useCallback((base64Jpeg: string) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(base64Jpeg);
    }
  }, []);

  /** Tells the engine whether the last nudge helped; dismissals back off future nudges. */
  const sendNudgeFeedback = useCallback((helpful: boolean) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "nudge_feedback", helpful }));
    }
  }, []);

  return { status, metrics, sendFrame, sendNudgeFeedback };
}
