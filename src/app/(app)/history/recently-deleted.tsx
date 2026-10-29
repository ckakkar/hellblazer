"use client";

import { useOptimistic, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapse } from "@/components/ui/collapse";
import { restoreSession } from "@/lib/actions/sessions";
import { useAction } from "@/lib/use-action";
import { showNotice } from "@/lib/notice";
import type { DeletedWorkout } from "@/lib/data/sessions";
import { cn } from "@/lib/utils";

/**
 * Recently deleted, at the foot of History: a workout deleted by mistake
 * comes back whole (its sets, records and charts with it) for 30 days, then
 * goes for good. Closed by default; nothing shows when there's nothing in it.
 */
export function RecentlyDeleted({ workouts }: { workouts: DeletedWorkout[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useAction("restore that workout");
  const [shown, drop] = useOptimistic(workouts, (list, id: string) => list.filter((w) => w.id !== id));

  if (workouts.length === 0) return null;

  function restore(w: DeletedWorkout) {
    start(async () => {
      drop(w.id);
      const result = await restoreSession({ id: w.id });
      if (!result.ok) {
        showNotice(`“${w.title ?? "Session"}” can't come back: one of its exercises was deleted since.`);
        return;
      }
      showNotice(`“${w.title ?? "Session"}” is back in History.`);
      router.refresh();
    });
  }

  return (
    <section className="mt-12 lg:ml-[16rem]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="recently-deleted"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-1 py-2 text-left text-[15px] font-semibold text-text"
      >
        Recently deleted
        <span className="tnum text-[13px] font-normal text-muted">{workouts.length}</span>
        <ChevronDown
          aria-hidden
          className={cn("ml-auto size-4 text-muted transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <Collapse open={open} id="recently-deleted">
        <p className="px-1 pb-3 text-[13px] text-muted">
          Deleted workouts stay here for 30 days, then go for good.
        </p>
        <ul className="divide-y divide-text/[0.08] border-y border-text/[0.12]">
          {shown.map((w) => {
            const left = Math.max(1, 30 - differenceInCalendarDays(new Date(), parseISO(w.deletedAt)));
            return (
              <li key={w.id} className="flex items-center gap-3 px-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] text-text">{w.title ?? "Session"}</p>
                  <p className="tnum mt-0.5 text-[13px] text-muted">
                    {format(parseISO(w.date), "EEE d MMM yyyy")}, {w.workingSets}{" "}
                    {w.workingSets === 1 ? "set" : "sets"}
                    <span className="sr-only">
                      , goes for good on {format(addDays(parseISO(w.deletedAt), 30), "d MMMM")}
                    </span>
                    <span aria-hidden>, {left} {left === 1 ? "day" : "days"} left</span>
                  </p>
                </div>
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => restore(w)}>
                  <RotateCcw className="size-3.5" />
                  Restore
                </Button>
              </li>
            );
          })}
        </ul>
      </Collapse>
    </section>
  );
}
