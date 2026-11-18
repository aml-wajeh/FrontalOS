"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PatientSidebar } from "@/components/doctor/PatientSidebar";
import { ClinicalHeader } from "@/components/doctor/ClinicalHeader";
import { MriAnalyzer } from "@/components/doctor/MriAnalyzer";
import { BehavioralPanelDynamic } from "@/components/doctor/BehavioralPanel.dynamic";
import { BehavioralSyncTimeline } from "@/components/doctor/BehavioralSyncTimeline";
import { ExportReportButton } from "@/components/doctor/ExportReportButton";
import { useCurrentUser, useMyPatients } from "@/lib/api/useDoctorQueries";
import { useClinicianWorkspace } from "@/lib/clinician/clinicianWorkspace";

export default function DoctorDashboardPage() {
  const { data: user } = useCurrentUser();
  const {
    patients: mountedRoster,
    routeNotMountedYet,
    isLoading: rosterLoading,
    isError: rosterError,
    refetch: refetchRoster,
  } = useMyPatients();
  const workspace = useClinicianWorkspace();
  const [activePatientId, setActivePatientId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  // Once the real GET /api/v1/patients route exists, this seeds the local
  // roster from it automatically (see useMyPatients / doctorClient.ts).
  useEffect(() => {
    if (!workspace.hydrated) return;
    for (const p of mountedRoster) {
      workspace.addPatient(p.id, p.name, "ADHD Monitoring");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountedRoster, workspace.hydrated]);

  useEffect(() => {
    if (activePatientId === null && workspace.roster.length > 0) {
      setActivePatientId(workspace.roster[0].patientId);
    }
  }, [activePatientId, workspace.roster]);

  const activePatient = workspace.roster.find((r) => r.patientId === activePatientId) ?? null;

  return (
    <AppShell persona="doctor" title="Clinical Portal">
    <div className="flex min-h-full flex-col lg:flex-row">
      <PatientSidebar
        roster={workspace.roster}
        activePatientId={activePatientId}
        onSelectPatient={setActivePatientId}
        onAddPatient={workspace.addPatient}
        onRemovePatient={(id) => {
          workspace.removePatient(id);
          if (activePatientId === id) setActivePatientId(null);
        }}
        noteDraft={noteDraft}
        onNoteDraftChange={setNoteDraft}
        onSaveNote={() => {
          if (activePatientId === null) return;
          workspace.addNote(activePatientId, noteDraft);
          setNoteDraft("");
        }}
        roosterGapNote={
          routeNotMountedYet
            ? "No patient roster endpoint live yet — add patients manually below to review them here."
            : undefined
        }
        rosterLoading={rosterLoading}
        rosterError={rosterError}
        onRetryRoster={() => refetchRoster()}
      />

      <div className="flex-1 space-y-6 p-5 sm:p-8">
        <ClinicalHeader doctorName={user?.full_name ?? "—"} patient={activePatient} />

        <div
          role="note"
          title="Roster, clinician notes, and dose blocks live in this browser's storage only — there is no /api/v1/patients, /notes, or /medications endpoint yet (see lib/clinician/clinicianWorkspace.ts). Clearing site data or switching browsers/devices loses them, and colleagues won't see them."
          className="flex items-start gap-2 rounded-lg border border-dashed border-accent/30 bg-accent/[0.06] px-3 py-2 text-[11px] leading-relaxed text-accent/90"
        >
          <span aria-hidden className="mt-0.5">⚠</span>
          <span>
            Saved on this device only — patient roster, notes, and dose blocks aren&apos;t synced to a server or
            shared with other clinicians yet. Don&apos;t rely on this for the permanent record.
          </span>
        </div>

        {activePatientId === null ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-white/30">
            Add or select a patient from the roster to begin a clinical review.
          </div>
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-2">
              <MriAnalyzer patientId={activePatientId} />
              <BehavioralPanelDynamic patientId={activePatientId} />
            </div>

            <BehavioralSyncTimeline
              patientId={activePatientId}
              doses={workspace.dosesFor(activePatientId)}
              onAddDose={workspace.addDose}
            />

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
              <ExportReportButton patientId={activePatientId} />
              <p className="text-[11px] text-white/25">
                {workspace.notesFor(activePatientId).length} note
                {workspace.notesFor(activePatientId).length === 1 ? "" : "s"} on file for this patient
              </p>
            </div>
          </>
        )}
      </div>
    </div>
    </AppShell>
  );
}