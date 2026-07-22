import Link from "next/link";
import { Flame } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg border border-accent/40 text-accent">
        <Flame className="size-5" />
      </span>
      <h1 className="mt-6 font-impact text-6xl uppercase leading-none text-text">
        Lost the fight
      </h1>
      <p className="mt-3 max-w-sm text-sm text-muted">
        This page doesn&apos;t exist — or it was knocked out of the arena.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg shadow-glow transition-transform active:scale-95"
      >
        Back to the dashboard
      </Link>
    </main>
  );
}
