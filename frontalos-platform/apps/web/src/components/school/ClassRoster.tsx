"use client";

import { GraduationCap, Users } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/DataState";
import { cn } from "@/lib/utils";
import { useLinkedStudents } from "@/lib/api/useSchoolQueries";
import type { LinkedStudent } from "@/lib/api/schoolClient";

const STATUS_LABEL: Record<LinkedStudent["status"], string> = {
  on_track: "On track",
  needs_attention: "Needs attention",
  unknown: "Not enough data",
};

const STATUS_TONE: Record<LinkedStudent["status"], "teal" | "amber" | "navy"> = {
  on_track: "teal",
  needs_attention: "amber",
  unknown: "navy",
};

export function ClassRoster({
  selectedStudentId,
  onSelectStudent,
}: {
  selectedStudentId: number | null;
  onSelectStudent: (id: number) => void;
}) {
  const { data: students = [], isLoading, isError, refetch } = useLinkedStudents();

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-secondary" />
          <h3 className="font-display text-lg font-semibold text-primary-dark">Class Roster</h3>
        </div>

        {isLoading && <SkeletonList rows={3} />}

        {isError && !isLoading && (
          <ErrorState
            title="Couldn't load your roster"
            subtitle="Check your connection and try again."
            onRetry={() => refetch()}
            height="h-40"
          />
        )}

        {!isLoading && !isError && students.length === 0 && (
          <EmptyState
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
            title="No students linked yet"
            subtitle="Students will appear here once a parent or doctor links your class to their profile."
            height="h-32"
          />
        )}

        {!isLoading && !isError && students.length > 0 && (
        <ul className="space-y-1.5">
          {students.map((student) => (
            <li key={student.id}>
              <button
                type="button"
                onClick={() => onSelectStudent(student.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left transition-all duration-200",
                  selectedStudentId === student.id
                    ? "bg-secondary-light shadow-[0_0_0_1px_rgba(0,194,168,0.25)]"
                    : "hover:translate-x-0.5 hover:bg-canvas"
                )}
              >
                <div>
                  <p className="text-sm font-semibold text-primary-dark">{student.name}</p>
                  <p className="text-xs text-muted">Age {student.age}</p>
                </div>
                <Badge tone={STATUS_TONE[student.status]}>{STATUS_LABEL[student.status]}</Badge>
              </button>
            </li>
          ))}
        </ul>
        )}
      </CardBody>
    </Card>
  );
}