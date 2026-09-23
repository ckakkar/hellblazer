"use client";

import { useEffect, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENTS, type AccentKey } from "@/lib/accents";
import { setAccent } from "@/lib/actions/settings";

export function ThemeSelector({ current }: { current: AccentKey }) {
  const [accent, setLocal] = useState<AccentKey>(current);
  const [, start] = useTransition();

  // Re-skin the whole app instantly. Everything derives from this attribute.
  // The server layout will re-render it to the same value once the cookie lands.
  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  function choose(key: AccentKey) {
    if (key === accent) return;
    setLocal(key);
    start(async () => {
      await setAccent({ accent: key });
    });
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3">
      {ACCENTS.map((a) => {
        const active = a.key === accent;
        return (
          <button
            key={a.key}
            type="button"
            onClick={() => choose(a.key)}
            aria-pressed={active}
            aria-label={a.name}
            className={cn(
              "group flex flex-col items-center gap-2 rounded-xl p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text/40",
              active
                ? "bg-white/[0.08] shadow-[inset_0_0_0_1.5px_rgb(244_242_238/0.55)]"
                : "bg-surface-2/60 hover:bg-surface-2",
            )}
          >
            <span
              className="relative flex size-8 items-center justify-center rounded-full"
              style={{
                backgroundColor: a.swatch,
                boxShadow: active ? `0 0 14px -2px ${a.swatch}` : undefined,
              }}
            >
              {active && <Check className="size-4 text-bg" strokeWidth={3} />}
            </span>
            <span
              className={cn(
                "text-[13px] font-medium",
                active ? "text-text" : "text-muted",
              )}
            >
              {a.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
