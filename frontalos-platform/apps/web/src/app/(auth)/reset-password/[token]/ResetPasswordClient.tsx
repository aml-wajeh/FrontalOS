"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/validation/authSchemas";
import { AuthCard, FieldError, inputClass, labelClass } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: ResetPasswordFormValues) {
    setSubmitError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.token, password: values.password }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Real failure modes now: token invalid/expired/already-used, or a
        // network/server error — see services/cortix-api's
        // POST /auth/reset-password (auth/router.py) for the exact checks.
        setSubmitError(data.detail ?? "Couldn't reset your password");
        toast.error("Couldn't reset your password", { description: data.detail });
        return;
      }

      toast.success("Password updated — sign in with your new password.");
      router.push("/login");
    } catch {
      setSubmitError("Network error — please try again.");
      toast.error("Network error", { description: "Please try again." });
    }
  }

  return (
    <AuthCard title="Set a new password" subtitle="Choose a strong password for your account.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label htmlFor="password" className={labelClass}>
            New password
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
            Confirm new password
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
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthCard>
  );
}
