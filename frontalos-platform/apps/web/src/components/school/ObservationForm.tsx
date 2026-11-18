"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FieldError, labelClass, inputClass } from "@/components/auth/AuthCard";
import { cn } from "@/lib/utils";
import { useSubmitClassroomObservation } from "@/lib/api/useSchoolQueries";
import type { ClassroomObservationInput } from "@/lib/api/schoolClient";

const NOTES_MAX_LENGTH = 1000;

const observationSchema = z.object({
  attentionDuringLesson: z.enum(["consistently_focused", "some_drifting", "frequently_distracted"], {
    errorMap: () => ({ message: "Select an option" }),
  }),
  peerInteraction: z.enum(["positive", "mixed", "withdrawn_or_conflict"], {
    errorMap: () => ({ message: "Select an option" }),
  }),
  taskCompletion: z.enum(["completed_independently", "completed_with_support", "incomplete"], {
    errorMap: () => ({ message: "Select an option" }),
  }),
  notes: z.string().max(1000, "Keep notes under 1000 characters").optional(),
});
type ObservationFormValues = z.infer<typeof observationSchema>;

const ATTENTION_OPTIONS: Array<{ value: ObservationFormValues["attentionDuringLesson"]; label: string }> = [
  { value: "consistently_focused", label: "Consistently focused" },
  { value: "some_drifting", label: "Some drifting" },
  { value: "frequently_distracted", label: "Frequently distracted" },
];

const PEER_OPTIONS: Array<{ value: ObservationFormValues["peerInteraction"]; label: string }> = [
  { value: "positive", label: "Positive" },
  { value: "mixed", label: "Mixed" },
  { value: "withdrawn_or_conflict", label: "Withdrawn / conflict" },
];

const TASK_OPTIONS: Array<{ value: ObservationFormValues["taskCompletion"]; label: string }> = [
  { value: "completed_independently", label: "Completed independently" },
  { value: "completed_with_support", label: "Completed with support" },
  { value: "incomplete", label: "Incomplete" },
];

function SegmentedField<T extends string>({
  legend,
  options,
  value,
  onChange,
  error,
}: {
  legend: string;
  options: Array<{ value: T; label: string }>;
  value: T | undefined;
  onChange: (value: T) => void;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className={labelClass}>{legend}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-sm font-medium text-left transition-colors",
              value === opt.value
                ? "border-secondary bg-secondary-light text-primary-dark"
                : "border-primary/10 text-muted hover:border-primary/20"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}

export function ObservationForm({ studentId, studentName }: { studentId: number | null; studentName?: string }) {
  const submitObservation = useSubmitClassroomObservation();
  const [resetKey, setResetKey] = useState(0);
  const [lastSubmittedAt, setLastSubmittedAt] = useState<Date | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ObservationFormValues>({ resolver: zodResolver(observationSchema) });

  const values = watch();
  const notesLength = values.notes?.length ?? 0;

  async function onSubmit(formValues: ObservationFormValues) {
    if (studentId === null) return;
    const input: ClassroomObservationInput = { patientId: studentId, ...formValues };
    try {
      await submitObservation.mutateAsync(input);
      reset();
      setResetKey((k) => k + 1);
      setLastSubmittedAt(new Date());
      toast.success(studentName ? `Observation logged for ${studentName}.` : "Observation logged.");
    } catch {
      // submitObservation.isError renders the inline banner below; nothing further to do here.
    }
  }

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-secondary" />
            <div>
              <h3 className="font-display text-lg font-semibold text-primary-dark">Submit Classroom Observation</h3>
              <p className="text-xs text-muted">
                {studentName ? `For ${studentName}` : "Select a student from the roster first"}
              </p>
            </div>
          </div>
          {lastSubmittedAt && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary-light px-2.5 py-1 text-[11px] font-medium text-secondary">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Logged{" "}
              {lastSubmittedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
        </div>

        <form key={resetKey} onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <SegmentedField
            legend="Attention during lesson"
            options={ATTENTION_OPTIONS}
            value={values.attentionDuringLesson}
            onChange={(v) => setValue("attentionDuringLesson", v, { shouldValidate: true })}
            error={errors.attentionDuringLesson?.message}
          />
          <SegmentedField
            legend="Peer interaction"
            options={PEER_OPTIONS}
            value={values.peerInteraction}
            onChange={(v) => setValue("peerInteraction", v, { shouldValidate: true })}
            error={errors.peerInteraction?.message}
          />
          <SegmentedField
            legend="Task completion"
            options={TASK_OPTIONS}
            value={values.taskCompletion}
            onChange={(v) => setValue("taskCompletion", v, { shouldValidate: true })}
            error={errors.taskCompletion?.message}
          />

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="notes" className={labelClass}>
                Additional notes (optional)
              </label>
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  notesLength > NOTES_MAX_LENGTH ? "text-accent" : "text-muted"
                )}
              >
                {notesLength}/{NOTES_MAX_LENGTH}
              </span>
            </div>
            <textarea
              id="notes"
              rows={3}
              className={cn(inputClass, "h-auto py-2.5 resize-none")}
              {...register("notes")}
            />
            <FieldError message={errors.notes?.message} />
          </div>

          {submitObservation.isError && (
            <p className="rounded-lg border border-accent/30 bg-accent-soft/60 px-3 py-2 text-xs text-primary-dark" role="alert">
              Couldn&apos;t submit this observation. Check your connection and try again.
            </p>
          )}

          <Button type="submit" disabled={studentId === null || submitObservation.isPending} className="w-full">
            {submitObservation.isPending ? "Submitting…" : "Submit observation"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}