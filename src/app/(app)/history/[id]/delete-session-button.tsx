"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteSession } from "@/lib/actions/sessions";

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  if (!confirm) {
    return (
      <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>
        <Trash2 className="size-4" />
        Delete
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">Sure?</span>
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() => start(async () => void (await deleteSession({ id: sessionId })))}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
        Cancel
      </Button>
    </div>
  );
}
