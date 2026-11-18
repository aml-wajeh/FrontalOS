// apps/web/src/app/(admin)/layout.tsx
//
// No local wrapper div here on purpose: AppShell (rendered inside
// AdminDashboardClient) already owns the full-viewport dark chrome for this
// persona (see components/shell/AppShell.tsx). A `bg-canvas` (light) div
// used to wrap it here — harmless visually since AppShell fills it, but
// misleading to read, since it never actually paints.
import { Providers } from "../providers";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
