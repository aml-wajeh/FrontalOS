"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Plus, Search, StickyNote, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorState, SkeletonList } from "@/components/ui/DataState";
import type { PatientStatus, RosterEntry } from "@/lib/clinician/clinicianWorkspace";

const STATUS_STYLES: Record<PatientStatus, string> = {
  "Initial Consult": "bg-accent/15 text-accent border-accent/30",
  "ADHD Monitoring": "bg-secondary/15 text-secondary border-secondary/30",
  Neurofeedback: "bg-primary-soft text-white/80 border-white/10",
};

const STATUS_OPTIONS: PatientStatus[] = ["Initial Consult", "ADHD Monitoring", "Neurofeedback"];

interface PatientSidebarProps {
  roster: RosterEntry[];
  activePatientId: number | null;
  onSelectPatient: (patientId: number) => void;
  onAddPatient: (patientId: number, displayName: string, status: PatientStatus) => void;
  onRemovePatient: (patientId: number) => void;
  noteDraft: string;
  onNoteDraftChange: (value: string) => void;
  onSaveNote: () => void;
  roosterGapNote?: string;
  /** True only while the initial roster fetch is in flight (no cached
   * roster data yet) — a background refetch of an already-populated
   * roster doesn't flip this back on, so the list doesn't flicker. */
  rosterLoading?: boolean;
  /** A genuine fetch failure (network error, 5xx) — distinct from
   * routeNotMountedYet's expected 404, which is communicated via
   * roosterGapNote instead and isn't a real error. */
  rosterError?: boolean;
  onRetryRoster?: () => void;
}

export function PatientSidebar({
  roster,
  activePatientId,
  onSelectPatient,
  onAddPatient,
  onRemovePatient,
  noteDraft,
  onNoteDraftChange,
  onSaveNote,
  roosterGapNote,
  rosterLoading = false,
  rosterError = false,
  onRetryRoster,
}: PatientSidebarProps) {
  const [query, setQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newStatus, setNewStatus] = useState<PatientStatus>("Initial Consult");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (r) => r.displayName.toLowerCase().includes(q) || String(r.patientId).includes(q)
    );
  }, [roster, query]);

  function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const idNum = Number(newId);
    if (!idNum || idNum <= 0 || !newName.trim()) return;
    onAddPatient(idNum, newName.trim(), newStatus);
    setNewId("");
    setNewName("");
    setNewStatus("Initial Consult");
    setShowAddForm(false);
  }

  return (
    <aside className="glass-dark scroll-quiet flex h-full w-full flex-col gap-4 border-r border-white/10 p-4 lg:w-72 lg:shrink-0">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Patient Roster</p>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or ID"
            className="w-full rounded-lg border border-white/10 bg-primary/40 py-2 pl-8 pr-3 text-xs text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-secondary"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {rosterLoading && roster.length === 0 && <SkeletonList rows={3} tone="dark" />}

        {rosterError && !rosterLoading && (
          <ErrorState
            tone="dark"
            title="Couldn't load your roster"
            subtitle="Check your connection and try again."
            onRetry={onRetryRoster}
            height="h-32"
          />
        )}

        {!rosterLoading && !rosterError && roosterGapNote && roster.length === 0 && (
          <p className="rounded-lg border border-dashed border-white/10 p-3 text-[11px] leading-relaxed text-white/40">
            {roosterGapNote}
          </p>
        )}

        <LayoutGroup>
          <AnimatePresence initial={false}>
            {filtered.map((patient, i) => {
              const active = patient.patientId === activePatientId;
              return (
                <motion.div
                  key={patient.patientId}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18, delay: i < 8 ? i * 0.015 : 0 }}
                  className={cn(
                    "group relative flex items-center justify-between gap-2 overflow-hidden rounded-lg border px-3 py-2.5 text-left",
                    active ? "border-secondary/40" : "border-transparent hover:border-white/10 hover:bg-white/[0.04]"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="roster-active-glow"
                      className="absolute inset-0 -z-10 bg-secondary/10 shadow-[0_0_0_1px_rgba(0,194,168,0.15),0_0_18px_-6px_rgba(0,194,168,0.5)]"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <button onClick={() => onSelectPatient(patient.patientId)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                        active
                          ? "border-secondary/40 bg-secondary/15 text-secondary"
                          : "border-white/10 bg-white/[0.05] text-white/50"
                      )}
                      aria-hidden
                    >
                      {initials(patient.displayName)}
                    </span>
                    <span className="min-w-0">
                      <p className={cn("truncate text-sm font-medium", active ? "text-white" : "text-white/80")}>
                        {patient.displayName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/35">CTX-{String(patient.patientId).padStart(4, "0")}</p>
                      <span
                        className={cn(
                          "mt-1.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          STATUS_STYLES[patient.status]
                        )}
                      >
                        {patient.status}
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => onRemovePatient(patient.patientId)}
                    className="shrink-0 rounded p-1 text-white/20 opacity-0 transition-opacity hover:bg-white/10 hover:text-white/60 group-hover:opacity-100"
                    aria-label={`Remove ${patient.displayName} from roster`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </LayoutGroup>
      </div>

      {showAddForm ? (
        <form onSubmit={submitAdd} className="space-y-2 rounded-lg border border-white/10 bg-primary/40 p-3">
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            type="number"
            min={1}
            placeholder="Patient ID"
            className="w-full rounded-md border border-white/10 bg-primary-dark/60 px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-secondary"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Display name"
            className="w-full rounded-md border border-white/10 bg-primary-dark/60 px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-secondary"
          />
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as PatientStatus)}
            className="w-full rounded-md border border-white/10 bg-primary-dark/60 px-2.5 py-1.5 text-xs text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-secondary"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="flex gap-2 pt-0.5">
            <button
              type="submit"
              className="flex-1 rounded-md bg-secondary py-1.5 text-xs font-semibold text-primary-dark hover:bg-secondary/90"
            >
              Add to roster
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 py-2 text-xs font-medium text-white/50 hover:border-secondary/40 hover:text-secondary"
        >
          <Plus className="h-3.5 w-3.5" />
          Add patient to roster
        </button>
      )}

      <div className="rounded-lg border border-white/10 bg-primary/40 p-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/40">
          <StickyNote className="h-3 w-3" />
          Clinician Notes
        </p>
        <textarea
          value={noteDraft}
          onChange={(e) => onNoteDraftChange(e.target.value)}
          disabled={activePatientId === null}
          placeholder={activePatientId === null ? "Select a patient to add notes" : "Quick note for this patient…"}
          rows={3}
          className="w-full resize-none rounded-md border border-white/10 bg-primary-dark/60 p-2 text-xs text-white placeholder:text-white/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-secondary disabled:opacity-40"
        />
        <button
          onClick={onSaveNote}
          disabled={activePatientId === null || !noteDraft.trim()}
          className="mt-2 w-full rounded-md border border-secondary/30 bg-secondary/10 py-1.5 text-xs font-semibold text-secondary hover:bg-secondary/15 disabled:pointer-events-none disabled:opacity-30"
        >
          Save note
        </button>
      </div>
    </aside>
  );
}