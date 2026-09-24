"use client";

import { useEffect, useRef } from "react";
import { SkipForward } from "lucide-react";
import FuseButton from "@/components/reactbits/fuse-button";
import { skipWorkout } from "@/lib/actions/programs";

/**
 * Skip, with a way back: tapping it turns the button into Undo while a fuse
 * burns along its foot, and the day is only skipped when the fuse runs out.
 * Leaving the page mid-fuse still skips, since that's what you asked for.
 * Keyed by the day, so the next day starts fresh.
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
  return <SkipFuse key={programDayId} programDayId={programDayId} className={className} size={size} />;
}

function SkipFuse({
  programDayId,
  className,
  size,
}: {
  programDayId: string;
  className?: string;
  size: "sm" | "md" | "lg";
}) {
  const armed = useRef(false);
  const done = useRef(false);
  const commit = useRef(() => {
    if (done.current) return;
    done.current = true;
    void skipWorkout({ programDayId });
  });

  // Navigating away while the fuse burns is still a skip.
  useEffect(() => {
    const fire = commit.current;
    return () => {
      if (armed.current) fire();
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
      onCommit={() => commit.current()}
    />
  );
}
