"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications, useMarkNotificationRead } from "@/lib/api/notificationsClient";
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/DataState";

export function NotificationsBell({ chromeText, chromeHoverBg }: { chromeText: string; chromeHoverBg?: string }) {
  const [open, setOpen] = useState(false);
  const { data: notifications = [], isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        className={cn("relative rounded-full p-2 transition-colors", chromeHoverBg, chromeText)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-primary-dark">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* click-away layer */}
            <button
              type="button"
              aria-label="Close notifications"
              className="fixed inset-0 z-30 cursor-default"
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 z-40 mt-2 w-80 origin-top-right rounded-2xl border border-primary/[0.06] bg-white shadow-[0_20px_40px_-24px_rgba(16,23,42,0.35)]"
            >
              <div className="border-b border-primary/[0.06] px-4 py-3">
                <p className="text-sm font-semibold text-primary-dark">Notifications</p>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                {isLoading && <SkeletonList rows={3} />}
                {isError && !isLoading && (
                  <ErrorState
                    title="Couldn't load notifications"
                    height="h-32"
                    onRetry={() => refetch()}
                  />
                )}
                {!isLoading && !isError && notifications.length === 0 && (
                  <EmptyState
                    title="You're all caught up"
                    subtitle="New updates will show up here."
                    height="h-32"
                    icon={<BellOff className="h-5 w-5" aria-hidden="true" />}
                  />
                )}
                {!isLoading &&
                  !isError &&
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => !n.isRead && markRead.mutate(n.id)}
                      className={cn(
                        "block w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-canvas",
                        !n.isRead && "bg-secondary-light/40"
                      )}
                    >
                      <p className="text-sm font-medium text-primary-dark">{n.title}</p>
                      <p className="mt-0.5 text-xs text-muted line-clamp-2">{n.message}</p>
                    </button>
                  ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
