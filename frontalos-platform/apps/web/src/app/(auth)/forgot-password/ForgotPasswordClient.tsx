"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { toast } from "sonner";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/validation/authSchemas";
import { AuthCard, FieldError, inputClass, labelClass } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordFormValues) {
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      // Always show success regardless of res.ok's body shape — deliberately
      // never confirms/denies whether the email is registered (see the
      // route handler's docstring for why).
      setSent(true);
      toast.success(data.message ?? "Check your email for a reset link.");
    } catch {
      toast.error("Network error", { description: "Please try again." });
    }
  }

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        subtitle="If an account exists for that address, we've sent a link to reset your password."
      >
        <Link href="/login" className="text-sm font-semibold text-primary-dark hover:underline">
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <Link href="/login" className="font-semibold text-primary-dark hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input id="email" type="email" autoComplete="email" className={inputClass} {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthCard>
  );
}
