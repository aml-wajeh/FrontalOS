"use client";

import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Moon, NotebookPen, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/DataState";
import type { ProgressAnalyticsResponse, RadarResponse } from "@/lib/api/parentClient";

interface WeeklyNotesProps {
  progress: ProgressAnalyticsResponse | undefined;
  radar: RadarResponse | undefined;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

interface Note {
  icon: ReactNode;
  text: ReactNode;
  /** Plain-text mirror of `text`, kept in sync manually — used for the
   * "Copy for doctor" action so shared notes read as clean prose instead of
   * serialized JSX. */
  plain: string;
}

/**
 * Builds bullet insights straight out of the real analytics payloads
 * (`ai_summary`, `overall_status`, `sleep_vs_attention`, radar axes) —
 * this is formatting of numbers CORTIX already computed server-side, not
 * a separate generative call, so every bullet traces back to a real field.
 */
function buildNotes(progress: ProgressAnalyticsResponse, radar: RadarResponse | undefined): Note[] {
  const notes: Note[] = [];

  notes.push({
    icon: <NotebookPen className="h-3.5 w-3.5" />,
    text: progress.ai_summary,
    plain: progress.ai_summary,
  });

  if (progress.overall_status !== "insufficient_data") {
    const statusTone =
      progress.overall_status === "Improving"
        ? "trending upward"
        : progress.overall_status === "Declining"
          ? "trending down"
          : "holding steady";
    const checkinWord = `check-in${progress.checkin_count === 1 ? "" : "s"}`;
    notes.push({
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      text: (
        <>
          Attention is <strong className="font-semibold text-primary-dark">{statusTone}</strong> over the last{" "}
          {progress.window_days} days, based on {progress.checkin_count} check-in
          {progress.checkin_count === 1 ? "" : "s"}.
        </>
      ),
      plain: `Attention is ${statusTone} over the last ${progress.window_days} days, based on ${progress.checkin_count} ${checkinWord}.`,
    });
  }

  const sleepCorr = progress.sleep_vs_attention?.correlation;
  if (typeof sleepCorr === "number") {
    const strength = Math.abs(sleepCorr) >= 0.5 ? "a strong" : Math.abs(sleepCorr) >= 0.25 ? "a moderate" : "a weak";
    const direction = sleepCorr >= 0 ? "positive" : "negative";
    notes.push({
      icon: <Moon className="h-3.5 w-3.5" />,
      text: (
        <>
          Sleep and attention show {strength} <strong className="font-semibold text-primary-dark">{direction}</strong>{" "}
          relationship this window (r = {sleepCorr.toFixed(2)}).
        </>
      ),
      plain: `Sleep and attention show ${strength} ${direction} relationship this window (r = ${sleepCorr.toFixed(2)}).`,
    });
  }

  if (radar) {
    const untracked = radar.axes.filter((_, i) => radar.patient_scores[i] === null);
    if (untracked.length > 0) {
      const verb = untracked.length === 1 ? "isn't" : "aren't";
      notes.push({
        icon: <NotebookPen className="h-3.5 w-3.5" />,
        text: (
          <>
            <strong className="font-semibold text-primary-dark">{untracked.join(" & ")}</strong>{" "}
            {untracked.length === 1 ? "isn't" : "aren't"} tracked yet — logging it during check-ins will fill in
            the snapshot.
          </>
        ),
        plain: `${untracked.join(" & ")} ${verb} tracked yet — logging it during check-ins will fill in the snapshot.`,
      });
    }
  }

  return notes;
}

export function WeeklyNotes({ progress, radar, isLoading, isError, onRetry }: WeeklyNotesProps) {
  const [copied, setCopied] = useState(false);
  const hasNotes = !isLoading && !isError && !!progress && progress.checkin_count > 0;
  const notes = hasNotes ? buildNotes(progress, radar) : [];

  async function copyForDoctor() {
    const header = `Weekly Behavioral Notes — last ${progress?.window_days ?? 7} days\n`;
    const body = notes.map((n) => `• ${n.plain}`).join("\n");
    try {
      await navigator.clipboard.writeText(header + body);
      setCopied(true);
      toast.success("Copied — ready to paste into a message to your child's doctor.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy to clipboard. Try selecting the text manually.");
    }
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-primary-dark">Weekly Behavioral Notes</h3>
            <p className="text-xs text-muted">Auto-generated from this window&apos;s check-ins</p>
          </div>
          {hasNotes && (
            <button
              onClick={copyForDoctor}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/[0.08] bg-canvas px-3 py-1.5 text-[11px] font-semibold text-primary-dark transition-colors hover:border-secondary/40 hover:text-secondary"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-secondary" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy for doctor"}
            </button>
          )}
        </div>

        {isLoading && (
          <div className="space-y-2.5" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-3.5 w-full animate-pulse rounded bg-primary/[0.08]" />
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <ErrorState
            title="Couldn't load these notes"
            subtitle="Check your connection and try again in a bit."
            onRetry={onRetry}
            height="h-40"
          />
        )}

        {hasNotes && (
          <ul className="space-y-3">
            {notes.map((note, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3, ease: "easeOut" }}
                className="flex items-start gap-2.5 text-sm text-primary-dark/90"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary">
                  {note.icon}
                </span>
                <span className="leading-relaxed">{note.text}</span>
              </motion.li>
            ))}
          </ul>
        )}

        {!isLoading && !isError && (!progress || progress.checkin_count === 0) && (
          <EmptyState
            title="No notes yet"
            subtitle="Insights will appear here once check-ins start coming in."
            height="h-40"
          />
        )}
      </CardBody>
    </Card>
  );
}