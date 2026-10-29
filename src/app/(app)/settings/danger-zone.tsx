"use client";

import { useState } from "react";
import { Loader2, RotateCcw, Trash2, UserX } from "lucide-react";
import HoldButton from "@/components/reactbits/hold-button";
import { resetProgram } from "@/lib/actions/programs";
import { clearHistory } from "@/lib/actions/sessions";
import { forgetThisDevice } from "@/lib/sign-out";
import { deleteAccount, deletionNeedsSignIn } from "@/lib/actions/account";
import { useAction } from "@/lib/use-action";
import { SignInOptions } from "@/components/auth/sign-in-options";

/**
 * The irreversible actions, each behind a press-and-hold instead of a second
 * "are you sure" button: holding is one deliberate gesture, and letting go
 * early cancels. The more there is to lose, the longer the hold.
 */
export function DangerZone({
  activeProgram,
  signInAgain: signInFirst,
}: {
  activeProgram: { id: string; name: string } | null;
  /** No sign-in in the last ten minutes: deleting the account asks for one first. */
  signInAgain: boolean;
}) {
  const [pending, start] = useAction("finish that");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [signInAgain, setSignInAgain] = useState(signInFirst);
  // Resolves to whether the work happened, so a hold only says "Restarted"
  // (or "Wiping") when it did, and springs back when it didn't.
  const confirmed = (work: () => Promise<unknown>) =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        try {
          resolve((await work()) !== false);
        } catch (err) {
          resolve(false);
          throw err;
        }
      }),
    );

  return (
    <div className="grid grid-cols-1 gap-4">
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
            backgroundColor="var(--color-surface-2)"
            fillColor="var(--color-text)"
            textColor="var(--color-text)"
            fillTextColor="var(--color-bg)"
            holdTime={1200}
            disabled={pending}
            icon={pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            doneLabel="Restarted"
            onHold={() => confirmed(() => resetProgram({ id: activeProgram.id }))}
            className="shrink-0"
          >
            Hold to restart
          </HoldButton>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-text/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[15px] font-medium text-danger">Delete all history</div>
          <p className="mt-0.5 text-[13px] leading-5 text-muted">
            Permanently wipe every logged session, exercise and set, Recently
            deleted included. Cannot be undone, so{" "}
            <a href="/api/export" download className="text-text underline decoration-text/30 underline-offset-2">
              export a copy
            </a>{" "}
            first if you might want it.
          </p>
        </div>
        <HoldButton
          size="sm"
          radius={10}
          holdTime={2000}
          disabled={pending}
          icon={pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          doneLabel="Wiping"
          onHold={() => confirmed(() => clearHistory())}
          className="shrink-0"
        >
          Hold to wipe history
        </HoldButton>
      </div>

      <div className="flex flex-col gap-3 border-t border-text/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[15px] font-medium text-danger">Delete account</div>
          <p className="mt-0.5 text-[13px] leading-5 text-muted">
            Deletes your account and everything in it: sessions, programs, bodyweight,
            rank and settings. Cannot be undone.
          </p>
          {deleteError && !signInAgain && (
            <p role="alert" className="mt-1 text-[13px] leading-5 text-danger">
              {deleteError}
            </p>
          )}
        </div>
        {signInAgain ? null : (
        <HoldButton
          size="sm"
          radius={10}
          holdTime={2500}
          disabled={pending}
          icon={pending ? <Loader2 className="size-4 animate-spin" /> : <UserX className="size-4" />}
          doneLabel="Deleting"
          onHold={() =>
            confirmed(async () => {
              setDeleteError(null);
              // Asked before this device lets go of anything: the page may
              // have sat open past the ten minutes.
              if (await deletionNeedsSignIn()) {
                setSignInAgain(true);
                return false;
              }
              // This device lets go of the account first (widgets, Spotlight,
              // the watch, notifications), while the session still works.
              await forgetThisDevice();
              // Success redirects away; only a failure comes back.
              const result = await deleteAccount();
              if (result.signInAgain) setSignInAgain(true);
              setDeleteError(result.error);
              return false;
            })
          }
          className="shrink-0"
        >
          Hold to delete account
        </HoldButton>
        )}
      </div>
      {signInAgain && (
        // The person holding the phone proves it's their account: the same
        // sign-in as ever, back to here, with ten minutes to finish.
        <div className="-mt-1 rounded-xl bg-surface-2/60 p-4">
          <p className="mb-3 text-[13px] leading-5 text-muted">
            To delete your account, sign in again first. You&apos;ll come back here, with ten minutes to finish.
          </p>
          <SignInOptions next="/settings#reset" />
        </div>
      )}
    </div>
  );
}
