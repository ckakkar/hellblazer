"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Ellipsis, Flame, Play, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmIconButton } from "@/components/ui/confirm-icon-button";
import { FighterArt } from "@/components/tier/fighter-art";
import { useElapsed } from "@/components/resume-banner";
import { discardSession } from "@/lib/actions/sessions";
import { NAV_SECTIONS, BOTTOM_NAV, type NavItem } from "./nav-items";
import { MenuOverlay, type NavIdentity } from "./menu-overlay";
import { useWarmTabs } from "./warm-tabs";
import { useLiveSession, useLiveWorkout, type LiveWorkout } from "@/lib/live-workout";

const TAB_HREFS = BOTTOM_NAV.map((item) => item.href);

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

/** Pushed pages get an iOS back button in the top bar, to their parent. */
function backFor(pathname: string): { href: string; label: string } | null {
  if (/^\/history\/[^/]+$/.test(pathname)) return { href: "/history", label: "History" };
  if (/^\/programs\/[^/]+$/.test(pathname)) return { href: "/programs", label: "Programs" };
  return null;
}

/**
 * Tapping the tab you're on does what it does in any iOS app: on a page
 * pushed inside that tab it goes back to the tab's root (the link's normal
 * navigation), and on the root itself it scrolls to the top.
 */
function scrollToTopIfHere(e: React.MouseEvent, href: string, pathname: string) {
  if (pathname !== href) return;
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(href + "/");
}

/* The active highlight carries a view-transition name, so on navigation the
   browser morphs the old highlight into the new one: the selection visibly
   travels to where you went, with no JavaScript animating it. */
function ActiveHighlight() {
  return (
    <span
      aria-hidden
      className="absolute inset-0 rounded-xl bg-white/[0.07]"
      style={{ viewTransitionName: "hb-side-active" }}
    />
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      prefetch
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-medium tracking-[-0.01em] transition-colors",
        active ? "text-text" : "text-muted hover:text-text",
      )}
    >
      {active && <ActiveHighlight />}
      <item.icon className="relative size-[18px] shrink-0" />
      <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
    </Link>
  );
}

/**
 * The sidebar's one accent control. With nothing under way it starts a
 * workout; mid-workout it is the workout, with its clock running, so every
 * desktop page shows it without a banner across the top.
 */
function SidebarWorkout() {
  const live = useLiveSession();
  const pathname = usePathname();
  if (!live) {
    return (
      <Link
        href="/log"
        prefetch
        aria-current={pathname === "/log" ? "page" : undefined}
        className={cn(buttonVariants({ variant: "accent", size: "lg" }), "hb-glow w-full")}
      >
        <Plus className="size-[18px]" strokeWidth={2.5} />
        Start workout
      </Link>
    );
  }
  return <SidebarLiveCard live={live} here={pathname === `/log/${live.id}`} />;
}

function SidebarLiveCard({ live, here }: { live: LiveWorkout; here: boolean }) {
  const elapsed = useElapsed(live.startedAt);
  const [pending, start] = useTransition();
  const sets = `${live.workingSets} ${live.workingSets === 1 ? "set" : "sets"}`;
  return (
    <div className="rounded-2xl bg-surface p-3" aria-current={here ? "page" : undefined}>
      <div className="flex items-start gap-2.5 pl-0.5">
        <span className="mt-[7px] size-2 shrink-0 rounded-full bg-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-text">{live.title ?? "Workout"}</p>
          <p className="tnum truncate text-[13px] text-muted">
            {elapsed ? <span className="text-accent-ink">{elapsed}</span> : "In progress"}, {sets}
          </p>
        </div>
        {/* Discarding the workout you're looking at would pull the page out
            from under you; the logger has its own way out. */}
        {!here && (
          <ConfirmIconButton
            icon={X}
            label="Discard workout"
            confirmLabel="Click again to discard the workout"
            disabled={pending}
            onConfirm={() => start(async () => void (await discardSession({ id: live.id })))}
            className="-mr-1 -mt-1 rounded-full"
          />
        )}
      </div>
      {!here && (
        <Link
          href={`/log/${live.id}`}
          prefetch
          transitionTypes={["nav-forward"]}
          className={cn(buttonVariants({ variant: "accent" }), "hb-glow mt-3 w-full")}
        >
          <Play className="size-4" />
          Resume
        </Link>
      )}
    </div>
  );
}

