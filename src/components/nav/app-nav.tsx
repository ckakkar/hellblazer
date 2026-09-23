"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Ellipsis, Flame, LogOut, Plus } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import {
  NAV_SECTIONS,
  SETTINGS_ITEM,
  BOTTOM_NAV,
  SECONDARY_NAV,
  type NavItem,
} from "./nav-items";

/** The compact title the mobile top bar shows once the large one scrolls off. */
const TITLES: [prefix: string, title: string][] = [
  ["/dashboard", "Home"],
  ["/log/", "Workout"],
  ["/log", "Log"],
  ["/programs/", "Program"],
  ["/programs", "Programs"],
  ["/progress", "Progress"],
  ["/history/", "Session"],
  ["/history", "History"],
  ["/leaderboard", "King of the Hill"],
  ["/templates", "Templates"],
  ["/exercises", "Exercises"],
  ["/settings", "Profile"],
];
function titleFor(pathname: string) {
  return TITLES.find(([p]) => pathname === p || pathname.startsWith(p))?.[1] ?? "";
}

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(href + "/");
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <Flame className="size-5 text-accent" strokeWidth={2.25} />
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-text">
        Hell Blazer
      </span>
    </Link>
  );
}

/* The active highlight carries a view-transition name, so on navigation the
   browser morphs the old highlight into the new one: the selection visibly
   travels to where you went, with no JavaScript animating it. */
function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors",
        active ? "text-text" : "text-muted hover:text-text",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-xl bg-white/[0.07]"
          style={{ viewTransitionName: "hb-side-active" }}
        />
      )}
      <item.icon className="relative size-[18px] shrink-0" />
      <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
    </Link>
  );
}

export function AppNav({ userEmail }: { userEmail?: string }) {
  const isActive = useActive();

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-white/[0.06] bg-bg px-3 py-6 md:flex"
        style={{ viewTransitionName: "hb-sidebar" }}
      >
        <div className="px-3">
          <Brand />
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-6">
          {NAV_SECTIONS.map((section, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              {section.title && (
                <div className="px-3 pb-1.5 text-[12px] font-medium text-muted/70">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => (
                <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </div>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5">
          <SidebarLink item={SETTINGS_ITEM} active={isActive(SETTINGS_ITEM.href)} />
          {userEmail && (
            <p className="truncate px-3 pb-1 pt-2 text-[12px] text-muted/70" title={userEmail}>
              {userEmail}
            </p>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium text-muted transition-colors hover:text-danger"
            >
              <LogOut className="size-[18px]" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <MobileTopBar />

      {/* Mobile tab bar: a floating capsule of black glass. */}
      <nav
        className="hb-glass fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-30 grid h-16 grid-cols-5 rounded-[1.75rem] px-1.5 min-[400px]:inset-x-5 md:hidden"
        style={{ viewTransitionName: "hb-tabbar" }}
      >
        {BOTTOM_NAV.map((item) => {
          const active = isActive(item.href);
          const isLog = item.href === "/log";
          if (isLog) {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className="flex items-center justify-center"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-accent text-black">
                  <Plus className="size-5" strokeWidth={2.5} />
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 transition-colors",
                active ? "text-text" : "text-muted",
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-0.5 inset-y-1.5 rounded-[1.375rem] bg-white/[0.09]"
                  style={{ viewTransitionName: "hb-tab-active" }}
                />
              )}
              <item.icon className="relative size-[21px]" strokeWidth={active ? 2.25 : 1.75} />
              <span className="relative text-[10.5px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/* Mobile top bar. Clear at rest, frosting once content scrolls under it; the
   page's own title fades in at the same moment, iOS-style, so you always know
   where you are without a second heading on screen. Secondary destinations
   live behind one labelled "More" sheet instead of four bare icons. */
function MobileTopBar() {
  const pathname = usePathname();
  const isActive = useActive();
  const [more, setMore] = useState(false);
  const title = titleFor(pathname);

  return (
    <>
      <header
        className="hb-topbar fixed inset-x-0 top-0 z-30 pt-[env(safe-area-inset-top)] md:hidden"
        style={{ viewTransitionName: "hb-topbar" }}
      >
        <div className="relative flex h-11 items-center justify-between px-2 min-[400px]:px-3">
          <Link
            href="/dashboard"
            aria-label="Home"
            className="flex size-11 items-center justify-center rounded-full"
          >
            <Flame className="size-[22px] text-accent" strokeWidth={2.25} />
          </Link>
          <span
            aria-hidden
            className="hb-topbar-title pointer-events-none absolute inset-x-16 truncate text-center text-[16px] font-semibold tracking-[-0.015em] text-text"
          >
            {title}
          </span>
          <button
            type="button"
            onClick={() => setMore(true)}
            aria-label="More"
            className="flex size-11 items-center justify-center rounded-full text-text"
          >
            <Ellipsis className="size-[22px]" />
          </button>
        </div>
      </header>

      <Sheet open={more} onClose={() => setMore(false)} title="More">
        <nav className="px-4 pb-5">
          <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-white/[0.05]">
            {SECONDARY_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMore(false)}
                className="flex items-center gap-3.5 px-4 py-3.5 active:bg-white/[0.05]"
              >
                <item.icon
                  className={cn("size-5", isActive(item.href) ? "text-text" : "text-muted")}
                />
                <span className="flex-1 text-[16px] text-text">{item.label}</span>
                <ChevronRight className="size-4 text-muted/70" />
              </Link>
            ))}
          </div>
        </nav>
      </Sheet>
    </>
  );
}
