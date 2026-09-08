import Link from "next/link";
import { Flame } from "lucide-react";

export default function NotFound() {
  return (
    <main className="hb-arena relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <span aria-hidden className="absolute font-impact text-[min(52vw,28rem)] leading-none text-text/[0.025]">404</span>
      <span className="hb-panel-cut relative flex size-10 items-center justify-center border border-accent/40 text-accent">
        <Flame className="size-5" />
      </span>
      <h1 className="relative mt-6 font-impact text-7xl uppercase leading-[0.78] text-text sm:text-8xl">
        Lost the fight
      </h1>
      <p className="mt-3 max-w-sm text-sm text-muted">
        This page doesn&apos;t exist: or it was knocked out of the arena.
      </p>
      <Link
        href="/dashboard"
        className="hb-panel-cut relative mt-8 inline-flex items-center gap-2 bg-accent px-5 py-2.5 text-sm font-semibold text-bg shadow-glow transition-transform active:scale-95"
      >
        Back to the dashboard
      </Link>
    </main>
  );
}
