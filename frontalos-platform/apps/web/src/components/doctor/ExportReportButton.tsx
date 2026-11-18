"use client";

import { CheckCircle2, FileDown, Loader2 } from "lucide-react";
import { useExportReport } from "@/lib/api/useDoctorQueries";

interface ExportReportButtonProps {
  patientId: number;
}

export function ExportReportButton({ patientId }: ExportReportButtonProps) {
  const mutation = useExportReport();

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => mutation.mutate(patientId)}
        disabled={mutation.isPending}
        className="flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-primary-dark shadow-[0_8px_24px_-8px_rgba(0,194,168,0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary/90 hover:shadow-[0_12px_32px_-8px_rgba(0,194,168,0.65)] active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        {mutation.isPending ? "Generating PDF…" : "Export Certified PDF Report"}
      </button>

      {mutation.isSuccess && (
        <span className="flex items-center gap-1.5 text-xs text-secondary">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Saved {mutation.data}
        </span>
      )}
      {mutation.isError && (
        <span className="text-xs text-danger-on-dark">
          {mutation.error instanceof Error ? mutation.error.message : "Report generation failed."}
        </span>
      )}
    </div>
  );
}
