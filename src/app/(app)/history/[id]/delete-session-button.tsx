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
      // A promise that settles with the delete, so the hold says "Deleting"
      // only once it went through, and goes back to idle if it didn't.
      onHold={() =>
        new Promise<boolean>((resolve) =>
          start(
            async () => {
              await deleteSession({ id: sessionId });
              resolve(true);
            },
            () => resolve(false),
          ),
        )
      }
    >
      Hold to delete
    </HoldButton>
  );
}
