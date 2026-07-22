"use client";

import { useTransition } from "react";
import { Loader2, SkipForward } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { skipWorkout } from "@/lib/actions/programs";

export function SkipWorkoutButton({
  programDayId,
  className,
  size = "md",
  variant = "outline",
}: {
  programDayId: string;
  className?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      title="Skip this day — advances your rotation without logging it"
      onClick={() =>
        start(async () => {
          await skipWorkout({ programDayId });
        })
      }
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <SkipForward className="size-4" />
      )}
      Skip
    </Button>
  );
}
