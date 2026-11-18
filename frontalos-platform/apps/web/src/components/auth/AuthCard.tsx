import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/Card";

/** Shared shell every (auth) page renders its form inside — same card, same width. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full max-w-md">
      <Card className="shadow-[0_1px_2px_rgba(16,23,42,0.04),0_32px_64px_-24px_rgba(16,23,42,0.18)]">
        <CardBody className="space-y-6">
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl text-primary">{title}</h1>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          {children}
        </CardBody>
      </Card>
      {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-medium text-danger">{message}</p>;
}

export const inputClass =
  "w-full rounded-xl border border-primary/10 bg-white px-4 h-11 text-sm text-ink " +
  "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export const labelClass = "block text-sm font-medium text-primary mb-1.5";
