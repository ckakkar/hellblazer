"use client";

import { useTransition, useState } from "react";
import { Dumbbell, Loader2, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { startSession } from "@/lib/actions/sessions";
import { cn } from "@/lib/utils";

type TemplateOption = {
  id: string;
  name: string;
  day_label: string | null;
  count: number;
};

export function SessionStarter({ templates }: { templates: TemplateOption[] }) {
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<string | null>(null);

  function begin(templateId: string | null) {
    setChosen(templateId ?? "freeform");
    start(async () => {
      await startSession({ templateId });
    });
  }

  return (
    <div className="grid gap-4">
      <button
        disabled={pending}
        onClick={() => begin(null)}
        className={cn(
          "group flex items-center gap-4 rounded-lg border border-border bg-surface p-5 text-left transition-[transform,border-color] hover:border-accent/40 active:scale-[0.99]",
          pending && chosen === "freeform" && "border-accent/60",
        )}
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          {pending && chosen === "freeform" ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Zap className="size-5" />
          )}
        </div>
        <div>
          <div className="text-sm font-medium text-text">Freeform battle</div>
          <div className="text-xs text-muted">
            Start empty and add exercises as you go
          </div>
        </div>
      </button>

      {templates.length > 0 && (
        <div>
          <div className="mb-2 mt-2 px-1 text-xs font-medium uppercase tracking-wide text-muted">
            From a template
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((t) => (
              <Card
                key={t.id}
                role="button"
                aria-disabled={pending}
                onClick={() => !pending && begin(t.id)}
                className={cn(
                  "cursor-pointer p-4 transition-[transform,border-color] hover:border-accent/40 active:scale-[0.99]",
                  pending && chosen === t.id && "border-accent/60",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                    {pending && chosen === t.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Dumbbell className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text">
                      {t.name}
                    </div>
                    <div className="text-xs text-muted">
                      {t.count} exercise{t.count === 1 ? "" : "s"}
                    </div>
                  </div>
                  {t.day_label && <Badge variant="muted">{t.day_label}</Badge>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
