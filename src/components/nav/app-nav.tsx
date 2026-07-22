"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import { NAV_ITEMS, BOTTOM_NAV, SECONDARY_NAV } from "./nav-items";

function useActive() {
  const pathname = usePathname();
  return (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2">
      <span className="flex size-6 items-center justify-center rounded-md border border-accent/40 text-accent">
        <Flame className="size-3.5" />
      </span>
      <span className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-text">
        Hell&nbsp;Blazer
      </span>
    </Link>
  );
}

export function AppNav({ userEmail }: { userEmail?: string }) {
  const isActive = useActive();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface/40 px-3 py-5 md:flex">
        <div className="px-2">
          <Brand />
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:bg-surface-2 hover:text-text",
                )}
              >
                <item.icon
                  className={cn(
                    "size-4.5 shrink-0",
                    active ? "text-accent" : "text-muted group-hover:text-text",
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-border pt-3">
          {userEmail && (
            <p className="truncate px-3 pb-2 text-xs text-muted" title={userEmail}>
              {userEmail}
            </p>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-danger"
            >
              <LogOut className="size-4.5" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar — pads into the notch via safe-area inset */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-border bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Brand />
          <div className="flex items-center gap-1">
            {SECONDARY_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={cn(
                  "flex size-10 items-center justify-center rounded-lg transition-transform active:scale-90",
                  isActive(item.href)
                    ? "bg-accent/10 text-accent"
                    : "text-muted",
                )}
              >
                <item.icon className="size-5" />
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {BOTTOM_NAV.map((item) => {
          const active = isActive(item.href);
          const isLog = item.href === "/log";
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1 py-2.5 transition-transform active:scale-90"
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg transition-colors",
                  isLog && "bg-accent text-bg shadow-glow",
                  !isLog && active && "text-accent",
                  !isLog && !active && "text-muted",
                )}
              >
                <item.icon className="size-5" />
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  active ? "text-accent" : "text-muted",
                  isLog && "text-accent",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
