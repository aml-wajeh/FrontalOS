"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  registerSchema,
  REGISTERABLE_ROLES,
  ROLE_LABELS,
  type RegisterFormValues,
} from "@/lib/validation/authSchemas";
import { AuthCard, FieldError, inputClass, labelClass } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// Why there's no "child" option here even though the backend's VALID_ROLES
// set includes it (services/cortix-api/auth/router.py): a self-serve child
// sign-up would let a minor create their own account/password with no
// guardian involved at all — the exact risk COPPA-style parental-consent
// rules exist to prevent. Instead, a Patient row (the "child") is always
// provisioned FROM INSIDE the Parent or Doctor portal by an already-
// authenticated adult, who supplies the child's name/age and becomes their
// guardian_id/doctor_id (database/models/clinical.py) — never the child
// registering themselves here. See app/api/auth/register/route.ts for the
// matching server-side enforcement of this rule.
export default function RegisterPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const selectedRole = watch("role");

  async function onSubmit(values: RegisterFormValues) {
    setSubmitError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.detail ?? "Registration failed");
        toast.error("Couldn't create your account", { description: data.detail ?? "Please try again." });
        return;
      }

      toast.success("Account created — sign in to continue.");
      router.push("/login");
    } catch {
      setSubmitError("Network error — please try again.");
      toast.error("Network error", { description: "Please try again." });
    }
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="For parents, doctors, and schools — child accounts are set up by a parent or doctor after they sign in."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary-dark hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label htmlFor="fullName" className={labelClass}>
            Full name
          </label>
          <input id="fullName" autoComplete="name" className={inputClass} {...register("fullName")} />
          <FieldError message={errors.fullName?.message} />
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input id="email" type="email" autoComplete="email" className={inputClass} {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>

        <div>
          <span className={labelClass}>I am a…</span>
          <div className="grid grid-cols-2 gap-2">
            {REGISTERABLE_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setValue("role", role, { shouldValidate: true })}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-sm font-medium text-left transition-colors",
                  selectedRole === role
                    ? "border-secondary bg-secondary-light text-primary-dark"
                    : "border-primary/10 text-muted hover:border-primary/20"
                )}
              >
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>
          <FieldError message={errors.role?.message} />
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            {...register("password")}
          />
          <FieldError message={errors.password?.message} />
        </div>

        <div>
          <label htmlFor="confirmPassword" className={labelClass}>
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            {...register("confirmPassword")}
          />
          <FieldError message={errors.confirmPassword?.message} />
        </div>

        {submitError && <p className="text-sm text-danger">{submitError}</p>}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}
