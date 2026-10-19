"use client";

import { useEffect, useRef, useState } from "react";
import { SkipForward } from "lucide-react";
import FuseButton from "@/components/reactbits/fuse-button";
import { skipWorkout } from "@/lib/actions/programs";
import { showNotice } from "@/lib/notice";

/**
 * Skip, with a way back: tapping it turns the button into Undo while a fuse
 * burns along its foot, and the day is only skipped when the fuse runs out.
 * Leaving the page mid-fuse still skips, since that's what you asked for.
 * Keyed by the day, so the next day starts fresh, and by the attempt: a skip
 * the server didn't take puts the button back to Skip, with a notice.
 */
export function SkipWorkoutButton({
  programDayId,
  className,
  size = "md",
}: {
  programDayId: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [attempt, setAttempt] = useState(0);
  return (
    <SkipFuse
      key={`${programDayId}:${attempt}`}
      programDayId={programDayId}
      className={className}
      size={size}
      onFail={() => setAttempt((n) => n + 1)}
    />
  );
}

function SkipFuse({
  programDayId,
  className,
  size,
  onFail,
}: {
  programDayId: string;
  className?: string;
  size: "sm" | "md" | "lg";
  onFail: () => void;
}) {
  const armed = useRef(false);
  const done = useRef(false);
  const mounted = useRef(true);
  const failed = useRef(onFail);
  useEffect(() => {
    failed.current = onFail;
  }, [onFail]);
  const commit = useRef(async () => {
    if (done.current) return;
    done.current = true;
    try {
      await skipWorkout({ programDayId });
    } catch {
      done.current = false;
      showNotice(
        navigator.onLine
          ? "Couldn't skip the day. Try again in a moment."
          : "You're offline. Connect to skip the day.",
      );
      // Still on screen: back to Skip. (Left mid-fuse, the notice says it.)
      if (mounted.current) failed.current();
    }
  });

  // Navigating away while the fuse burns is still a skip.
  useEffect(() => {
    mounted.current = true;
    const fire = commit.current;
    return () => {
      mounted.current = false;
      if (armed.current) void fire();
    };
  }, []);

  return (
    <FuseButton
      label="Skip"
      undoLabel="Undo"
      doneLabel="Skipped"
      icon={<SkipForward />}
      size={size}
      fuse="bottom"
      fuseThickness={2}
      undoWindow={4000}
      commitOn="fuseEnd"
      settle="stay"
      className={className}
      onPhaseChange={(p) => {
        armed.current = p === "armed";
      }}
      onCommit={() => void commit.current()}
    />
  );
}
