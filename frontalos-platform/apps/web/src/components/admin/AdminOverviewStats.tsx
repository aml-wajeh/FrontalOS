"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { Users, ShieldCheck, Activity, ServerCog } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SkeletonList } from "@/components/ui/DataState";
import { useAdminUsers, useAdminAuditLog, useAdminSystemHealth } from "@/lib/api/useAdminQueries";
import { cn } from "@/lib/utils";

/**
 * components/admin/AdminOverviewStats.tsx
 *
 * Premium "at a glance" strip for the Admin Console — built on top of the
 * three real endpoints the admin portal already calls (users, audit-log,
 * system-health). No new backend surface: every number and chart here is
 * derived client-side from data the dashboard already fetches, so there's
 * nothing new to break or keep in sync with the API.
 */

const ROLE_COLORS: Record<string, string> = {
  parent: "var(--color-secondary)",
  child: "var(--color-accent)",
  doctor: "var(--color-primary)",
  psychologist: "var(--color-primary-soft)",
  school: "#6b7280",
  admin: "#2c375c",
};

function roleColor(role: string) {
  return ROLE_COLORS[role] ?? "var(--color-secondary)";
}

/** Counts up from 0 to `value` once, on mount / value change — the small
 * bit of motion that makes a stat card feel alive without being distracting
 * (Admin persona motion="none" in personaConfig, so this stays a single
 * ease-out count, never a loop). */
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let frame: number;
    const duration = 700;
    const from = display;
    const delta = value - from;
    if (delta === 0) return;
    startRef.current = null;

    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + delta * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
  glow,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sublabel: string;
  glow: "teal" | "amber" | "navy";
  delay: number;
}) {
  const glowClass =
    glow === "teal"
      ? "shadow-[var(--glow-teal)]"
      : glow === "amber"
        ? "shadow-[var(--glow-amber)]"
        : "shadow-[var(--glow-navy)]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      <Card className={cn("relative overflow-hidden p-5", glowClass)}>
        <div className="mesh-light pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1.5 font-display text-3xl font-bold text-primary-dark">
              <AnimatedNumber value={value} />
            </p>
            <p className="mt-1 text-xs text-muted">{sublabel}</p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary-light text-primary-dark">
            {icon}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function AdminOverviewStats() {
  const { data: users, isLoading: usersLoading } = useAdminUsers();
  const { data: auditLog, isLoading: auditLoading } = useAdminAuditLog(200);
  const { data: services } = useAdminSystemHealth();

  const isLoading = usersLoading || auditLoading;

  const roleBreakdown = useMemo(() => {
    if (!users) return [];
    const counts = new Map<string, number>();
    for (const u of users) {
      const role = u.roles[0] ?? "unassigned";
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([role, count]) => ({ role, count }));
  }, [users]);

  const activityByDay = useMemo(() => {
    if (!auditLog) return [];
    const buckets = new Map<string, number>();
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString(undefined, { weekday: "short" });
      buckets.set(key, 0);
    }
    for (const entry of auditLog) {
      const d = new Date(entry.createdAt);
      const diffDays = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
      if (diffDays >= 0 && diffDays <= 6) {
        const key = d.toLocaleDateString(undefined, { weekday: "short" });
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
    }
    return Array.from(buckets.entries()).map(([day, events]) => ({ day, events }));
  }, [auditLog]);

  const activeUsers = users?.filter((u) => u.isActive).length ?? 0;
  const totalUsers = users?.length ?? 0;
  const eventsToday = activityByDay.length > 0 ? activityByDay[activityByDay.length - 1].events : 0;
  const healthyServices = services?.filter((s) => s.reachable).length ?? 0;
  const totalServices = services?.length ?? 0;

  if (isLoading) {
    return (
      <Card className="p-6">
        <SkeletonList rows={3} />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Total accounts"
          value={totalUsers}
          sublabel={`${activeUsers} active`}
          glow="teal"
          delay={0}
        />
        <StatCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Active accounts"
          value={activeUsers}
          sublabel={totalUsers > 0 ? `${Math.round((activeUsers / totalUsers) * 100)}% of total` : "—"}
          glow="teal"
          delay={0.06}
        />
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          label="Events today"
          value={eventsToday}
          sublabel="Logins, registrations & admin actions"
          glow="amber"
          delay={0.12}
        />
        <StatCard
          icon={<ServerCog className="h-5 w-5" />}
          label="Services healthy"
          value={healthyServices}
          sublabel={`of ${totalServices || "—"} monitored`}
          glow="navy"
          delay={0.18}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3 p-5 sm:p-6">
          <h3 className="font-display text-base font-bold text-primary-dark">Platform activity — last 7 days</h3>
          <p className="mt-0.5 text-sm text-muted">Audit events per day, derived from the log below.</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityByDay} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminActivityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-secondary)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--color-secondary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(27,35,64,0.06)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: "var(--color-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "var(--color-muted)" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid rgba(27,35,64,0.08)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="events"
                  stroke="var(--color-secondary)"
                  strokeWidth={2.5}
                  fill="url(#adminActivityGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2 p-5 sm:p-6">
          <h3 className="font-display text-base font-bold text-primary-dark">Roles</h3>
          <p className="mt-0.5 text-sm text-muted">Distribution across registered accounts.</p>
          <div className="mt-2 h-56">
            {roleBreakdown.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted">No users yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleBreakdown}
                    dataKey="count"
                    nameKey="role"
                    innerRadius="58%"
                    outerRadius="85%"
                    paddingAngle={3}
                    stroke="none"
                  >
                    {roleBreakdown.map((entry) => (
                      <Cell key={entry.role} fill={roleColor(entry.role)} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(27,35,64,0.08)",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5">
            {roleBreakdown.map((entry) => (
              <li key={entry.role} className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: roleColor(entry.role) }}
                  aria-hidden="true"
                />
                <span className="capitalize">{entry.role}</span>
                <span className="font-semibold text-primary-dark">{entry.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
