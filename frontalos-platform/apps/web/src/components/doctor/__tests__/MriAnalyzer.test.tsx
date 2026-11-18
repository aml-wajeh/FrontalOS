import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MriAnalyzer } from "../MriAnalyzer";
import type { MriPredictionResponse } from "@/lib/api/doctorClient";

// The component's own upload/network plumbing (predictMri, httpClient) is
// unit-testable on its own merits — here we mock useMriPrediction at the
// hook boundary so MriAnalyzer's rendering logic (dropzone, pending state,
// error state, gauge + findings, demo-mode banner) is tested in isolation,
// the same pattern LiveAIObserver.test.tsx uses for useObserverSocket.
const mockMutate = vi.fn();
const mockUseMriPrediction = vi.fn();

vi.mock("@/lib/api/useDoctorQueries", () => ({
  useMriPrediction: () => mockUseMriPrediction(),
}));

function mockMutation(overrides: {
  isPending?: boolean;
  isError?: boolean;
  error?: Error | null;
}) {
  mockUseMriPrediction.mockReturnValue({
    mutate: mockMutate,
    isPending: overrides.isPending ?? false,
    isError: overrides.isError ?? false,
    error: overrides.error ?? null,
  });
}

const BASE_RESULT: MriPredictionResponse = {
  status: "ok",
  prediction_id: 42,
  model: "cortix-mri-v1",
  filename: "scan.png",
  slice_image_base64: "aGVsbG8=",
  heatmap_image_base64: "d29ybGQ=",
  adhd_probability_pct: 63.5,
  findings: ["Reduced frontal lobe activity", "Elevated signal in prefrontal cortex"],
  inference_mode: "live",
};

function makeFile(name = "scan.png") {
  return new File(["fake-bytes"], name, { type: "image/png" });
}

describe("MriAnalyzer", () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockUseMriPrediction.mockReset();
    mockMutation({});
  });

  it("triggers an upload when a file is chosen via the hidden input", async () => {
    mockMutation({});
    const user = userEvent.setup();
    render(<MriAnalyzer patientId={7} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    await user.upload(input, makeFile());

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const [args] = mockMutate.mock.calls[0];
    expect(args.patientId).toBe(7);
    expect(args.file.name).toBe("scan.png");
  });

  it("shows the 'Running inference…' state while the mutation is pending", () => {
    mockMutation({ isPending: true });
    render(<MriAnalyzer patientId={1} />);
    expect(screen.getByText(/Running inference/i)).toBeInTheDocument();
  });

  it("shows an error message when the mutation fails", () => {
    mockMutation({ isError: true, error: new Error("Scan analysis failed.") });
    render(<MriAnalyzer patientId={1} />);
    expect(screen.getByText("Scan analysis failed.")).toBeInTheDocument();
  });

  it("renders the probability gauge and findings once a result is available", async () => {
    let onSuccessCallback: ((data: MriPredictionResponse) => void) | undefined;
    mockMutate.mockImplementation((_vars, opts) => {
      onSuccessCallback = opts?.onSuccess;
    });
    mockMutation({});

    const user = userEvent.setup();
    render(<MriAnalyzer patientId={1} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, makeFile());
    act(() => onSuccessCallback?.(BASE_RESULT));

    expect(await screen.findByText("63.5%")).toBeInTheDocument();
    expect(screen.getByText("Reduced frontal lobe activity")).toBeInTheDocument();
    expect(screen.getByText("Elevated signal in prefrontal cortex")).toBeInTheDocument();
  });

  it("shows the DEMO DATA banner when inference_mode is 'demo'", async () => {
    let onSuccessCallback: ((data: MriPredictionResponse) => void) | undefined;
    mockMutate.mockImplementation((_vars, opts) => {
      onSuccessCallback = opts?.onSuccess;
    });
    mockMutation({});

    const user = userEvent.setup();
    render(<MriAnalyzer patientId={1} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, makeFile());
    act(() =>
      onSuccessCallback?.({
        ...BASE_RESULT,
        inference_mode: "demo",
        demo_note: "No trained model file found on disk.",
      })
    );

    expect(await screen.findByText(/DEMO DATA/i)).toBeInTheDocument();
    expect(screen.getByText("No trained model file found on disk.")).toBeInTheDocument();
  });

  it("does not show the demo banner for a live inference result", async () => {
    let onSuccessCallback: ((data: MriPredictionResponse) => void) | undefined;
    mockMutate.mockImplementation((_vars, opts) => {
      onSuccessCallback = opts?.onSuccess;
    });
    mockMutation({});

    const user = userEvent.setup();
    render(<MriAnalyzer patientId={1} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, makeFile());
    act(() => onSuccessCallback?.(BASE_RESULT));

    await screen.findByText("63.5%");
    expect(screen.queryByText(/DEMO DATA/i)).not.toBeInTheDocument();
  });
});
