"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCcw, Trash2, UserX } from "lucide-react";
import HoldButton from "@/components/reactbits/hold-button";
import { resetProgram } from "@/lib/actions/programs";
import { clearHistory } from "@/lib/actions/sessions";
import { deleteAccount } from "@/lib/actions/account";

/**
 * The irreversible actions, each behind a press-and-hold instead of a second
 * "are you sure" button: holding is one deliberate gesture, and letting go
 * early cancels. The more there is to lose, the longer the hold.
 */
export function DangerZone({
  activeProgram,
}: {
  activeProgram: { id: string; name: string } | null;
}) {
  const [pending, start] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <div className="grid gap-4">
      {activeProgram && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[15px] font-medium text-text">Restart block</div>
            <p className="mt-0.5 text-[13px] leading-5 text-muted">
              Reset “{activeProgram.name}” to week 1 (today). Logged sessions are
              kept.
            </p>
          </div>
          <HoldButton
            size="sm"
            radius={10}
            backgroundColor="#1c1c1f"
            fillColor="#f4f2ee"
            textColor="#f4f2ee"
            fillTextColor="#000000"
            holdTime={1200}
            disabled={pending}
            icon={pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            doneLabel="Restarted"
            onHold={() => start(async () => void (await resetProgram({ id: activeProgram.id })))}
            className="shrink-0"
          >
            Hold to restart
          </HoldButton>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[15px] font-medium text-danger">Delete all history</div>
          <p className="mt-0.5 text-[13px] leading-5 text-muted">
            Permanently wipe every logged session, exercise and set. Cannot be
            undone.
          </p>
        </div>
        <HoldButton
          size="sm"
          radius={10}
          holdTime={2000}
          disabled={pending}
          icon={pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          doneLabel="Wiping"
          onHold={() => start(async () => void (await clearHistory()))}
          className="shrink-0"
        >
          Hold to wipe history
        </HoldButton>
      </div>

      <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[15px] font-medium text-danger">Delete account</div>
          <p className="mt-0.5 text-[13px] leading-5 text-muted">
            Deletes your account and everything in it: sessions, programs, bodyweight,
            rank and settings. Cannot be undone.
          </p>
          {deleteError && (
            <p role="alert" className="mt-1 text-[13px] leading-5 text-danger">
              {deleteError}
            </p>
          )}
        </div>
        <HoldButton
          size="sm"
          radius={10}
          holdTime={2500}
          disabled={pending}
          icon={pending ? <Loader2 className="size-4 animate-spin" /> : <UserX className="size-4" />}
          doneLabel="Deleting"
          onHold={() =>
            start(async () => {
              setDeleteError(null);
              // Success redirects away; only a failure comes back.
              const result = await deleteAccount();
              setDeleteError(result.error);
            })
          }
          className="shrink-0"
        >
          Hold to delete account
        </HoldButton>
      </div>
    </div>
  );
}
