"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { loginSchema, type LoginFormValues } from "@/lib/validation/authSchemas";
import { AuthCard, FieldError, inputClass, labelClass } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { notifySessionRestored } from "@/lib/api/httpClient";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginFormValues) {
    setSubmitError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.detail ?? "Login failed");
        toast.error("Couldn't sign you in", { description: data.detail ?? "Check your details and try again." });
        return;
      }

      toast.success(`Welcome back, ${data.user.fullName.split(" ")[0]}!`);
      notifySessionRestored();
      const next = searchParams.get("next");
      router.push(next && next.startsWith("/") ? next : data.redirectTo ?? "/");
      router.refresh();
    } catch {
      setSubmitError("Network error — please try again.");
      toast.error("Network error", { description: "Please try again." });
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your FrontalOS portal"
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="font-semibold text-primary-dark hover:underline">
            Create an account
          </Link>
        </>
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

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <Link href="/forgot-password" className="text-xs font-medium text-primary-dark hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={inputClass}
            {...register("password")}
          />
          <FieldError message={errors.password?.message} />
        </div>

        {submitError && <p className="text-sm text-danger">{submitError}</p>}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
