import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Activity } from "lucide-react";
import { KpiCard } from "../KpiCard";

describe("KpiCard", () => {
  it("renders the label and formatted value", () => {
    render(
      <KpiCard label="Focus Score" icon={<Activity data-testid="icon" />} accent="teal" value={82} suffix="%" />
    );
    expect(screen.getByText("Focus Score")).toBeInTheDocument();
    expect(screen.getByText("82%")).toBeInTheDocument();
  });

  it("shows a loading skeleton and hides the value while isLoading", () => {
    const { container } = render(
      <KpiCard label="Focus Score" icon={<Activity />} accent="teal" value={82} isLoading />
    );
    expect(screen.queryByText("82")).not.toBeInTheDocument();
    expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });

  it("renders an honest 'No data' state instead of fabricating a value when value is null", () => {
    render(
      <KpiCard
        label="Sleep Hours"
        icon={<Activity />}
        accent="navy"
        value={null}
        unavailableReason="No check-ins recorded yet"
      />
    );
    expect(screen.getByText("No data")).toBeInTheDocument();
    expect(screen.getByText("No check-ins recorded yet")).toBeInTheDocument();
  });

  it("does not show the unavailable reason text while still loading", () => {
    render(
      <KpiCard
        label="Sleep Hours"
        icon={<Activity />}
        accent="navy"
        value={null}
        isLoading
        unavailableReason="No check-ins recorded yet"
      />
    );
    expect(screen.queryByText("No check-ins recorded yet")).not.toBeInTheDocument();
  });

  it("renders a delta pill with the rounded percentage when deltaPct is provided", () => {
    render(<KpiCard label="Focus Score" icon={<Activity />} accent="teal" value={82} deltaPct={5.42} />);
    expect(screen.getByText("5.4%")).toBeInTheDocument();
  });

  it("does not render a delta pill when deltaPct is null", () => {
    render(<KpiCard label="Focus Score" icon={<Activity />} accent="teal" value={82} deltaPct={null} />);
    expect(screen.queryAllByText(/^\d+\.\d%$/)).toHaveLength(0);
  });
});
