"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadPreset } from "@/lib/actions/templates";
import { cn } from "@/lib/utils";
import { useAction } from "@/lib/use-action";

type PresetLite = {
  id: string;
  name: string;
  description: string;
  days: number;
  weeks: number;
};

/**
 * First-run onboarding: a new lifter with no history is pushed straight at a
 * ready-to-run split (the 5-day is featured), with the rest one tap away.
 */
export function OnboardingHero({
  featured,
  others,
  className,
}: {
  featured: PresetLite;
  others: PresetLite[];
  className?: string;
}) {
  const [pending, start] = useAction("load the program");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function load(id: string) {
    setLoadingId(id);
    start(async () => {
      try {
        await loadPreset({ presetId: id });
      } finally {
        setLoadingId(null);
      }
    });
  }

  return (
    // On a desktop the pitch and the other styles sit on the left, the
    // featured program on the right, instead of one page-wide column.
    <section
      className={cn(
        "rounded-3xl bg-surface p-5 sm:p-6 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-10 lg:p-8",
        className,
      )}
    >
      <div>
        <h2 className="text-[1.375rem] font-semibold tracking-[-0.02em] text-text">
          Pick your first program
        </h2>
        <p className="mt-1 max-w-md text-[15px] leading-6 text-muted">
          It becomes a ready-to-run {featured.weeks}-week program you can start
          today. Change anything later.
        </p>
      </div>

      <div className="mt-5 rounded-2xl bg-white/[0.04] p-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:self-start lg:p-5">
        <p className="text-[17px] font-semibold tracking-[-0.015em] text-text">{featured.name}</p>
        <p className="tnum mt-0.5 text-[13px] text-muted">
          {featured.days} days a week, {featured.weeks} weeks
        </p>
        <p className="mt-2 text-[14px] leading-[1.45] text-muted">{featured.description}</p>
        <Button
          variant="accent"
          size="lg"
          className="mt-4 w-full"
          disabled={pending}
          onClick={() => load(featured.id)}
        >
          {loadingId === featured.id ? <Loader2 className="size-4 animate-spin" /> : null}
          {loadingId === featured.id ? "Loading" : "Use this program"}
        </Button>
      </div>

      {others.length > 0 && (
        <div className="mt-5 lg:col-start-1 lg:row-start-2 lg:self-end">
          <p className="mb-2 text-[13px] font-medium text-muted">Or start with</p>
          <div className="flex flex-wrap gap-2">
            {others.map((p) => (
              <button
                key={p.id}
                disabled={pending}
                onClick={() => load(p.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[13px] text-text transition-colors hover:bg-[#242428] disabled:opacity-45"
              >
                {loadingId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
