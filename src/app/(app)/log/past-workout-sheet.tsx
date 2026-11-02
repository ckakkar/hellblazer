"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { logPastSession } from "@/lib/actions/sessions";
import { todayLocalISO } from "@/lib/local-date";
import { useAction } from "@/lib/use-action";
import { selectAllOnFocus } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");

/** A start a little before now, on the quarter hour, for a workout just done. */
function defaults(minutes: number): { date: string; time: string } {
  const at = new Date(Date.now() - (minutes + 10) * 60_000);
  at.setMinutes(Math.floor(at.getMinutes() / 15) * 15, 0, 0);
  return {
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
  };
}

/**
 * A workout done without the app, added afterwards: its day, when it
 * started and how long it took. It opens in the logger already over (no
 * clock running) to have its exercises and sets filled in. Mounted fresh
 * each time it opens, so the defaults are now's.
 */
export function PastWorkoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pending, start] = useAction("log the workout");
  const [duration, setDuration] = useState<number | null>(45);
  const [{ date, time }, setWhen] = useState(() => defaults(45));
  // Now, as of opening: the latest it can have ended, and the last day it can be on.
  const [now] = useState(() => ({ at: Date.now(), today: todayLocalISO() }));

  const startedAt = new Date(`${date}T${time}`).getTime();
  const minutes = duration ?? 0;
  const endsLater = Number.isFinite(startedAt) && startedAt + minutes * 60_000 > now.at + 60_000;
  const ready = Number.isFinite(startedAt) && minutes >= 1 && minutes <= 600 && !endsLater;
  const timeLabel = Number.isFinite(startedAt)
    ? new Date(startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "–";

  function log() {
    if (!ready) return;
    start(() => logPastSession({ date, startedAt, durationMin: minutes }));
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Log a past workout"
      footer={
        <Button size="lg" className="w-full" disabled={!ready || pending} onClick={log}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Add its exercises
        </Button>
      }
    >
      <div className="px-4 pb-2 pt-1">
        <p className="px-1 pb-4 text-[14px] leading-5 text-muted">
          For a workout you didn&apos;t log as you went. It goes in on the day and at the time you did it.
        </p>
        <div className="divide-y divide-text/[0.06] rounded-2xl bg-surface-2/60">
          {/* Each choice shows as text, with the system's own picker laid
            invisibly over it (16px, so iOS doesn't zoom). */}
          <label className="relative flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[15px] text-text has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-text/25">
            Day
            <span className="tnum text-muted">{format(parseISO(date), "EEE d MMM")}</span>
            <input
              type="date"
              value={date}
              max={now.today}
              aria-label="Day of the workout"
              onChange={(e) => e.target.value && setWhen((w) => ({ ...w, date: e.target.value }))}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch {
                  // Already open, or not supported: the input still takes typing.
                }
              }}
              className="absolute inset-0 size-full cursor-pointer text-base opacity-0"
            />
          </label>
          <label className="relative flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[15px] text-text has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-text/25">
            Started
            <span className="tnum text-muted">{timeLabel}</span>
            <input
              type="time"
              value={time}
              step={300}
              aria-label="When it started"
              onChange={(e) => e.target.value && setWhen((w) => ({ ...w, time: e.target.value }))}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch {
                  // As above.
                }
              }}
              className="absolute inset-0 size-full cursor-pointer text-base opacity-0"
            />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[15px] text-text">
            Took
            <span className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                value={duration ?? ""}
                onFocus={selectAllOnFocus}
                onChange={(e) => setDuration(e.target.value === "" ? null : Math.round(Number(e.target.value)))}
                aria-label="How long it took, in minutes"
                className="tnum h-9 w-20 rounded-lg bg-surface px-2 text-center text-base text-text focus:outline-none focus:ring-2 focus:ring-text/25"
              />
              <span className="text-[13px] text-muted">min</span>
            </span>
          </label>
        </div>
        {endsLater && (
          <p role="status" className="mt-3 px-1 text-[13px] text-danger">
            That would end after now. Pick an earlier start, or a shorter time.
          </p>
        )}
      </div>
    </Sheet>
  );
}
