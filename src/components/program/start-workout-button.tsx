"use client";

import { useTransition } from "react";
import { Loader2, Play } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { startSession } from "@/lib/actions/sessions";

export function StartWorkoutButton({
  programDayId,
  templateId,
  label = "Start workout",
  variant = "primary",
  size = "md",
  className,
}: {
  programDayId?: string | null;
  templateId?: string | null;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await startSession({ programDayId, templateId });
        })
      }
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Play className="size-4" />
      )}
      {label}
    </Button>
  );
}
