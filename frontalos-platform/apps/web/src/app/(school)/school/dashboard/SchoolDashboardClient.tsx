"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ClassRoster } from "@/components/school/ClassRoster";
import { ObservationForm } from "@/components/school/ObservationForm";
import { StudentFocusTrend } from "@/components/school/StudentFocusTrend";
import { useLinkedStudents } from "@/lib/api/useSchoolQueries";

export default function SchoolDashboardPage() {
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const { data: students = [] } = useLinkedStudents();
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <AppShell persona="school" title="School Portal">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary-dark sm:text-3xl">Class Overview</h1>
          <p className="mt-1 text-sm text-muted">
            Track your linked students&apos; classroom status and log structured observations for their care team.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <div id="roster">
            <ClassRoster selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} />
          </div>

          <div className="space-y-6">
            <div id="trends">
              <StudentFocusTrend studentId={selectedStudentId} studentName={selectedStudent?.name} />
            </div>
            <div id="observations">
              <ObservationForm studentId={selectedStudentId} studentName={selectedStudent?.name} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
