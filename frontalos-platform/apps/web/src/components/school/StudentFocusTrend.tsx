"use client";

import { LineChart as LineChartIcon } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { FocusSleepComposedChartDynamic } from "@/components/parent/FocusSleepComposedChart.dynamic";
import { useStudentFocusTrend } from "@/lib/api/useSchoolQueries";

/**
 * Teacher-facing wrapper around the same chart component the Parent
 * Command Center uses (components/parent/FocusSleepComposedChart.tsx) —
 * per the task spec, teachers get a "simplified permission-scoped view",
 * not a separate chart implementation to maintain. The simplification is:
 * no KPI cards, no forecast/radar, no PII beyond the trend itself — just
 * the Focus line, which is exactly what a classroom-observation workflow
 * needs and nothing a teacher shouldn't see (sleep hours are always null
 * from this endpoint anyway — see toComposedChartData's docstring).
 */
export function StudentFocusTrend({ studentId, studentName }: { studentId: number | null; studentName?: string }) {
  const { chartData, isLoading, isError, refetch } = useStudentFocusTrend(studentId);

  if (studentId === null) {
    return (
      <Card>
        <CardBody className="flex h-64 flex-col items-center justify-center gap-2 text-center">
          <LineChartIcon className="h-6 w-6 text-muted" />
          <p className="text-sm font-medium text-primary-dark">Select a student</p>
          <p className="text-xs text-muted">Choose someone from the class roster to see their Focus trend.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div>
      {studentName && <p className="mb-2 text-xs font-medium text-muted">Showing trend for {studentName}</p>}
      <FocusSleepComposedChartDynamic data={chartData} isLoading={isLoading} isError={isError} onRetry={refetch} />
    </div>
  );
}
