"use client";

import { useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/DataState";
import { ADMIN_ASSIGNABLE_ROLES, type AdminAssignableRole, type AdminUser } from "@/lib/api/adminClient";
import {
  useAdminUsers,
  useDeactivateUser,
  useReactivateUser,
  useSetUserRole,
} from "@/lib/api/useAdminQueries";
import { cn } from "@/lib/utils";

/**
 * components/admin/UsersTable.tsx
 *
 * The minimum admin console recommended in the staff audit (docs/AUDIT.md
 * §6.5 / §c): before this, the only way to deactivate a user or change
 * their role was a manual SQL statement against the database — every
 * User/Role/UserRole model already existed, but nothing exposed them.
 */
export function UsersTable() {
  const { data: users, isLoading, isError, refetch } = useAdminUsers();
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();
  const setRole = useSetUserRole();

  return (
    <Card id="users" className="overflow-hidden">
      <div className="border-b border-primary/[0.06] px-5 py-4 sm:px-6">
        <h2 className="font-display text-lg font-bold text-primary-dark">Users</h2>
        <p className="mt-0.5 text-sm text-muted">
          Deactivate an account or change its role. Every action here is written to the audit log below.
        </p>
      </div>

      <div className="p-5 sm:p-6">
        {isLoading ? (
          <SkeletonList rows={5} />
        ) : isError ? (
          <ErrorState title="Couldn't load users" onRetry={() => refetch()} />
        ) : !users || users.length === 0 ? (
          <EmptyState title="No users yet" subtitle="Registered accounts will show up here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-primary/[0.08] text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="pb-2.5 pr-4">User</th>
                  <th className="pb-2.5 pr-4">Role</th>
                  <th className="pb-2.5 pr-4">Status</th>
                  <th className="pb-2.5 pr-4">Joined</th>
                  <th className="pb-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onDeactivate={() => deactivate.mutate(user.id)}
                    onReactivate={() => reactivate.mutate(user.id)}
                    onSetRole={(role) => setRole.mutate({ userId: user.id, role })}
                    isMutating={deactivate.isPending || reactivate.isPending || setRole.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

function UserRow({
  user,
  onDeactivate,
  onReactivate,
  onSetRole,
  isMutating,
}: {
  user: AdminUser;
  onDeactivate: () => void;
  onReactivate: () => void;
  onSetRole: (role: AdminAssignableRole) => void;
  isMutating: boolean;
}) {
  const [roleDraft, setRoleDraft] = useState<AdminAssignableRole>(
    (user.roles[0] as AdminAssignableRole) ?? "parent"
  );
  const roleChanged = roleDraft !== user.roles[0];

  return (
    <tr className="border-b border-primary/[0.04] last:border-0">
      <td className="py-3 pr-4">
        <p className="font-medium text-primary-dark">{user.fullName}</p>
        <p className="text-xs text-muted">{user.email}</p>
      </td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <select
            value={roleDraft}
            onChange={(e) => setRoleDraft(e.target.value as AdminAssignableRole)}
            className="rounded-lg border border-primary/10 bg-white px-2 py-1.5 text-xs font-medium text-primary-dark focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            {ADMIN_ASSIGNABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          {roleChanged && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="h-8 px-3 text-xs"
              disabled={isMutating}
              onClick={() => onSetRole(roleDraft)}
            >
              Save
            </Button>
          )}
        </div>
      </td>
      <td className="py-3 pr-4">
        <Badge tone={user.isActive ? "teal" : "amber"}>{user.isActive ? "Active" : "Inactive"}</Badge>
      </td>
      <td className="py-3 pr-4 text-xs text-muted">
        {new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
      </td>
      <td className="py-3 text-right">
        <Button
          type="button"
          variant="ghost"
          size="md"
          className={cn(
            "h-8 px-3 text-xs",
            user.isActive ? "text-primary-dark hover:bg-accent-soft" : "text-primary-dark hover:bg-secondary-light"
          )}
          disabled={isMutating}
          onClick={user.isActive ? onDeactivate : onReactivate}
        >
          {user.isActive ? (
            <>
              <ShieldOff className="h-3.5 w-3.5" /> Deactivate
            </>
          ) : (
            <>
              <ShieldCheck className="h-3.5 w-3.5" /> Reactivate
            </>
          )}
        </Button>
      </td>
    </tr>
  );
}