/** The lifter at the foot of the sidebar: their fighter, name and rank. */
function SidebarYou({ identity, active }: { identity: NavIdentity; active: boolean }) {
  return (
    <Link
      href="/settings"
      prefetch
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl p-2 transition-colors",
        !active && "hover:bg-white/[0.04]",
      )}
    >
      {active && <ActiveHighlight />}
      {identity.tierKey ? (
        <FighterArt
          fighterKey={identity.tierKey}
          variant="thumbnail"
          className="relative size-10 shrink-0 rounded-[0.625rem] bg-surface-2"
        />
      ) : (
        <span className="font-display relative flex size-10 shrink-0 items-center justify-center rounded-[0.625rem] bg-surface-2 text-[17px] text-muted">
          {identity.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="relative min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-text">{identity.name}</span>
        <span className="block truncate text-[12px] text-muted">
          {identity.tierName
            ? `Rank ${identity.rank}, ${identity.tierName}`
            : identity.ringName
              ? `@${identity.ringName}`
              : "Profile and settings"}
        </span>
      </span>
    </Link>
  );
}

export function AppNav({
  userEmail,
  identity,
}: {
  userEmail?: string;
  identity: NavIdentity;
}) {
  const isActive = useActive();
  const pathname = usePathname();
  useWarmTabs(TAB_HREFS);
  // While a workout is under way, every "start one" control resumes it.
  const live = useLiveWorkout();
  const resume = (item: NavItem): NavItem =>
    live && item.href === "/log"
      ? { ...item, href: `/log/${live}`, label: "Resume workout", icon: Play }
      : item;

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        aria-label="Sidebar"
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-white/[0.06] bg-bg px-3 pb-3 pt-6 md:flex"
        style={{ viewTransitionName: "hb-sidebar" }}
      >
        <Link href="/dashboard" className="flex items-center gap-2 self-start px-3">
          <Flame className="size-[22px] text-accent" strokeWidth={2.25} />
          <span className="font-display text-[1.375rem] leading-none text-text">Fatty</span>
        </Link>
        <div className="mt-7">
          <SidebarWorkout />
        </div>
        <nav aria-label="Main" className="mt-7 flex flex-col gap-5">
          {NAV_SECTIONS.map((items, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              {items.map((item) => (
                <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </div>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/[0.06] pt-3">
          <SidebarYou identity={identity} active={isActive("/settings")} />
        </div>
      </aside>

      <MobileTopBar identity={identity} email={userEmail} />

      {/* Mobile tab bar: a floating capsule of black glass. */}
      <nav
        className="hb-glass fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-30 grid h-16 grid-cols-5 rounded-[1.75rem] px-1.5 min-[400px]:inset-x-5 md:hidden"
        style={{ viewTransitionName: "hb-tabbar" }}
      >
        {BOTTOM_NAV.map((item) => {
          const active = isActive(item.href);
          const isLog = item.href === "/log";
          if (isLog) {
            const target = resume(item);
            return (
              <Link
                key={item.href}
                href={target.href}
                prefetch
                aria-label={target.label}
                className="flex items-center justify-center"
              >
                <span className="hb-glow flex size-11 items-center justify-center rounded-full bg-accent text-black">
                  {live ? (
                    <Play className="size-5 fill-current" strokeWidth={2.5} />
                  ) : (
                    <Plus className="size-5" strokeWidth={2.5} />
                  )}
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onClick={(e) => scrollToTopIfHere(e, item.href, pathname)}
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
   live behind ••• in a full-page menu instead of four bare icons. */
function MobileTopBar({ identity, email }: { identity: NavIdentity; email?: string }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const title = titleFor(pathname);
  const back = backFor(pathname);

  return (
    <>
      <header
        className="hb-topbar fixed inset-x-0 top-0 z-30 pt-[env(safe-area-inset-top)] md:hidden"
        style={{ viewTransitionName: "hb-topbar" }}
      >
        <div className="relative flex h-11 items-center justify-between px-2 min-[400px]:px-3">
          {back ? (
            <Link
              href={back.href}
              transitionTypes={["nav-back"]}
              className="flex h-11 items-center pr-3 text-[17px] text-text active:opacity-60"
            >
              <ChevronLeft className="size-7 -mr-0.5" strokeWidth={2.25} />
              {back.label}
            </Link>
          ) : (
            <Link
              href="/dashboard"
              aria-label="Home"
              className="flex size-11 items-center justify-center rounded-full"
            >
              <Flame className="size-[22px] text-accent" strokeWidth={2.25} />
            </Link>
          )}
          <span
            aria-hidden
            className="hb-topbar-title pointer-events-none absolute inset-x-16 truncate text-center text-[16px] font-semibold tracking-[-0.015em] text-text"
          >
            {title}
          </span>
          <button
            type="button"
            onClick={() => setMore(true)}
            aria-label="Menu"
            aria-haspopup="dialog"
            aria-expanded={more}
            className="flex size-11 items-center justify-center rounded-full text-text"
          >
            <Ellipsis className="size-[22px]" />
          </button>
        </div>
      </header>

      <MenuOverlay
        open={more}
        onClose={() => setMore(false)}
        identity={identity}
        email={email}
      />
    </>
  );
}
