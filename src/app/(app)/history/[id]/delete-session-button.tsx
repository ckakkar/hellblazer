"use client";

import { Loader2, Trash2 } from "lucide-react";
import HoldButton from "@/components/reactbits/hold-button";
import { deleteSession } from "@/lib/actions/sessions";
import { useAction } from "@/lib/use-action";

/** Deleting a session is a press-and-hold: letting go early cancels. */
export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const [pending, start] = useAction("delete the session");
  return (
    <HoldButton
      size="sm"
      radius={10}
      disabled={pending}
      icon={pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      doneLabel="Deleting"
      onHold={() => start(async () => void (await deleteSession({ id: sessionId })))}
    >
      Hold to delete
    </HoldButton>
  );
}
