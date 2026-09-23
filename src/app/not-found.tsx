import Link from "next/link";
import { Flame } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Flame className="size-7 text-accent" strokeWidth={2.25} />
      <h1 className="font-display mt-6 text-[2.5rem] leading-tight text-text">Page not found</h1>
      <p className="mt-2 max-w-sm text-[15px] text-muted">
        This page doesn&apos;t exist, or it has moved.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex h-12 items-center rounded-xl bg-text px-5 text-[15px] font-medium text-bg transition-opacity active:opacity-75"
      >
        Go to your dashboard
      </Link>
    </main>
  );
}
