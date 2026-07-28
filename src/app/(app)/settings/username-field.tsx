"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setUsername } from "@/lib/actions/profile";

type Status = "idle" | "saved" | "taken" | "invalid" | "error";

export function UsernameField({ current }: { current: string | null }) {
  const [value, setValue] = useState(current ?? "");
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>("idle");

  const dirty = value.trim() !== (current ?? "");

  function save() {
    const name = value.trim();
    setStatus("idle");
    start(async () => {
      try {
        const r = await setUsername({ username: name === "" ? null : name });
        setStatus(r.ok ? "saved" : r.error);
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setStatus("idle");
          }}
          onKeyDown={(e) => e.key === "Enter" && dirty && save()}
          placeholder="Your ring name"
          maxLength={24}
          aria-label="Ring name"
        />
        <Button
          variant="secondary"
          className="shrink-0"
          onClick={save}
          disabled={pending || !dirty}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : status === "saved" && !dirty ? (
            <Check className="size-4 text-accent" />
          ) : null}
          Save
        </Button>
      </div>
      <p className="text-xs">
        {status === "saved" ? (
          <span className="text-accent">Saved: you&apos;re on the board.</span>
        ) : status === "taken" ? (
          <span className="text-danger">That ring name&apos;s taken. Try another.</span>
        ) : status === "invalid" ? (
          <span className="text-danger">
            2-24 characters: letters, numbers, spaces or _ . -
          </span>
        ) : status === "error" ? (
          <span className="text-danger">Couldn&apos;t save. Try again.</span>
        ) : (
          <span className="text-muted">
            Shown on the global leaderboard. 2-24 characters.
          </span>
        )}
      </p>
    </div>
  );
}
