"use client";

/**
 * lib/clinician/clinicianWorkspace.ts
 *
 * The Clinical Portal's patient roster (with status tags), clinician notes,
 * and medication dose schedule have no backing endpoint anywhere in
 * cortix-api today — there's no `patients` list route, no `notes` table,
 * and no `medications`/`doses` table in database/models/ (see
 * doctorClient.ts header and database/models/clinical.py). Rather than
 * fabricate a fake API, this is a real, working local workspace (persisted
 * to localStorage, per browser/device) that the clinician populates
 * themselves — the status tag on a roster entry, the text of a note, and
 * the timing of a medication block are all real input the clinician typed,
 * not invented data standing in for a real record.
 *
 * Swapping this for a server-backed store later is a matter of replacing
 * the localStorage read/write below with React Query calls against real
 * `/api/v1/patients`, `/api/v1/notes`, and `/api/v1/medications` endpoints
 * — the public shape (RosterEntry, ClinicianNote, MedicationDose,
 * useClinicianWorkspace) can stay the same.
 */

import { useCallback, useEffect, useState } from "react";

export type PatientStatus = "Initial Consult" | "ADHD Monitoring" | "Neurofeedback";

export interface RosterEntry {
  patientId: number;
  displayName: string;
  status: PatientStatus;
  addedAt: string; // ISO
}

export interface ClinicianNote {
  id: string;
  patientId: number;
  body: string;
  createdAt: string; // ISO
}

export interface MedicationDose {
  id: string;
  patientId: number;
  label: string; // e.g. "Methylphenidate 10mg"
  dayOffset: number; // 0-29, position along the 30-day timeline
  startHour: number; // 0-24
  durationHours: number; // block width
}

interface WorkspaceState {
  roster: RosterEntry[];
  notes: ClinicianNote[];
  doses: MedicationDose[];
}

const STORAGE_KEY = "frontalos_clinician_workspace_v1";

function readState(): WorkspaceState {
  if (typeof window === "undefined") return { roster: [], notes: [], doses: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { roster: [], notes: [], doses: [] };
    const parsed = JSON.parse(raw);
    return {
      roster: parsed.roster ?? [],
      notes: parsed.notes ?? [],
      doses: parsed.doses ?? [],
    };
  } catch {
    return { roster: [], notes: [], doses: [] };
  }
}

function writeState(state: WorkspaceState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (private browsing quota, etc.) — silently no-op,
    // same tolerance rewardWallet.ts uses.
  }
}

export function useClinicianWorkspace() {
  const [state, setState] = useState<WorkspaceState>({ roster: [], notes: [], doses: [] });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readState());
    setHydrated(true);
  }, []);

  const addPatient = useCallback(
    (patientId: number, displayName: string, status: PatientStatus) => {
      setState((prev) => {
        if (prev.roster.some((r) => r.patientId === patientId)) return prev;
        const next: WorkspaceState = {
          ...prev,
          roster: [...prev.roster, { patientId, displayName, status, addedAt: new Date().toISOString() }],
        };
        writeState(next);
        return next;
      });
    },
    []
  );

  const updateStatus = useCallback((patientId: number, status: PatientStatus) => {
    setState((prev) => {
      const next: WorkspaceState = {
        ...prev,
        roster: prev.roster.map((r) => (r.patientId === patientId ? { ...r, status } : r)),
      };
      writeState(next);
      return next;
    });
  }, []);

  const removePatient = useCallback((patientId: number) => {
    setState((prev) => {
      const next: WorkspaceState = { ...prev, roster: prev.roster.filter((r) => r.patientId !== patientId) };
      writeState(next);
      return next;
    });
  }, []);

  const addNote = useCallback((patientId: number, body: string) => {
    if (!body.trim()) return;
    setState((prev) => {
      const next: WorkspaceState = {
        ...prev,
        notes: [
          { id: crypto.randomUUID(), patientId, body: body.trim(), createdAt: new Date().toISOString() },
          ...prev.notes,
        ],
      };
      writeState(next);
      return next;
    });
  }, []);

  const addDose = useCallback((dose: Omit<MedicationDose, "id">) => {
    setState((prev) => {
      const next: WorkspaceState = { ...prev, doses: [...prev.doses, { ...dose, id: crypto.randomUUID() }] };
      writeState(next);
      return next;
    });
  }, []);

  return {
    hydrated,
    roster: state.roster,
    notes: state.notes,
    doses: state.doses,
    addPatient,
    updateStatus,
    removePatient,
    addNote,
    addDose,
    notesFor: (patientId: number) => state.notes.filter((n) => n.patientId === patientId),
    dosesFor: (patientId: number) => state.doses.filter((d) => d.patientId === patientId),
  };
}
