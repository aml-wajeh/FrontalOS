import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiveAIObserver } from "../LiveAIObserver";
import type { ObserverMetrics, ObserverSocketStatus } from "@/lib/websocket/useObserverSocket";

// The component's own WebSocket plumbing (reconnect/backoff/frame framing)
// is unit-testable on its own merits (useObserverSocket), but here we mock
// it at the hook boundary so LiveAIObserver's rendering logic — connection
// badge, metric bars, focus gauge, demo-mode badge, permission gating — is
// tested in isolation from real WebSocket wiring, per REMAINING_STEPS.md's
// "mock the WebSocket" instruction.
const mockUseObserverSocket = vi.fn();
vi.mock("@/lib/websocket/useObserverSocket", async () => {
  const actual = await vi.importActual<typeof import("@/lib/websocket/useObserverSocket")>(
    "@/lib/websocket/useObserverSocket"
  );
  return {
    ...actual,
    useObserverSocket: (...args: unknown[]) => mockUseObserverSocket(...args),
  };
});

function mockSocket(overrides: {
  status?: ObserverSocketStatus;
  metrics?: ObserverMetrics | null;
}) {
  mockUseObserverSocket.mockReturnValue({
    status: overrides.status ?? "idle",
    metrics: overrides.metrics ?? null,
    sendFrame: vi.fn(),
  });
}

// jsdom has no getUserMedia by default — stub it so the "Turn On Camera"
// flow can be driven without a real camera.
function stubGetUserMedia(implementation: () => Promise<MediaStream>) {
  Object.defineProperty(window.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(implementation) },
  });
}

describe("LiveAIObserver", () => {
  beforeEach(() => {
    mockUseObserverSocket.mockReset();
  });

  it("prompts for camera permission before showing any metrics", () => {
    mockSocket({ status: "idle", metrics: null });
    render(<LiveAIObserver sessionId="session-1" />);
    expect(screen.getByText("Turn on the Live Observer?")).toBeInTheDocument();
    expect(screen.queryByText(/Engagement/)).not.toBeInTheDocument();
  });

  it("shows an honest unsupported-device message when getUserMedia is unavailable", async () => {
    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
    mockSocket({ status: "idle", metrics: null });
    render(<LiveAIObserver sessionId="session-1" />);

    await userEvent.click(screen.getByRole("button", { name: /Turn On Camera/i }));
    expect(await screen.findByText(/can't open the camera/i)).toBeInTheDocument();
  });

  it("shows a denied message and does not render metrics if permission is rejected", async () => {
    stubGetUserMedia(() => Promise.reject(new Error("Permission denied")));
    mockSocket({ status: "idle", metrics: null });
    render(<LiveAIObserver sessionId="session-1" />);

    await userEvent.click(screen.getByRole("button", { name: /Turn On Camera/i }));
    expect(await screen.findByText(/Camera access was blocked/i)).toBeInTheDocument();
    expect(screen.queryByText(/Engagement/)).not.toBeInTheDocument();
  });

  it("renders live metric bars, focus score, and connection status once granted", async () => {
    const fakeTrack = { stop: vi.fn() };
    stubGetUserMedia(() =>
      Promise.resolve({ getTracks: () => [fakeTrack] } as unknown as MediaStream)
    );
    mockSocket({
      status: "open",
      metrics: {
        boredom: 0.2,
        engagement: 0.75,
        confusion: 0.1,
        frustration: 0.05,
        focus_score: 8.3,
        inference_mode: "model",
        timestamp: new Date().toISOString(),
      },
    });

    render(<LiveAIObserver sessionId="session-1" />);
    await userEvent.click(screen.getByRole("button", { name: /Turn On Camera/i }));

    expect(await screen.findByText("Engagement")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument(); // engagement bar
    expect(screen.getByText("8.3")).toBeInTheDocument(); // focus gauge
    expect(screen.getByText("Live")).toBeInTheDocument(); // connection badge
    expect(screen.queryByText("Demo mode")).not.toBeInTheDocument();
  });

  it("surfaces a 'Demo mode' badge when the engine is not running the real model", async () => {
    stubGetUserMedia(() =>
      Promise.resolve({ getTracks: () => [] } as unknown as MediaStream)
    );
    mockSocket({
      status: "open",
      metrics: {
        boredom: 0.5,
        engagement: 0.5,
        confusion: 0.5,
        frustration: 0.5,
        focus_score: 5.0,
        inference_mode: "demo",
        timestamp: new Date().toISOString(),
      },
    });

    render(<LiveAIObserver sessionId="session-1" />);
    await userEvent.click(screen.getByRole("button", { name: /Turn On Camera/i }));

    expect(await screen.findByText("Demo mode")).toBeInTheDocument();
  });

  it("shows a reconnecting indicator when the socket status is reconnecting", () => {
    mockSocket({ status: "reconnecting", metrics: null });
    render(<LiveAIObserver sessionId="session-1" />);
    expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument();
  });
});
