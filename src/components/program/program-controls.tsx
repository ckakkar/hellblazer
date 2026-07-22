"use client";

import { useState, useTransition } from "react";
import { Loader2, Pause, Play, Undo2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  pauseProgram,
  resumeProgram,
  rollbackLastDay,
} from "@/lib/actions/programs";

/** Pause freezes the week counter; resume shifts the block forward to catch up. */
export function PauseResumeButton({
  programId,
  isPaused,
  variant = "outline",
  size = "md",
  className,
}: {
  programId: string;
  isPaused: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={isPaused ? "secondary" : variant}
      size={size}
      className={className}
      disabled={pending}
      title={
        isPaused
          ? "Resume — the block picks up where it left off"
          : "Pause — freeze your week count until you're back"
      }
      onClick={() =>
        start(async () => {
          if (isPaused) await resumeProgram({ id: programId });
          else await pauseProgram({ id: programId });
        })
      }
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : isPaused ? (
        <Play className="size-4" />
      ) : (
        <Pause className="size-4" />
      )}
      {isPaused ? "Resume block" : "Pause block"}
    </Button>
  );
}

/**
 * Roll back the most recent advance — an undone skip, or (with a confirm) the
 * last logged workout.
 */
export function RollbackButton({
  programId,
  lastAdvance,
  className,
}: {
  programId: string;
  lastAdvance: { kind: "skip" | "session"; label: string };
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const destructive = lastAdvance.kind === "session";

  function run() {
    start(async () => {
      await rollbackLastDay({ programId });
      setConfirm(false);
    });
  }

  if (confirm && destructive) {
    return (
      <div className={className}>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-text">
          <span className="text-muted">
            Delete {lastAdvance.label} and its logged sets?
          </span>
          <Button variant="danger" size="sm" disabled={pending} onClick={run}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Roll back"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
            Keep it
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      disabled={pending}
      title={`Roll back ${lastAdvance.label}`}
      onClick={() => (destructive ? setConfirm(true) : run())}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Undo2 className="size-4" />
      )}
      Roll back a day
    </Button>
  );
}
