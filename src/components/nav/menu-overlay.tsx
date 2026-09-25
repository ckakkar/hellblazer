"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Flame, LogOut, Plus, Trophy, X } from "lucide-react";
import { FighterArt } from "@/components/tier/fighter-art";
import { Portal } from "@/components/ui/portal";
import { useModal, usePresence } from "@/components/ui/use-modal";
import { signOutOfApp } from "@/lib/sign-out";
import { MAX_RANK, type TierKey } from "@/lib/tiers";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV, SECONDARY_NAV } from "./nav-items";

/** Matches the `.hb-menu` exit transition in globals.css. */
const EXIT_MS = 240;

export type NavIdentity = {
  name: string;
  ringName: string | null;
  tierKey: TierKey | null;
  tierName: string | null;
  rank: number | null;
};

/** One line under each destination, so a tile says what's behind it. */
const HINTS: Record<string, string> = {
  "/history": "Sessions",
  "/templates": "Split days",
  "/exercises": "Library",
};

/**
 * The phone's full-page menu, behind the top bar's ••• (which becomes the ✕
 * in the same spot). The page frosts over and the menu rises in: who you
 * are first, then the destinations the tab bar has no room for as big
 * thumb-sized tiles, with King of the Hill fronted by the fighter at the top
 * of the ladder. One tap goes anywhere; the tab bar keeps the everyday five.
 */
export function MenuOverlay({
  open,
  onClose,
  identity,
  email,
}: {
  open: boolean;
  onClose: () => void;
  identity: NavIdentity;
  email?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const mounted = usePresence(open, EXIT_MS);
  useModal(open, panelRef, onClose);
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  if (!mounted) return null;
  const tiles = SECONDARY_NAV.filter((i) => i.href !== "/leaderboard");
  // The menu covers the tab bar, so it carries the main tabs too (Log is the
  // big button below, Profile is the card at the top).
  const main = BOTTOM_NAV.filter((i) => i.href !== "/log" && i.href !== "/settings");
  // Items rise in one after another, top to bottom.
  const rise = (i: number) => ({ animationDelay: `${60 + i * 45}ms` });

  return (
    <Portal>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        tabIndex={-1}
        data-state={open ? "open" : "closed"}
        className={cn(
          "hb-menu fixed inset-0 z-40 flex flex-col overflow-y-auto overscroll-contain focus:outline-none md:hidden",
          !open && "pointer-events-none",
        )}
      >
        <div aria-hidden className="hb-menu-scrim fixed inset-0 -z-10" />

        {/* Same row as the top bar, so the ✕ lands where the ••• was */}
        <div className="box-content flex h-11 shrink-0 items-center justify-between px-2 pt-[env(safe-area-inset-top)] min-[400px]:px-3">
          <Link
            href="/dashboard"
            onClick={onClose}
            aria-label="Home"
            className="flex size-11 items-center justify-center rounded-full"
          >
            <Flame className="size-[22px] text-accent" strokeWidth={2.25} />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="hb-menu-close flex size-11 items-center justify-center rounded-full bg-white/[0.08] text-text"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5 min-[400px]:px-5">
          {/* You */}
          <Link
            href="/settings"
            onClick={onClose}
            className="hb-hero-rise flex items-center gap-3.5 rounded-3xl bg-white/[0.07] p-3 pr-4 transition-colors active:bg-white/[0.1]"
            style={rise(0)}
          >
            {identity.tierKey ? (
              <FighterArt
                fighterKey={identity.tierKey}
                variant="thumbnail"
                className="size-14 shrink-0 rounded-2xl bg-surface-2"
              />
            ) : (
              <span className="font-display flex size-14 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-[1.375rem] text-muted">
                {identity.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[17px] font-semibold tracking-[-0.015em] text-text">
                {identity.name}
              </span>
              <span className="block truncate text-[13px] text-muted">
                {identity.tierName
                  ? `${identity.tierName}, rank ${identity.rank} of ${MAX_RANK}`
                  : identity.ringName
                    ? `@${identity.ringName}`
                    : "Profile and settings"}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted" />
          </Link>

          {/* Everything below sits at the foot of the screen, in thumb reach. */}
          <ul className="mt-auto pt-4 [@media(max-height:760px)]:hidden">
            {main.map((item, i) => {
              const active = isActive(item.href);
              return (
                <li key={item.href} className="hb-hero-rise" style={rise(1 + i)}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className="group flex items-center justify-between py-1.5"
                  >
                    <span
                      className={cn(
                        "font-display text-[2.125rem] leading-[1.05] transition-colors",
                        active ? "text-text" : "text-text/55 group-active:text-text",
                      )}
                    >
                      {item.label}
                    </span>
                    {active && <span className="size-2 rounded-full bg-accent" aria-hidden />}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* King of the Hill, fronted by the top of the ladder */}
          <Link
            href="/leaderboard"
            onClick={onClose}
            aria-current={isActive("/leaderboard") ? "page" : undefined}
            className="hb-hero-rise relative isolate mt-auto flex h-40 flex-col justify-end overflow-hidden rounded-3xl bg-surface p-4 [--hb-fade:var(--color-surface)] [@media(min-height:761px)]:mt-2"
            style={rise(4)}
          >
            <FighterArt
              fighterKey="kuroki"
              variant="card"
              fade="corner"
              className="absolute inset-y-0 right-0 -z-10 w-[62%]"
              imageClassName="object-[center_14%]"
            />
            <Trophy className="size-5 text-accent" />
            <span className="font-display mt-2 text-[1.625rem] leading-none text-text">King of the Hill</span>
            <span className="mt-1.5 text-[13px] text-muted">The standings, by volume lifted</span>
          </Link>

          <div className="grid grid-cols-3 gap-3">
            {tiles.map((item, i) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "hb-hero-rise flex h-[7.5rem] flex-col justify-between rounded-3xl p-3.5 transition-colors",
                    active ? "bg-white/[0.12]" : "bg-white/[0.07] active:bg-white/[0.1]",
                  )}
                  style={rise(5 + i)}
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-white/[0.08]">
                    <item.icon className="size-5 text-text" />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold tracking-[-0.01em] text-text">{item.label}</span>
                    <span className="block truncate text-[12px] text-muted">{HINTS[item.href]}</span>
                  </span>
                </Link>
              );
            })}
          </div>

          <Link
            href="/log"
            onClick={onClose}
            className="hb-hero-rise hb-glow mt-1 flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent text-[16px] font-semibold text-black"
            style={rise(8)}
          >
            <Plus className="size-5" strokeWidth={2.5} />
            Start a workout
          </Link>

          <div
            className="hb-hero-rise flex items-center justify-between gap-3 pt-3"
            style={rise(9)}
          >
            <span className="min-w-0 truncate text-[13px] text-muted">{email}</span>
            <form action={signOutOfApp}>
              <button
                type="submit"
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[14px] font-medium text-muted transition-colors hover:text-danger"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          </div>
        </nav>
      </div>
    </Portal>
  );
}
