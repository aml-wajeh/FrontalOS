// apps/web/src/app/(admin)/admin/dashboard/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Console — FrontalOS",
  description: "Manage users, review the audit log, and check platform health.",
};

export { default } from "./AdminDashboardClient";
